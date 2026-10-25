// Status no estilo MSN. O Telegram só conhece "online" e "offline"; os demais status viajam como um
// sinal no começo da bio ("⛔ Ocupado · texto"), que outro Lex Messenger reconhece.

export type MyStatus = 'online' | 'busy' | 'away' | 'brb' | 'lunch' | 'phone' | 'invisible';
export type StatusColor = 'online' | 'busy' | 'away' | 'offline';

export const STATUS: Record<MyStatus, { label: string; emoji: string; color: StatusColor }> = {
  online: { label: 'Disponível', emoji: '', color: 'online' },
  busy: { label: 'Ocupado', emoji: '⛔', color: 'busy' },
  away: { label: 'Ausente', emoji: '🕒', color: 'away' },
  brb: { label: 'Volto já', emoji: '↩️', color: 'away' },
  lunch: { label: 'Em horário de almoço', emoji: '🍽️', color: 'away' },
  phone: { label: 'Ao telefone', emoji: '📞', color: 'busy' },
  invisible: { label: 'Aparecer offline', emoji: '', color: 'offline' },
};

export const STATUS_ORDER: MyStatus[] = ['online', 'busy', 'away', 'brb', 'lunch', 'phone', 'invisible'];

/** Tamanho máximo da bio para contas comuns do Telegram. */
export const BIO_MAX = 70;
const SEP = ' · ';
const MUSIC = '🎵 ';

const tagOf = (s: MyStatus) => (STATUS[s].emoji ? `${STATUS[s].emoji} ${STATUS[s].label}` : '');

/** Monta a bio: [status] · [🎵 música | mensagem pessoal]. */
export function composeBio(status: MyStatus, text: string, music?: string | null): string {
  const tag = status === 'invisible' ? '' : tagOf(status);
  const body = music && status !== 'invisible' ? MUSIC + music : text.trim();
  let bio = [tag, body].filter(Boolean).join(SEP);
  // O Telegram mede em unidades UTF-16 (alguns emojis valem 2): corta até caber.
  if (bio.length > BIO_MAX) {
    const chars = [...bio];
    while (chars.join('').length > BIO_MAX - 1) chars.pop();
    bio = chars.join('').trimEnd() + '…';
  }
  return bio;
}

export interface ParsedBio {
  status?: MyStatus;
  text: string;
  music?: string;
}

/** Lê uma bio montada pelo Lex Messenger (ou uma bio comum, que vira só texto). */
export function parseBio(bio: string | undefined): ParsedBio {
  let rest = (bio ?? '').trim();
  let status: MyStatus | undefined;
  for (const s of STATUS_ORDER) {
    const tag = tagOf(s);
    if (!tag) continue;
    if (rest === tag || rest.startsWith(tag + SEP)) {
      status = s;
      rest = rest.slice(tag.length + (rest === tag ? 0 : SEP.length));
      break;
    }
  }
  if (rest.startsWith(MUSIC)) return { status, text: '', music: rest.slice(MUSIC.length) };
  return { status, text: rest };
}

/** Cor do bonequinho de um contato: o status do Lex só vale enquanto o Telegram diz que ele está ativo. */
export function displayColor(presence: 'online' | 'away' | 'offline', status?: MyStatus): StatusColor {
  if (presence === 'offline') return 'offline';
  if (status && status !== 'online' && status !== 'invisible') return STATUS[status].color;
  return presence;
}
