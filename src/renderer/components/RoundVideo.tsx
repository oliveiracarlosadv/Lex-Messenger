import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../shared/types';
import { lex } from '../lib/api';

/** Recado (vídeo redondo do Telegram): toca dentro da conversa, com o som. */
export function RoundVideo({ m, chatId }: { m: ChatMessage; chatId: string }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let alive = true;
    void lex.mediaPreview(chatId, m.id).then((u) => alive && setThumb(u));
    return () => {
      alive = false;
    };
  }, [chatId, m.id]);

  const toggle = async () => {
    const v = ref.current;
    if (state === 'playing') return v?.pause();
    if (!src) {
      setState('loading');
      const url = await lex.mediaData(chatId, m.id).catch(() => null);
      if (!url) return setState('error');
      setSrc(url);
      return; // o vídeo começa sozinho ao carregar (autoPlay)
    }
    await v?.play().catch(() => setState('error'));
  };

  const dur = m.media?.duration ?? 0;
  return (
    <button className="round-video" onClick={() => void toggle()} aria-label={state === 'playing' ? 'Pausar recado' : 'Tocar recado'}>
      {src ? (
        <video
          ref={ref}
          src={src}
          autoPlay
          playsInline
          onPlay={() => setState('playing')}
          onPause={() => setState('paused')}
          onEnded={() => {
            setState('idle');
            setProgress(0);
          }}
          onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || dur || 1))}
        />
      ) : thumb ? (
        <img src={thumb} alt="" />
      ) : (
        <span className="round-empty">⭕</span>
      )}
      <svg className="round-ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="48" pathLength="1" strokeDasharray={`${progress} 1`} />
      </svg>
      {state !== 'playing' && <span className="round-play">{state === 'loading' ? '…' : state === 'error' ? '!' : '▶'}</span>}
      <span className="round-time">
        {Math.floor(dur / 60)}:{String(Math.round(dur % 60)).padStart(2, '0')}
      </span>
    </button>
  );
}
