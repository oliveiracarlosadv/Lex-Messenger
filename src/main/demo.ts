// Modo demonstração (LEX_DEMO=1): contatos fictícios para testar as telas e tirar fotos para o manual.
// LEX_SNAPSHOT=<pasta> salva imagens das janelas e fecha o app.
import { app, BrowserWindow } from 'electron';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChatMessage, Contact, Me } from '../shared/types';
import { NUDGE_TEXT } from '../shared/types';
import type { TelegramService } from './telegram';

const now = Math.floor(Date.now() / 1000);
const me: Me = { id: '1', name: 'Carlos Oliveira', firstName: 'Carlos', lastName: 'Oliveira', username: '', phone: '', about: '🎵 Garota de Ipanema — Tom Jobim', hasPhoto: false, photoVersion: 0 };
const c = (id: string, name: string, kind: Contact['kind'], presence: Contact['presence'], subtitle: string, lastMessage: string, ago: number, unread = 0, about = ''): Contact => ({
  id, name, kind, presence, subtitle, lastMessage, lastDate: now - ago, unread, hasPhoto: false, pinned: false, about,
});
const contacts: Contact[] = [
  c('101', 'Ana Paula', 'user', 'online', 'Online', 'Recebeu a petição?', 120, 2, 'Prazo é prazo! 📚'),
  c('102', 'Dr. Ricardo Lima', 'user', 'online', 'Online', 'Combinado, até amanhã', 3600, 0, '⛔ Ocupado · Em audiência'),
  c('106', 'Beatriz Mendes', 'user', 'online', 'Online', 'Bom dia!', 5000, 0, '🎵 Evidências — Chitãozinho & Xororó'),
  c('107', 'Paulo Henrique', 'user', 'online', 'Online', 'Já te ligo', 6000, 0, '🍽️ Em horário de almoço'),
  c('103', 'Juliana (Secretária)', 'user', 'away', 'visto hoje às 10:12', 'Agenda atualizada', 7200),
  c('104', 'Marcos Souza', 'user', 'offline', 'visto ontem às 21:40', 'Obrigado!', 90000),
  c('105', 'Fernanda Costa', 'user', 'offline', 'visto recentemente', '📎 contrato.pdf', 200000),
  c('-201', 'Escritório — Equipe', 'group', 'offline', '8 membros', 'Reunião às 9h', 1800, 5),
  c('-202', 'Turma OAB 2015', 'group', 'offline', '43 membros', '🎉 Parabéns!', 50000),
  c('1', 'Mensagens salvas', 'self', 'offline', 'suas anotações', 'lembrete: prazo dia 30', 400000),
];
const history: ChatMessage[] = [
  { id: 1, chatId: '101', out: false, senderId: '101', senderName: 'Ana Paula', date: now - 900, text: 'Oi, Carlos! Tudo bem? 😊' },
  { id: 7, chatId: '101', out: false, senderId: '101', senderName: 'Ana Paula', date: now - 895, text: 'Tem um minutinho?' },
  { id: 2, chatId: '101', out: true, senderId: '1', senderName: me.name, date: now - 840, text: 'Tudo ótimo, e você?' },
  { id: 3, chatId: '101', out: true, senderId: '1', senderName: me.name, date: now - 830, text: 'Mandei a minuta agora há pouco.' },
  { id: 4, chatId: '101', out: false, senderId: '101', senderName: 'Ana Paula', date: now - 600, text: '', media: { kind: 'file', name: 'peticao-inicial.pdf', size: 248000, mime: 'application/pdf' } },
  { id: 5, chatId: '101', out: false, senderId: '101', senderName: 'Ana Paula', date: now - 590, text: 'Recebeu a petição? Dá uma olhada em https://www.lexml.gov.br' },
  { id: 6, chatId: '101', out: false, senderId: '101', senderName: 'Ana Paula', date: now - 120, text: NUDGE_TEXT, nudge: true },
];

export function enableDemo(tg: TelegramService) {
  const t = tg as unknown as Record<string, unknown>;
  t.authState = () => (process.env.LEX_DEMO === 'login' ? 'logged-out' : 'ready');
  t.init = async () => {};
  t.getMe = () => me;
  t.listContacts = () => contacts;
  t.getContact = (id: string) => contacts.find((x) => x.id === id) ?? null;
  t.history = async (id: string) => history.filter((m) => m.chatId === id).sort((a, b) => a.date - b.date);
  t.avatar = async () => null;
  t.markRead = () => {};
  t.typing = () => {};
  t.goOffline = async () => {};
  t.setStatus = async () => {};
}

interface SnapHooks {
  openChat: (id: string) => BrowserWindow;
  emit: (e: 'typing', d: { chatId: string; name: string }) => void;
  list: () => BrowserWindow | null;
  toast: () => void;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function snapshot(h: SnapHooks) {
  const dir = process.env.LEX_SNAPSHOT;
  if (!dir) return;
  if (process.env.LEX_DEMO === 'login') return loginSnapshot();
  void (async () => {
    await wait(2500);
    const list = h.list()!;
    list.webContents.send('presence:changed', { status: 'online', effective: 'online', autoAway: false, music: 'Garota de Ipanema — Tom Jobim' });
    list.webContents.send('prefs:changed', { sounds: true, notifications: true, onlineAlerts: true, status: 'online', personalMessage: 'Audiência às 14h ⚖️', shareMusic: true, autoAway: true });
    // Confere se o som pode tocar sem clique (política de autoplay liberada).
    const audio = await list.webContents.executeJavaScript('(async () => { const c = new AudioContext(); await new Promise(r => setTimeout(r, 300)); return c.state; })()');
    console.log('som:', audio);
    const chat = h.openChat('101');
    await wait(1500);
    h.emit('typing', { chatId: '101', name: 'Ana Paula' });
    await wait(1500);
    writeFileSync(join(dir, 'contatos.png'), (await list.webContents.capturePage()).toPNG());
    writeFileSync(join(dir, 'conversa.png'), (await chat.webContents.capturePage()).toPNG());
    list.webContents.send('profile:open', true);
    h.toast();
    await wait(2000);
    writeFileSync(join(dir, 'perfil.png'), (await list.webContents.capturePage()).toPNG());
    const toastWin = BrowserWindow.getAllWindows().find((w) => w !== list && w !== chat);
    if (toastWin) writeFileSync(join(dir, 'aviso.png'), (await toastWin.webContents.capturePage()).toPNG());
    app.exit(0);
  })();
}

export function loginSnapshot() {
  const dir = process.env.LEX_SNAPSHOT;
  if (!dir) return;
  setTimeout(async () => {
    const [w] = BrowserWindow.getAllWindows();
    writeFileSync(join(dir, 'entrada.png'), (await w.webContents.capturePage()).toPNG());
    app.exit(0);
  }, 3000);
}
