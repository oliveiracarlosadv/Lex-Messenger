import { useEffect, useMemo, useState } from 'react';
import type { PersonEntry } from '../../shared/types';
import { lex } from '../lib/api';
import { ContactIcon } from './ContactIcon';

const INVITE =
  'Oi! Estou usando o Lex Messenger (com o Telegram) — Comunicação em primeiro lugar! Baixe aqui: https://github.com/oliveiracarlosadv/Lex-Messenger';

type Tab = 'telegram' | 'agenda';

/** Nova conversa: contatos do Telegram, agenda do celular (quem tem Telegram) e busca por número. */
export function NewChatDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('telegram');
  const [tgPeople, setTgPeople] = useState<PersonEntry[] | null>(null);
  const [agenda, setAgenda] = useState<PersonEntry[] | null>(null);
  const [agendaState, setAgendaState] = useState<'idle' | 'asking' | 'loading' | 'denied' | 'done'>('idle');
  const [q, setQ] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneMsg, setPhoneMsg] = useState<{ ok: boolean; text: string; person?: PersonEntry } | null>(null);
  const canAgenda = !!lex.deviceContacts && lex.platform === 'android';

  useEffect(() => {
    void lex.telegramContacts().then(setTgPeople).catch(() => setTgPeople([]));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const start = async (p: PersonEntry) => {
    onClose();
    await lex.startChat(p.id);
  };

  const scanAgenda = async () => {
    setAgendaState('loading');
    const list = await lex.deviceContacts!().catch(() => null);
    if (!list) return setAgendaState('denied');
    const found = await lex.lookupPhones(list).catch(() => []);
    found.sort((a, b) => Number(b.onTelegram) - Number(a.onTelegram) || a.name.localeCompare(b.name, 'pt-BR'));
    setAgenda(found);
    setAgendaState('done');
  };

  const checkPhone = async () => {
    setPhoneMsg(null);
    const [p] = await lex.lookupPhones([{ name: phone, phone }]).catch(() => []);
    if (p?.onTelegram) setPhoneMsg({ ok: true, text: `${p.name} tem Telegram.`, person: p });
    else setPhoneMsg({ ok: false, text: 'Esse número não tem Telegram. Você pode convidar a pessoa por SMS.' });
  };

  const filter = (list: PersonEntry[] | null) => {
    const t = q.trim().toLocaleLowerCase('pt-BR');
    return (list ?? []).filter((p) => !t || p.name.toLocaleLowerCase('pt-BR').includes(t) || (p.phone ?? '').includes(t.replace(/\D/g, '') || '#'));
  };
  const shownTg = useMemo(() => filter(tgPeople), [tgPeople, q]);
  const shownAgenda = useMemo(() => filter(agenda), [agenda, q]);

  const row = (p: PersonEntry) => (
    <div key={(p.id || p.phone) + p.name} className="pick-item person">
      {p.onTelegram ? (
        <ContactIcon id={p.id} kind="user" color={p.online ? 'online' : 'offline'} hasPhoto={!!p.hasPhoto} size={32} />
      ) : (
        <span className="contact-icon-box" style={{ width: 32, height: 32 }}>
          👤
        </span>
      )}
      <span className="person-text">
        <b>{p.name}</b>
        <span className="hint">{p.onTelegram ? `Tem Telegram${p.phone ? ' · ' + p.phone : ''}` : `Sem Telegram · ${p.phone ?? ''}`}</span>
      </span>
      {p.onTelegram ? (
        <button className="btn btn-primary" onClick={() => void start(p)}>
          Conversar
        </button>
      ) : (
        <button className="btn" onClick={() => p.phone && lex.openSms(p.phone, INVITE)}>
          Convidar
        </button>
      )}
    </div>
  );

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal new-chat" role="dialog" aria-label="Nova conversa">
        <h2>✏️ Nova conversa</h2>

        <div className="phone-row">
          <input type="tel" placeholder="Número com DDD (ex.: 91 98888-7777)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className="btn" disabled={phone.replace(/\D/g, '').length < 8} onClick={() => void checkPhone()}>
            Procurar
          </button>
        </div>
        {phoneMsg && (
          <div className={phoneMsg.ok ? 'ok' : 'hint'}>
            {phoneMsg.text}{' '}
            {phoneMsg.person ? (
              <button className="link-btn" onClick={() => void start(phoneMsg.person!)}>
                Conversar
              </button>
            ) : (
              <button className="link-btn" onClick={() => lex.openSms(phone, INVITE)}>
                Convidar por SMS
              </button>
            )}
          </div>
        )}

        <nav className="tabs">
          <button className={tab === 'telegram' ? 'on' : ''} onClick={() => setTab('telegram')}>
            ✈️ Contatos do Telegram
          </button>
          {canAgenda && (
            <button className={tab === 'agenda' ? 'on' : ''} onClick={() => setTab('agenda')}>
              📒 Agenda do celular
            </button>
          )}
        </nav>
        <input className="about-input" placeholder="🔍 Procurar pelo nome" value={q} onChange={(e) => setQ(e.target.value)} />

        <div className="pick-list">
          {tab === 'telegram' &&
            (tgPeople == null ? (
              <p className="muted center">Carregando…</p>
            ) : shownTg.length ? (
              shownTg.map(row)
            ) : (
              <p className="muted center">Nenhum contato do Telegram{q ? ' com esse nome' : ''}.</p>
            ))}
          {tab === 'agenda' &&
            (agendaState === 'idle' || agendaState === 'asking' ? (
              <div className="agenda-consent">
                <p>
                  O Lex confere na agenda do celular <b>quem tem Telegram</b>, para você conversar com um toque — igual ao app
                  oficial. Os números são enviados ao Telegram só para essa conferência (e ficam salvos como contatos lá).
                </p>
                <button className="btn btn-primary wide" onClick={() => void scanAgenda()}>
                  Procurar na agenda
                </button>
              </div>
            ) : agendaState === 'loading' ? (
              <p className="muted center">Conferindo a agenda…</p>
            ) : agendaState === 'denied' ? (
              <p className="error">Sem permissão para ler a agenda. Libere em Ajustes do Android &gt; Apps &gt; Lex Messenger &gt; Permissões &gt; Contatos.</p>
            ) : shownAgenda.length ? (
              <>
                <p className="hint">
                  {agenda!.filter((p) => p.onTelegram).length} de {agenda!.length} contatos têm Telegram.
                </p>
                {shownAgenda.map(row)}
              </>
            ) : (
              <p className="muted center">Nenhum contato encontrado.</p>
            ))}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
