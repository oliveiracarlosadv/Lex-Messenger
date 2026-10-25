// Modo demonstração (LEX_DEMO=1): contatos fictícios para testar as telas e tirar fotos para o manual.
// LEX_SNAPSHOT=<pasta> salva imagens das janelas e fecha o app.
import { app, BrowserWindow } from 'electron';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChatMessage, Contact, Me } from '../shared/types';
import { NUDGE_TEXT } from '../shared/types';
import type { TelegramService } from './telegram';

const now = Math.floor(Date.now() / 1000);
const me: Me = { id: '1', name: 'Carlos Oliveira', username: '', phone: '', about: 'Audiência às 14h ⚖️', hasPhoto: false };
const c = (id: string, name: string, kind: Contact['kind'], presence: Contact['presence'], subtitle: string, lastMessage: string, ago: number, unread = 0): Contact => ({
  id, name, kind, presence, subtitle, lastMessage, lastDate: now - ago, unread, hasPhoto: false, pinned: false,
});
const contacts: Contact[] = [
  c('101', 'Ana Paula', 'user', 'online', 'Online', 'Recebeu a petição?', 120, 2),
  c('102', 'Dr. Ricardo Lima', 'user', 'online', 'Online', 'Combinado, até amanhã', 3600),
  c('103', 'Juliana (Secretária)', 'user', 'away', 'visto hoje às 10:12', 'Agenda atualizada', 7200),
  c('104', 'Marcos Souza', 'user', 'offline', 'visto ontem às 21:40', 'Obrigado!', 90000),
  c('105', 'Fernanda Costa', 'user', 'offline', 'visto recentemente', '📎 contrato.pdf', 200000),
  c('-201', 'Escritório — Equipe', 'group', 'offline', '8 membros', 'Reunião às 9h', 1800, 5),
  c('-202', 'Turma OAB 2015', 'group', 'offline', '43 membros', '🎉 Parabéns!', 50000),
  c('1', 'Mensagens salvas', 'self', 'offline', 'suas anotações', 'lembrete: prazo dia 30', 400000),
];
const history: ChatMessage[] = [
  { id: 1, chatId: '101', out: false, senderId: '101', senderName: 'Ana Paula', date: now - 900, text: 'Oi, Carlos! Tudo bem? 😊' },
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
  t.history = async (id: string) => history.filter((m) => m.chatId === id);
  t.avatar = async () => null;
  t.markRead = () => {};
  t.typing = () => {};
  t.goOffline = async () => {};
  t.setStatus = async () => {};
}

export function snapshot(openChat: (id: string) => BrowserWindow, emit: (e: 'typing', d: { chatId: string; name: string }) => void) {
  const dir = process.env.LEX_SNAPSHOT;
  if (!dir) return;
  if (process.env.LEX_DEMO === 'login') return loginSnapshot();
  setTimeout(() => {
    const chat = openChat('101');
    setTimeout(() => emit('typing', { chatId: '101', name: 'Ana Paula' }), 1500);
    setTimeout(async () => {
      for (const w of BrowserWindow.getAllWindows()) {
        const img = await w.webContents.capturePage();
        const name = w === chat ? 'conversa.png' : 'contatos.png';
        writeFileSync(join(dir, name), img.toPNG());
      }
      app.exit(0);
    }, 3000);
  }, 2500);
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
