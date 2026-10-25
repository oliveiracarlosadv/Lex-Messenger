import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChatMessage, Contact } from '../../shared/types';
import { lex } from '../lib/api';
import { ContactIcon } from './ContactIcon';
import { describe } from '../lib/presence';

export interface MenuState {
  m: ChatMessage;
  x: number;
  y: number;
}

interface MenuProps {
  state: MenuState;
  reactions: string[];
  canDeleteForAll: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  onForward: () => void;
  onDelete: (forEveryone: boolean) => void;
}

/** Menu de uma mensagem (botão direito no computador, toque longo no celular). */
export function MessageMenu(p: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: p.state.x, top: p.state.y });

  // Mantém o menu dentro da janela.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(6, Math.min(p.state.x, window.innerWidth - r.width - 6)),
      top: Math.max(6, Math.min(p.state.y, window.innerHeight - r.height - 6)),
    });
  }, [p.state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && p.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p]);

  const act = (fn: () => void) => () => {
    p.onClose();
    fn();
  };

  return (
    <div className="menu-back" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()} onContextMenu={(e) => e.preventDefault()}>
      <div className="msg-menu" ref={ref} style={pos} role="menu">
        <div className="menu-reactions">
          {p.reactions.map((r) => (
            <button key={r} onClick={act(() => p.onReact(r))} aria-label={`Reagir com ${r}`}>
              {r}
            </button>
          ))}
        </div>
        <button role="menuitem" onClick={act(p.onReply)}>
          ↩ Responder
        </button>
        {p.onCopy && (
          <button role="menuitem" onClick={act(p.onCopy)}>
            📋 Copiar texto
          </button>
        )}
        <button role="menuitem" onClick={act(p.onForward)}>
          ↪ Encaminhar…
        </button>
        {p.onEdit && (
          <button role="menuitem" onClick={act(p.onEdit)}>
            ✏️ Editar
          </button>
        )}
        <hr />
        <button role="menuitem" className="danger" onClick={act(() => p.onDelete(false))}>
          🗑 Apagar para mim
        </button>
        {p.canDeleteForAll && (
          <button role="menuitem" className="danger" onClick={act(() => p.onDelete(true))}>
            🗑 Apagar para todos
          </button>
        )}
      </div>
    </div>
  );
}

/** Escolher a conversa para onde encaminhar. */
export function ForwardDialog({ onClose, onPick }: { onClose: () => void; onPick: (id: string, name: string) => void }) {
  const [list, setList] = useState<Contact[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    void lex.contacts().then((c) => setList(c.filter((x) => x.kind !== 'channel').sort((a, b) => b.lastDate - a.lastDate)));
  }, []);
  const shown = list.filter((c) => c.name.toLocaleLowerCase('pt-BR').includes(q.trim().toLocaleLowerCase('pt-BR'))).slice(0, 80);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Encaminhar para">
        <h2>Encaminhar para…</h2>
        <input className="about-input" autoFocus placeholder="🔍 Procurar" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="pick-list">
          {shown.map((c) => (
            <button key={c.id} className="pick-item" onClick={() => onPick(c.id, c.name)}>
              <ContactIcon id={c.id} kind={c.kind} color={describe(c).color} hasPhoto={c.hasPhoto} />
              <span>{c.name}</span>
            </button>
          ))}
          {!shown.length && <p className="muted center">Nenhuma conversa encontrada.</p>}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
