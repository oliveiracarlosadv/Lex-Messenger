import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../shared/types';
import { lex } from '../lib/api';
import { formatSize } from '../lib/format';

/** Vídeo tocando dentro da conversa (com controles e tela cheia). Nada é gravado em disco. */
export function VideoPlayer({ m, chatId }: { m: ChatMessage; chatId: string }) {
  const media = m.media!;
  const [thumb, setThumb] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const blobUrl = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    void lex.mediaPreview(chatId, m.id).then((u) => alive && setThumb(u));
    return () => {
      alive = false;
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    };
  }, [chatId, m.id]);

  const play = async () => {
    setState('loading');
    const data = await lex.mediaData(chatId, m.id).catch(() => null);
    if (!data) return setState('error');
    // data: URL → Blob na memória (mais leve para o player). Sem fetch(): a política de segurança bloqueia.
    const [head, b64] = data.split(',');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: head.slice(5, head.indexOf(';')) || 'video/mp4' });
    blobUrl.current = URL.createObjectURL(blob);
    setSrc(blobUrl.current);
    setState('ready');
  };

  const dur = media.duration ?? 0;
  const time = dur ? `${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, '0')}` : '';
  const ratio = media.width && media.height ? `${media.width} / ${media.height}` : '16 / 9';

  if (src) {
    return (
      <div className="video-player">
        <video src={src} controls autoPlay playsInline style={{ aspectRatio: ratio }} />
      </div>
    );
  }
  return (
    <div className="video-player">
      <button className="video-thumb" style={{ aspectRatio: ratio }} onClick={() => void play()} disabled={state === 'loading'} aria-label="Assistir ao vídeo">
        {thumb ? <img src={thumb} alt="" /> : <span className="pick-empty" />}
        <span className="video-play">{state === 'loading' ? '…' : state === 'error' ? '!' : '▶'}</span>
        <span className="video-meta">
          🎬 {time} {media.size ? `· ${formatSize(media.size)}` : ''}
        </span>
      </button>
      {state === 'error' && (
        <p className="hint">
          Não deu para tocar aqui (vídeo grande demais ou formato não suportado).{' '}
          <button className="link-btn" onClick={() => void lex.openMedia(chatId, m.id)}>
            Abrir em outro app
          </button>
        </p>
      )}
    </div>
  );
}
