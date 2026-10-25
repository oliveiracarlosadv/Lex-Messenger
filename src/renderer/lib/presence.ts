import { displayColor, parseBio, STATUS } from '../../shared/status';
import type { Contact } from '../../shared/types';

/** Cor, rótulo e mensagem pessoal de um contato, prontos para a tela. */
export function describe(c: Contact) {
  const bio = parseBio(c.about);
  const color = c.kind === 'user' ? displayColor(c.presence, bio.status ?? c.status) : 'offline';
  const st = bio.status ?? c.status;
  let label = '';
  if (c.kind === 'user' && c.presence !== 'offline') {
    if (st && st !== 'online' && st !== 'invisible') label = STATUS[st].label;
    else if (c.presence === 'away') label = 'Ausente';
  }
  const personal = bio.music ? `🎵 ${bio.music}` : bio.text;
  return { color, label, personal, music: bio.music };
}
