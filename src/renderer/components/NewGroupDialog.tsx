import { useEffect, useState } from 'react';
import type { Contact } from '../../shared/types';
import { lex } from '../lib/api';
import { describe } from '../lib/presence';
import { ContactIcon } from './ContactIcon';

const clean = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

/** Novo grupo: nome + participantes. */
export function NewGroupDialog({ onClose }: { onClose: () => void }) {
  const [people, setPeople] = useState<Contact[]>([]);
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void lex.contacts().then((list) => setPeople(list.filter((c) => c.kind === 'user').sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const create = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await lex.createGroup(title, [...picked]);
      if (r.notAdded.length) {
        setMsg({ ok: true, text: `Grupo criado. Não foi possível adicionar ${r.notAdded.join(', ')} (privacidade da pessoa); mande um link de convite pelo Telegram.` });
        window.setTimeout(() => lex.openChat(r.chatId), 2500);
      } else lex.openChat(r.chatId);
      window.setTimeout(onClose, r.notAdded.length ? 2600 : 300);
    } catch (e) {
      setMsg({ ok: false, text: clean(e) || 'Não foi possível criar o grupo.' });
      setBusy(false);
    }
  };

  const shown = people.filter((c) => c.name.toLocaleLowerCase('pt-BR').includes(q.trim().toLocaleLowerCase('pt-BR')));
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Novo grupo">
        <h2>👥 Novo grupo</h2>
        <label className="field">
          Nome do grupo
          <input autoFocus maxLength={128} placeholder="Ex.: Escritório — Processo 123" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          Participantes {picked.size > 0 && <span className="hint">({picked.size} escolhido{picked.size > 1 ? 's' : ''})</span>}
          <input placeholder="🔍 Procurar" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="pick-list">
          {shown.map((c) => (
            <label key={c.id} className={`pick-item ${picked.has(c.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
              <ContactIcon id={c.id} kind={c.kind} color={describe(c).color} hasPhoto={c.hasPhoto} size={30} />
              <span>{c.name}</span>
            </label>
          ))}
          {!shown.length && <p className="muted center">Ninguém encontrado.</p>}
        </div>
        {msg && <p className={msg.ok ? 'ok' : 'error'}>{msg.text}</p>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={() => void create()} disabled={busy || !title.trim() || !picked.size}>
            {busy ? 'Criando…' : 'Criar grupo'}
          </button>
        </div>
      </div>
    </div>
  );
}
