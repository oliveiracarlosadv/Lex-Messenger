import { useEffect, useRef } from 'react';
import { lex } from '../lib/api';
import { Avatar } from './Avatar';
import { Logo } from './Icons';

export interface ToastProps {
  kind: 'message' | 'online' | 'nudge';
  chatId: string;
  title: string;
  body: string;
  avatarId: string;
  hasPhoto: boolean;
  name: string;
}

/** Janelinha que sobe no canto da tela, como no MSN. Some sozinha; clicar abre a conversa. */
export function Toast(p: ToastProps) {
  const timer = useRef<number>(0);
  const close = () => window.close();
  const arm = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(close, p.kind === 'online' ? 5000 : 7000);
  };
  useEffect(() => {
    document.body.classList.add('toast-body');
    arm();
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const open = () => {
    lex.openChat(p.chatId);
    close();
  };
  return (
    <div className={`toast toast-${p.kind}`} onMouseEnter={() => window.clearTimeout(timer.current)} onMouseLeave={arm}>
      <div className="toast-bar">
        <Logo size={14} />
        <span>Lex Messenger</span>
        <button className="toast-close" onClick={close} aria-label="Fechar aviso">
          ×
        </button>
      </div>
      <button className="toast-main" onClick={open}>
        <Avatar id={p.avatarId} name={p.name} hasPhoto={p.hasPhoto} size={44} />
        <div className="toast-text">
          {p.kind === 'online' ? (
            <>
              <b>{p.title}</b>
              <span>{p.body}</span>
            </>
          ) : p.kind === 'nudge' ? (
            <>
              <b>{p.title}</b>
              <span>📳 {p.body}</span>
            </>
          ) : (
            <>
              <b>{p.title} diz:</b>
              <span className="toast-msg">{p.body}</span>
            </>
          )}
        </div>
      </button>
    </div>
  );
}
