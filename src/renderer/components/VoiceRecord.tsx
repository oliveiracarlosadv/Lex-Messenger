import { useEffect, useRef, useState } from 'react';
import { lex } from '../lib/api';
import { VoiceRecorder } from '../lib/voice';

/**
 * Botão de gravar áudio.
 * - Segurar: grava; soltar envia; arrastar para a esquerda cancela.
 * - Mãos livres: um toque (ou arrastar para cima) grava sem segurar; depois é só tocar em Enviar.
 */
export function VoiceRecord({ chatId, onError, onSent }: { chatId: string; onError: (t: string) => void; onSent: () => void }) {
  const rec = useRef<VoiceRecorder | null>(null);
  const start = useRef({ x: 0, y: 0, t: 0 });
  const [mode, setMode] = useState<'idle' | 'hold' | 'free'>('idle');
  const [cancelHint, setCancelHint] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    if (mode === 'idle') return;
    const t = window.setInterval(() => tick((n) => n + 1), 100);
    return () => window.clearInterval(t);
  }, [mode]);

  useEffect(() => () => rec.current?.cancel(), []);

  const begin = async (e: React.PointerEvent<HTMLButtonElement>) => {
    if (mode !== 'idle') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (!(await lex.askMicrophone())) {
      onError('Sem acesso ao microfone. No Mac: Ajustes do Sistema > Privacidade e Segurança > Microfone.');
      return;
    }
    const r = new VoiceRecorder();
    try {
      await r.start();
    } catch {
      onError('Não consegui usar o microfone. Verifique a permissão de microfone do Lex Messenger.');
      return;
    }
    rec.current = r;
    setMode('hold');
  };

  const move = (e: React.PointerEvent) => {
    if (mode !== 'hold') return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    setCancelHint(dx < -60);
    if (dy < -50) setMode('free'); // arrastou para cima: mãos livres
  };

  const end = (e: React.PointerEvent) => {
    if (mode !== 'hold') return;
    const dx = e.clientX - start.current.x;
    const quick = performance.now() - start.current.t < 350;
    if (dx < -60) return cancel();
    if (quick) return setMode('free'); // um toque: continua gravando sem segurar
    void finish();
  };

  const cancel = () => {
    rec.current?.cancel();
    rec.current = null;
    setCancelHint(false);
    setMode('idle');
  };

  const finish = async () => {
    const r = rec.current;
    rec.current = null;
    setMode('idle');
    setCancelHint(false);
    if (!r) return;
    if (r.elapsed < 0.7) return onError('Áudio muito curto. Segure o 🎤 enquanto fala, ou toque uma vez para gravar sem segurar.');
    try {
      const v = await r.stop();
      if (v) {
        await lex.sendVoice(chatId, v.ogg, v.duration, v.waveform);
        onSent();
      }
    } catch {
      onError('Não foi possível enviar o áudio.');
    }
  };

  const secs = rec.current?.elapsed ?? 0;
  const time = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
  const level = rec.current?.level ?? 0;

  return (
    <>
      {mode !== 'idle' && (
        <div className={`rec-bar ${cancelHint ? 'cancel' : ''}`} role="status">
          <span className="rec-dot" style={{ transform: `scale(${1 + level * 0.8})` }} />
          <span className="rec-time">{time}</span>
          {mode === 'hold' ? (
            <span className="rec-hint">{cancelHint ? 'Solte para cancelar' : 'Solte para enviar · ← cancela · ↑ mãos livres'}</span>
          ) : (
            <>
              <span className="rec-hint">🔒 Mãos livres: gravando</span>
              <button className="btn rec-cancel" onClick={cancel}>
                🗑 Cancelar
              </button>
              <button className="btn btn-primary rec-send" onClick={() => void finish()}>
                Enviar ➤
              </button>
            </>
          )}
        </div>
      )}
      <button
        className={`btn btn-mic ${mode !== 'idle' ? 'recording' : ''}`}
        onPointerDown={(e) => void begin(e)}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={() => mode === 'hold' && cancel()}
        title="Segure para gravar um áudio, ou toque uma vez para gravar com as mãos livres"
        aria-label="Gravar áudio"
        style={mode === 'free' ? { visibility: 'hidden' } : undefined}
      >
        🎤
      </button>
    </>
  );
}
