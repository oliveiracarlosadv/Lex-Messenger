import { useEffect, useRef, useState } from 'react';
import type { StatusColor } from '../../shared/status';
import type { ContactKind } from '../../shared/types';
import { useAvatar } from './Avatar';
import { KindIcon } from './Icons';

/**
 * Ícone do contato: a foto dele, redonda, com uma borda da cor do status (como a moldura do MSN).
 * Sem foto, fica o bonequinho de sempre. A foto só é baixada quando o contato aparece na tela.
 */
export function ContactIcon({
  id,
  kind,
  color,
  hasPhoto,
  size = 26,
  title,
}: {
  id: string;
  kind: ContactKind;
  color: StatusColor;
  hasPhoto: boolean;
  size?: number;
  title?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasPhoto || visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasPhoto, visible]);

  const url = useAvatar(visible ? id : undefined, hasPhoto);
  const label = title ?? { online: 'Online', away: 'Ausente', busy: 'Ocupado', offline: 'Offline' }[color];
  const showStatus = kind === 'user';

  // Sem foto, ou foto que o Telegram não entregou (privacidade): bonequinho.
  if (!hasPhoto || url === null) {
    return (
      <span ref={ref} className="contact-icon-box" style={{ width: size, height: size }}>
        <KindIcon kind={kind} color={color} size={Math.round(size * 0.75)} title={label} />
      </span>
    );
  }
  return (
    <span
      ref={ref}
      className={`contact-photo ${showStatus ? `st-${color}` : 'st-none'}`}
      style={{ width: size, height: size }}
      title={showStatus ? label : undefined}
      role="img"
      aria-label={showStatus ? label : undefined}
    >
      {url ? <img src={url} alt="" /> : <span className="contact-photo-empty" />}
      {showStatus && <span className="contact-photo-dot" />}
    </span>
  );
}
