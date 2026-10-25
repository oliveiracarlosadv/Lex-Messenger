import logoUrl from '../assets/logo.svg';
import type { StatusColor } from '../../shared/status';
import type { ContactKind } from '../../shared/types';

const COLORS: Record<StatusColor, [string, string]> = {
  online: ['#7ee05a', '#2f9a1c'],
  busy: ['#ff8f80', '#c4271a'],
  away: ['#ffd25a', '#e08a00'],
  offline: ['#d9d9d9', '#8c8c8c'],
};

/** Bonequinho de status (desenho próprio, no espírito dos mensageiros clássicos). */
export function Buddy({ presence = 'online', size = 18, title }: { presence?: StatusColor; size?: number; title?: string }) {
  const [light, dark] = COLORS[presence];
  const id = `b-${presence}`;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-label={title} role="img">
      <title>{title}</title>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="0.35" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
      </defs>
      <circle cx="10" cy="6" r="4.2" fill={`url(#${id})`} stroke={dark} strokeWidth="0.6" />
      <path d="M2.6 18.6c0-4.6 3.3-7.4 7.4-7.4s7.4 2.8 7.4 7.4z" fill={`url(#${id})`} stroke={dark} strokeWidth="0.6" />
      {presence === 'busy' && (
        <g>
          <circle cx="15.5" cy="15.5" r="4" fill="#fff" stroke="#b3261e" strokeWidth="0.8" />
          <rect x="13.2" y="14.8" width="4.6" height="1.5" rx="0.5" fill="#d1352a" />
        </g>
      )}
      {presence === 'away' && (
        <g>
          <circle cx="15.5" cy="15.5" r="4" fill="#fff" stroke="#c77700" strokeWidth="0.8" />
          <path d="M15.5 13.3v2.4l1.6 1" stroke="#c77700" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

export function KindIcon({ kind, color, size = 18, title }: { kind: ContactKind; color: StatusColor; size?: number; title?: string }) {
  if (kind === 'user') {
    const t = title ?? { online: 'Online', away: 'Ausente', busy: 'Ocupado', offline: 'Offline' }[color];
    return <Buddy presence={color} size={size} title={t} />;
  }
  const emoji = { group: '👥', channel: '📢', bot: '🤖', self: '⭐' }[kind];
  return (
    <span style={{ fontSize: size * 0.8, width: size, display: 'inline-block', textAlign: 'center', lineHeight: 1 }} aria-hidden>
      {emoji}
    </span>
  );
}

/** Logotipo: o mesmo desenho do ícone do app. */
export function Logo({ size = 64 }: { size?: number }) {
  return <img src={logoUrl} width={size} height={size} alt="Lex Messenger" draggable={false} />;
}
