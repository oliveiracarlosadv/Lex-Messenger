import { useState } from 'react';
import { applyToggle, formatChecklist, toggleText, type Checklist } from '../../shared/checklist';
import type { ChatMessage } from '../../shared/types';
import { lex } from '../lib/api';

/** Lista de tarefas dentro de uma mensagem: quem criou edita; quem recebeu marca respondendo. */
export function ChecklistCard({ m, list, chatId, onError }: { m: ChatMessage; list: Checklist; chatId: string; onError: (t: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const done = list.items.filter((i) => i.done).length;

  const toggle = async (item: string, now: boolean) => {
    setBusy(item);
    try {
      if (m.out) await lex.editMessage(chatId, m.id, formatChecklist(applyToggle(list, item, !now)));
      else await lex.sendReply(chatId, toggleText(item, !now), m.id);
    } catch {
      onError('Não foi possível marcar o item.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="checklist">
      <div className="checklist-head">
        <b>📋 {list.title}</b>
        <span className={`checklist-count ${done === list.items.length ? 'all' : ''}`}>
          {done} de {list.items.length} {done === 1 ? 'feito' : 'feitos'}
        </span>
      </div>
      <div className="checklist-bar">
        <span style={{ width: `${(done / list.items.length) * 100}%` }} />
      </div>
      {list.items.map((i) => (
        <label key={i.text} className={`checklist-item ${i.done ? 'done' : ''}`}>
          <input type="checkbox" checked={i.done} disabled={busy === i.text} onChange={() => void toggle(i.text, i.done)} />
          <span>{i.text}</span>
        </label>
      ))}
    </div>
  );
}

/** Criar uma lista: título e um item por linha. */
export function NewChecklistDialog({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [items, setItems] = useState('');
  const [busy, setBusy] = useState(false);
  const lines = items
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const send = async () => {
    setBusy(true);
    try {
      await lex.sendText(chatId, formatChecklist({ title, items: lines.map((text) => ({ text, done: false })) }));
      onClose();
    } catch {
      setBusy(false);
    }
  };
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Nova lista de tarefas">
        <h2>📋 Nova lista de tarefas</h2>
        <label className="field">
          Título
          <input autoFocus maxLength={100} placeholder="Ex.: Documentos para a audiência" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          Itens (um por linha)
          <textarea className="checklist-input" rows={6} placeholder={'Procuração\nRG e CPF\nComprovante de residência'} value={items} onChange={(e) => setItems(e.target.value)} />
        </label>
        <p className="hint">A outra pessoa marca cada item como feito, e a lista mostra o progresso para os dois.</p>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={() => void send()} disabled={busy || !title.trim() || !lines.length}>
            {busy ? 'Enviando…' : 'Enviar lista'}
          </button>
        </div>
      </div>
    </div>
  );
}
