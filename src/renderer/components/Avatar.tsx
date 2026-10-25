import { useEffect, useState } from 'react';
import { lex } from '../lib/api';

const cache = new Map<string, Promise<string | null>>();

export function useAvatar(id: string | undefined, hasPhoto: boolean | undefined, version = 0) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!id || !hasPhoto) return;
    let alive = true;
    const key = `${id}:${version}`;
    if (!cache.has(key)) cache.set(key, lex.avatar(id));
    void cache.get(key)!.then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id, hasPhoto, version]);
  return url;
}

const PALETTE = ['#4f9be8', '#57b84a', '#e8964f', '#b05ad6', '#d65a7a', '#3fb6b0', '#7a86d6'];

function hue(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Foto em moldura, como nos mensageiros antigos. Sem foto: iniciais sobre degradê. */
export function Avatar({ id, name, hasPhoto, size = 96, version }: { id?: string; name: string; hasPhoto?: boolean; size?: number; version?: number }) {
  const url = useAvatar(id, hasPhoto, version);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const color = hue(name);
  return (
    <div className="avatar-frame" style={{ width: size + 10, height: size + 10 }}>
      {url ? (
        <img src={url} alt={name} width={size} height={size} />
      ) : (
        <div
          className="avatar-fallback"
          style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(160deg, #fff -30%, ${color} 70%)` }}
        >
          {initials || '?'}
        </div>
      )}
    </div>
  );
}
