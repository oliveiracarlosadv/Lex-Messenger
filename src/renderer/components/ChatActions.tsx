import { useState } from 'react';
import type { Contact } from '../../shared/types';
import { lex } from '../lib/api';

/** Confirmação para excluir a conversa (com a opção de apagar também para a outra pessoa). */
export function DeleteChatDialog({ contact, onClose, onDone }: { contact: Contact; onClose: () => void; onDone?: () => void }) {
  const [both, setBoth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isUser = contact.kind === 'user';
  const isGroup = contact.kind === 'group' || contact.kind === 'channel';
  const run = async () => {
    setBusy(true);
    try {
      await lex.deleteChat(contact.id, both);
      onDone?.();
      onClose();
    } catch {
      setErr('Não foi possível excluir. Tente de novo.');
      setBusy(false);
    }
  };
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="alertdialog" aria-label="Excluir conversa">
        <h2>🗑 {isGroup ? `Sair de “${contact.name}”?` : `Excluir a conversa com ${contact.name}?`}</h2>
        <p>{isGroup ? 'Você sai do grupo/canal e a conversa some da sua lista.' : 'Todas as mensagens desta conversa serão apagadas da sua lista.'}</p>
        {isUser && (
          <label className="check">
            <input type="checkbox" checked={both} onChange={(e) => setBoth(e.target.checked)} />
            Apagar também para {contact.name}
          </label>
        )}
        <p className="hint">Isso não pode ser desfeito.</p>
        {err && <p className="error">{err}</p>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary danger-fill" onClick={() => void run()} disabled={busy}>
            {busy ? 'Excluindo…' : isGroup ? 'Sair' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}

export async function toggleBlock(contact: Contact, notify: (t: string) => void) {
  const next = !contact.blocked;
  if (next && !confirm(`Bloquear ${contact.name}?\n\nEssa pessoa não poderá mais mandar mensagens nem ligar para você, e não verá quando você está online.`)) return;
  try {
    await lex.setBlockedContact(contact.id, next);
    notify(next ? `🚫 ${contact.name} foi bloqueado(a).` : `${contact.name} foi desbloqueado(a).`);
  } catch {
    notify('Não foi possível mudar o bloqueio.');
  }
}
