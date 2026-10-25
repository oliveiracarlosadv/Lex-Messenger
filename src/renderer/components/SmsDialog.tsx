import { useState } from 'react';
import { lex } from '../lib/api';

/** Mandar por SMS/RCS pelo app de mensagens do aparelho (o Lex não envia SMS sozinho). */
export function SmsDialog({ name, phone, text, onClose }: { name: string; phone?: string; text: string; onClose: () => void }) {
  const [num, setNum] = useState(phone ?? '');
  const [body, setBody] = useState(text);
  const valid = num.replace(/\D/g, '').length >= 8;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Enviar por SMS ou RCS">
        <h2>💬 Enviar por SMS / RCS</h2>
        <p className="hint">
          Abre o app de mensagens do {lex.features.mobile ? 'celular' : 'computador'} com o número e o texto prontos. Se os dois aparelhos
          tiverem RCS, ele envia por RCS; senão, por SMS (pode ter custo da operadora).
        </p>
        <label className="field">
          Número de {name}
          <input type="tel" value={num} placeholder="+55 91 98888-7777" onChange={(e) => setNum(e.target.value)} />
        </label>
        {!phone && <p className="hint">Esta pessoa não compartilha o número no Telegram: digite com DDD.</p>}
        <label className="field">
          Mensagem
          <textarea className="checklist-input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            disabled={!valid}
            onClick={() => {
              const n = num.trim().startsWith('+') ? num : `+55${num.replace(/\D/g, '')}`;
              lex.openSms(n, body);
              onClose();
            }}
          >
            Abrir no app de mensagens
          </button>
        </div>
      </div>
    </div>
  );
}
