import { useEffect } from 'react';
import { Avatar } from './Avatar';

export interface NudgeData {
  chatId: string;
  name: string;
  hasPhoto: boolean;
}

/** Aviso de "chamou a sua atenção", perguntando se quer abrir a conversa. */
export function NudgePopup({ data, onOpen, onClose }: { data: NudgeData; onOpen: () => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onOpen();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen, onClose]);

  return (
    <div className="nudge-popup" role="alertdialog" aria-labelledby="nudge-title">
      <div className="toast-bar nudge-bar">
        <span>📳 Lex Messenger</span>
      </div>
      <div className="nudge-body">
        <Avatar id={data.chatId} name={data.name} hasPhoto={data.hasPhoto} size={52} />
        <div>
          <b id="nudge-title">{data.name} chamou a sua atenção!</b>
          <span>Deseja abrir a conversa?</span>
        </div>
      </div>
      <div className="nudge-actions">
        <button className="btn" onClick={onClose}>
          Agora não
        </button>
        <button className="btn btn-primary" onClick={onOpen} autoFocus>
          Abrir conversa
        </button>
      </div>
    </div>
  );
}
