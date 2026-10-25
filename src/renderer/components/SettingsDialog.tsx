import { useEffect, useState } from 'react';
import type { AccountSettings, Me, Prefs, PrivacyKey, PrivacyValue } from '../../shared/types';
import { lex } from '../lib/api';

const PRIVACY_LABELS: [PrivacyKey, string][] = [
  ['lastSeen', 'Visto por último e online'],
  ['photo', 'Foto do perfil'],
  ['phone', 'Número de telefone'],
  ['invites', 'Quem pode me adicionar em grupos'],
  ['forwards', 'Quem pode encaminhar minhas mensagens com meu nome'],
  ['calls', 'Quem pode me ligar'],
];
const VALUES: [PrivacyValue, string][] = [
  ['everybody', 'Todos'],
  ['contacts', 'Meus contatos'],
  ['nobody', 'Ninguém'],
];

type Tab = 'avisos' | 'privacidade' | 'aparelhos' | 'bloqueados' | 'conta';

const clean = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

/** Configurações do Telegram dentro do Lex. */
export function SettingsDialog({ me, prefs, onClose, onProfile }: { me: Me; prefs: Prefs; onClose: () => void; onProfile: () => void }) {
  const [tab, setTab] = useState<Tab>('avisos');
  const [acc, setAcc] = useState<AccountSettings | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = () =>
    lex
      .settings()
      .then(setAcc)
      .catch((e) => setLoadErr(clean(e) || 'Não foi possível carregar as configurações.'));

  useEffect(() => {
    void reload();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: clean(e) || 'Não foi possível salvar.' });
    }
  };

  const toggle = (key: keyof Prefs, label: string, hint?: string) => (
    <label className="check">
      <input type="checkbox" checked={!!prefs[key]} onChange={(e) => void lex.setPrefs({ [key]: e.target.checked })} />
      {label}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal settings" role="dialog" aria-label="Configurações">
        <h2>⚙️ Configurações</h2>
        <nav className="tabs" role="tablist">
          {(
            [
              ['avisos', '🔔 Avisos'],
              ['privacidade', '🔒 Privacidade'],
              ['aparelhos', '💻 Aparelhos'],
              ['bloqueados', '🚫 Bloqueados'],
              ['conta', '👤 Conta'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </nav>

        <div className="tab-body">
          {tab === 'avisos' && (
            <>
              {toggle('notifications', 'Mostrar aviso de mensagem nova')}
              {toggle('sounds', 'Tocar sons')}
              {toggle('onlineAlerts', 'Avisar quando um contato entrar')}
              {lex.features.mobile && (
                <>
                  {toggle(
                    'background',
                    'Continuar recebendo com o app em segundo plano',
                    'Deixa um aviso fixo "Conectado ao Telegram". Sem isso, o Android pode parar o app e você não recebe avisos.',
                  )}
                  <button className="btn" onClick={() => lex.openSystemNotificationSettings?.()}>
                    Abrir ajustes de notificação do Android
                  </button>
                </>
              )}
              <p className="hint">Para silenciar uma conversa só, abra a conversa e toque no 🔔 ao lado do nome.</p>
            </>
          )}

          {tab === 'privacidade' &&
            (acc ? (
              <>
                {PRIVACY_LABELS.map(([key, label]) => (
                  <label key={key} className="field">
                    {label}
                    <select
                      value={acc.privacy[key]}
                      onChange={(e) => void run(() => lex.setPrivacy(key, e.target.value as PrivacyValue), 'Privacidade atualizada.')}
                    >
                      {VALUES.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <p className="hint">As exceções que você já tinha (pessoas ou grupos específicos) são mantidas.</p>
              </>
            ) : (
              <Loading err={loadErr} />
            ))}

          {tab === 'aparelhos' &&
            (acc ? (
              <>
                <p className="hint">Onde a sua conta do Telegram está conectada agora.</p>
                <ul className="sessions">
                  {acc.sessions.map((s) => (
                    <li key={s.hash}>
                      <div>
                        <b>{s.app}</b> {s.current && <span className="tag">este aparelho</span>}
                        <span className="hint block">{s.device}</span>
                        <span className="hint block">
                          {s.place} · ativo em {new Date(s.lastActive * 1000).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {!s.current && (
                        <button
                          className="btn"
                          onClick={() =>
                            confirm(`Desconectar ${s.app}?`) && void run(() => lex.endSession(s.hash), 'Aparelho desconectado.')
                          }
                        >
                          Desconectar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {acc.sessions.length > 1 && (
                  <button
                    className="btn danger-btn"
                    onClick={() =>
                      confirm('Desconectar todos os outros aparelhos? Eles precisarão entrar de novo.') &&
                      void run(() => lex.endSession('others'), 'Outros aparelhos desconectados.')
                    }
                  >
                    Desconectar todos os outros aparelhos
                  </button>
                )}
              </>
            ) : (
              <Loading err={loadErr} />
            ))}

          {tab === 'bloqueados' &&
            (acc ? (
              acc.blocked.length ? (
                <ul className="sessions">
                  {acc.blocked.map((b) => (
                    <li key={b.id}>
                      <b>{b.name}</b>
                      <button className="btn" onClick={() => void run(() => lex.unblock(b.id), `${b.name} desbloqueado.`)}>
                        Desbloquear
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Você não bloqueou ninguém.</p>
              )
            ) : (
              <Loading err={loadErr} />
            ))}

          {tab === 'conta' && (
            <>
              <p>
                <b>{me.name}</b> {me.premium && <span className="tag premium">⭐ Premium</span>}
                <span className="hint block">
                  {me.phone} {me.username && `· @${me.username}`}
                </span>
              </p>
              <button
                className="btn"
                onClick={() => {
                  onClose();
                  onProfile();
                }}
              >
                Mudar nome, foto e mensagem pessoal…
              </button>
              <p>
                <b>Verificação em duas etapas:</b>{' '}
                {acc ? (acc.twoStep ? '✅ ativada' : '⚠️ desativada — recomendamos ativar no app oficial do Telegram (Configurações > Privacidade > Verificação em duas etapas).') : '…'}
              </p>
              <p>
                <b>Telegram Premium:</b>{' '}
                {me.premium
                  ? 'ativo. O Lex usa a transcrição de áudios e envia arquivos de até 4 GB.'
                  : 'não assinado.'}
              </p>
              <button className="btn" onClick={() => void run(() => lex.clearCache(), 'Arquivos temporários apagados.')}>
                Limpar arquivos temporários
              </button>
              <p className="hint">Versão do Lex Messenger: {lex.version}</p>
            </>
          )}
        </div>

        {msg && <p className={msg.ok ? 'ok' : 'error'}>{msg.text}</p>}
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function Loading({ err }: { err: string }) {
  return err ? <p className="error">{err}</p> : <p className="muted">Carregando…</p>;
}
