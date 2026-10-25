// Contatos e conversas fictícios, para testar as telas e tirar fotos para o manual (Mac e Android).
import type { ChatMessage, Contact, Me } from './types';
import { NUDGE_TEXT } from './types';

const now = Math.floor(Date.now() / 1000);
export const me: Me = { id: '1', name: 'Carlos Oliveira', firstName: 'Carlos', lastName: 'Oliveira', username: '', phone: '', about: '🎵 Garota de Ipanema — Tom Jobim', hasPhoto: false, photoVersion: 0 };
const c = (id: string, name: string, kind: Contact['kind'], presence: Contact['presence'], subtitle: string, lastMessage: string, ago: number, unread = 0, about = ''): Contact => ({
  id, name, kind, presence, subtitle, lastMessage, lastDate: now - ago, unread, hasPhoto: false, pinned: false, about,
});
export const contacts: Contact[] = [
  { ...c('101', 'Ana Paula', 'user', 'online', 'Online', 'Recebeu a petição?', 120, 2, 'Prazo é prazo! 📚'), premium: true, readOutboxMaxId: 3 },
  c('102', 'Dr. Ricardo Lima', 'user', 'online', 'Online', 'Combinado, até amanhã', 3600, 0, '⛔ Ocupado · Em audiência'),
  c('106', 'Beatriz Mendes', 'user', 'online', 'Online', 'Bom dia!', 5000, 0, '🎵 Evidências — Chitãozinho & Xororó'),
  c('107', 'Paulo Henrique', 'user', 'online', 'Online', 'Já te ligo', 6000, 0, '🍽️ Em horário de almoço'),
  c('103', 'Juliana (Secretária)', 'user', 'away', 'visto hoje às 10:12', 'Agenda atualizada', 7200),
  c('104', 'Marcos Souza', 'user', 'offline', 'visto ontem às 21:40', 'Obrigado!', 90000),
  c('105', 'Fernanda Costa', 'user', 'offline', 'visto recentemente', '📎 contrato.pdf', 200000),
  c('-201', 'Escritório — Equipe', 'group', 'offline', '8 membros', 'Reunião às 9h', 1800, 5),
  { ...c('-202', 'Turma OAB 2015', 'group', 'offline', '43 membros', '🎉 Parabéns!', 50000, 12), muted: true },
  c('1', 'Mensagens salvas', 'self', 'offline', 'suas anotações', 'lembrete: prazo dia 30', 400000),
];
export const history: ChatMessage[] = [
  { id: 1, chatId: '101', out: false, senderId: '101', senderName: 'Ana Paula', date: now - 900, text: 'Oi, Carlos! Tudo bem? 😊' },
  { id: 7, chatId: '101', out: false, senderId: '101', senderName: 'Ana Paula', date: now - 895, text: 'Tem um minutinho?' },
  { id: 2, chatId: '101', out: true, senderId: '1', senderName: me.name, date: now - 840, text: 'Tudo ótimo, e você?' },
  { id: 3, chatId: '101', out: true, senderId: '1', senderName: me.name, date: now - 830, text: 'Mandei a minuta agora há pouco.', reactions: [{ emoji: '👍', count: 1, mine: false }] },
  { id: 8, chatId: '101', out: false, senderId: '101', senderName: 'Ana Paula', date: now - 700, text: '', media: { kind: 'voice', duration: 14, waveform: Array.from({ length: 100 }, (_, i) => Math.round(8 + 20 * Math.abs(Math.sin(i / 6)) * (i % 7 ? 1 : 0.4))) } },
  { id: 9, chatId: '101', out: true, senderId: '1', senderName: me.name, date: now - 650, text: 'Perfeito, vou revisar a cláusula 4.', replyTo: { id: 3, senderName: me.name, text: 'Mandei a minuta agora há pouco.' }, edited: true },
  { id: 4, chatId: '101', out: false, senderId: '101', senderName: 'Ana Paula', date: now - 600, text: '', media: { kind: 'file', name: 'peticao-inicial.pdf', size: 248000, mime: 'application/pdf' } },
  { id: 5, chatId: '101', out: false, senderId: '101', senderName: 'Ana Paula', date: now - 590, text: 'Recebeu a petição? Dá uma olhada em https://www.lexml.gov.br', media: { kind: 'webpage', link: { url: 'https://www.lexml.gov.br', site: 'LexML Brasil', title: 'LexML — Rede de Informação Legislativa e Jurídica', description: 'Portal especializado em informação jurídica e legislativa.', hasPhoto: false } } },
  { id: 10, chatId: '101', out: false, senderId: '101', senderName: 'Ana Paula', date: now - 300, text: '', media: { kind: 'video', round: true, duration: 12, width: 384, height: 384 } },
  { id: 6, chatId: '101', out: false, senderId: '101', senderName: 'Ana Paula', date: now - 120, text: NUDGE_TEXT, nudge: true },
];


// Fotos fictícias (desenhos com as iniciais), para conferir as telas.
const PHOTO_IDS = new Set(['101', '102', '106', '103', '-201']);
const demoPhoto = (id: string) => {
  const c = contacts.find((x) => x.id === id);
  const name = c?.name ?? 'Carlos Oliveira';
  const ini = name.split(/\s+/).filter((w) => /^[A-ZÀ-Ú]/.test(w)).slice(0, 2).map((w) => w[0]).join('');
  const hue = [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,72%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},60%,42%)"/></linearGradient></defs><rect width="96" height="96" fill="url(#g)"/><circle cx="48" cy="38" r="17" fill="rgba(255,255,255,.85)"/><path d="M16 92c2-22 16-32 32-32s30 10 32 32z" fill="rgba(255,255,255,.85)"/><text x="48" y="44" font-family="Arial" font-size="15" font-weight="700" text-anchor="middle" fill="hsl(${hue},50%,35%)">${ini}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};
for (const c of contacts) if (PHOTO_IDS.has(c.id)) c.hasPhoto = true;

/** Troca os métodos do motor por dados fictícios. */
export function applyDemo(tg: object, loggedOut = false) {
  const t = tg as Record<string, unknown>;
  t.authState = () => (loggedOut ? 'logged-out' : 'ready');
  t.init = async () => {};
  t.getMe = () => me;
  t.listContacts = () => contacts;
  t.getContact = (id: string) => contacts.find((x) => x.id === id) ?? null;
  t.history = async (id: string) => history.filter((m) => m.chatId === id).sort((a, b) => a.date - b.date);
  t.avatar = async (id: string) => (PHOTO_IDS.has(id) ? demoPhoto(id) : null);
  t.markRead = () => {};
  t.typing = () => {};
  t.goOffline = async () => {};
  t.setAppearOffline = async () => {};
  t.setBio = async () => {};
  t.refreshContact = () => {};
  t.accountSettings = async () => ({
    privacy: { lastSeen: 'contacts', photo: 'everybody', phone: 'nobody', invites: 'contacts', forwards: 'everybody', calls: 'contacts' },
    twoStep: true,
    blocked: [{ id: '900', name: 'Telemarketing' }],
    sessions: [
      { hash: '1', device: 'MacBook · macOS 27', app: 'Lex Messenger 0.4.0', place: 'Belém, Brasil', lastActive: now, current: true },
      { hash: '2', device: 'Samsung Galaxy · Android 16', app: 'Telegram Android 12.1', place: 'Belém, Brasil', lastActive: now - 3600, current: false },
    ],
  });
}
