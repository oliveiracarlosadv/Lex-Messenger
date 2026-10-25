// Conexão com o Telegram (conta do próprio usuário, via MTProto/GramJS).
import { app, nativeImage, shell } from 'electron';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir, release } from 'node:os';
import { basename, extname, join } from 'node:path';
import { Api, TelegramClient, utils } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, NewMessageEvent, Raw } from 'telegram/events';
import { LogLevel } from 'telegram/extensions/Logger';
import { CustomFile } from 'telegram/client/uploads';
import type { Entity } from 'telegram/define';
import {
  NUDGE_TEXT,
  type AuthState,
  type ChatMessage,
  type Contact,
  type LexEvents,
  type LoginStep,
  type MediaInfo,
  type Me,
  type Presence,
} from '../shared/types';
import { parseBio } from '../shared/status';
import { clearSession, loadSession, saveSession } from './store';

declare const __API_ID__: string;
declare const __API_HASH__: string;
declare const __APP_VERSION__: string;

const API_ID = Number(__API_ID__);
const API_HASH = __API_HASH__;
const AWAY_AFTER_MS = 10 * 60 * 1000;

export interface Hooks {
  emit<K extends keyof LexEvents>(event: K, data: LexEvents[K]): void;
  /** Uma mensagem chegou de outra pessoa. */
  onIncoming(msg: ChatMessage, contact: Contact | undefined): void;
  /** Um contato acabou de ficar online. */
  onContactOnline(contact: Contact): void;
  isChatOpenAndFocused(chatId: string): boolean;
  unreadChanged(total: number): void;
  /** Login concluído e contatos carregados. */
  ready(me: Me): void;
}

class Cancelled extends Error {}

const ERRORS: Record<string, string> = {
  PHONE_NUMBER_INVALID: 'Número de telefone inválido. Use o formato +55 DDD número.',
  PHONE_CODE_INVALID: 'Código incorreto. Confira e tente de novo.',
  PHONE_CODE_EXPIRED: 'O código expirou. Peça um novo.',
  PHONE_CODE_EMPTY: 'Digite o código recebido.',
  PASSWORD_HASH_INVALID: 'Senha de verificação em duas etapas incorreta.',
  PHONE_NUMBER_BANNED: 'Este número está bloqueado pelo Telegram.',
  PHONE_NUMBER_UNOCCUPIED: 'Este número ainda não tem conta no Telegram. Crie a conta no app oficial primeiro.',
  API_ID_INVALID: 'As chaves do aplicativo (API ID/HASH) são inválidas.',
};

function friendlyError(err: unknown): string {
  const e = err as { errorMessage?: string; message?: string; seconds?: number };
  const code = e?.errorMessage ?? '';
  if (code.startsWith('FLOOD_WAIT') || e?.seconds) {
    const s = e.seconds ?? 60;
    return `Muitas tentativas. Aguarde ${s >= 120 ? Math.ceil(s / 60) + ' minutos' : s + ' segundos'} e tente de novo.`;
  }
  return ERRORS[code] ?? (code || e?.message || 'Erro desconhecido.');
}

const RETRYABLE = new Set([
  'PHONE_NUMBER_INVALID',
  'PHONE_CODE_INVALID',
  'PHONE_CODE_EMPTY',
  'PHONE_CODE_EXPIRED',
  'PASSWORD_HASH_INVALID',
]);

function fullName(e: Entity | undefined): string {
  if (!e) return 'Desconhecido';
  if (e instanceof Api.User) {
    if (e.self) return 'Mensagens salvas';
    if (e.deleted) return 'Conta excluída';
    return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.username || e.phone || 'Sem nome';
  }
  return (e as Api.Chat).title ?? 'Sem nome';
}

function fmtTime(sec: number): string {
  const d = new Date(sec * 1000);
  const now = new Date();
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `hoje às ${hm}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `ontem às ${hm}`;
  return `em ${d.toLocaleDateString('pt-BR')}`;
}

function presenceOf(status: Api.TypeUserStatus | undefined): { presence: Presence; subtitle: string; wasOnline?: number } {
  if (status instanceof Api.UserStatusOnline) return { presence: 'online', subtitle: 'Online' };
  if (status instanceof Api.UserStatusOffline) {
    const recent = Date.now() - status.wasOnline * 1000 < AWAY_AFTER_MS;
    return { presence: recent ? 'away' : 'offline', subtitle: `visto ${fmtTime(status.wasOnline)}`, wasOnline: status.wasOnline };
  }
  if (status instanceof Api.UserStatusRecently) return { presence: 'offline', subtitle: 'visto recentemente' };
  if (status instanceof Api.UserStatusLastWeek) return { presence: 'offline', subtitle: 'visto na última semana' };
  if (status instanceof Api.UserStatusLastMonth) return { presence: 'offline', subtitle: 'visto no último mês' };
  return { presence: 'offline', subtitle: '' };
}

function mediaOf(msg: Api.Message): MediaInfo | undefined {
  const m = msg.media;
  if (!m) return undefined;
  if (m instanceof Api.MessageMediaPhoto) return { kind: 'photo', name: `foto-${msg.id}.jpg`, mime: 'image/jpeg' };
  if (m instanceof Api.MessageMediaDocument && m.document instanceof Api.Document) {
    const doc = m.document;
    const info: MediaInfo = { kind: 'file', mime: doc.mimeType, size: Number(doc.size) };
    for (const a of doc.attributes) {
      if (a instanceof Api.DocumentAttributeFilename) info.name = a.fileName;
      if (a instanceof Api.DocumentAttributeSticker) info.kind = 'sticker';
      if (a instanceof Api.DocumentAttributeVideo && info.kind === 'file') info.kind = 'video';
      if (a instanceof Api.DocumentAttributeAudio) info.kind = a.voice ? 'voice' : 'audio';
    }
    if (!info.name) {
      const ext = (doc.mimeType.split('/')[1] ?? 'bin').replace('mpeg', 'mp3').replace('quicktime', 'mov');
      const label = { video: 'video', audio: 'audio', voice: 'audio', sticker: 'figurinha' }[info.kind as string] ?? 'arquivo';
      info.name = `${label}-${msg.id}.${ext}`;
    }
    return info;
  }
  if (m instanceof Api.MessageMediaWebPage) return undefined;
  return { kind: 'other' };
}

function mediaLabel(media: MediaInfo | undefined): string {
  if (!media) return '';
  return (
    { photo: '📷 Foto', video: '🎬 Vídeo', audio: '🎵 Áudio', voice: '🎤 Mensagem de voz', sticker: '🙂 Figurinha', file: '📎 ' + (media.name ?? 'Arquivo'), other: '📎 Anexo' }[media.kind] ?? ''
  );
}

function serviceText(action: Api.TypeMessageAction): string {
  if (action instanceof Api.MessageActionChatAddUser) return 'entrou no grupo';
  if (action instanceof Api.MessageActionChatJoinedByLink) return 'entrou no grupo pelo link';
  if (action instanceof Api.MessageActionChatDeleteUser) return 'saiu do grupo';
  if (action instanceof Api.MessageActionChatEditTitle) return `mudou o nome do grupo para "${action.title}"`;
  if (action instanceof Api.MessageActionChatEditPhoto) return 'mudou a foto do grupo';
  if (action instanceof Api.MessageActionPinMessage) return 'fixou uma mensagem';
  if (action instanceof Api.MessageActionPhoneCall) return '📞 chamada de voz';
  if (action instanceof Api.MessageActionChatCreate) return `criou o grupo "${action.title}"`;
  if (action instanceof Api.MessageActionContactSignUp) return 'entrou no Telegram';
  if (action instanceof Api.MessageActionScreenshotTaken) return 'tirou uma captura de tela';
  if (action instanceof Api.MessageActionHistoryClear) return 'limpou o histórico';
  if (action instanceof Api.MessageActionChatJoinedByRequest) return 'entrou no grupo';
  if (action instanceof Api.MessageActionGroupCall) return '📞 chamada em grupo';
  if (action instanceof Api.MessageActionSetMessagesTTL)
    return action.period ? 'ativou as mensagens temporárias' : 'desativou as mensagens temporárias';
  if (action instanceof Api.MessageActionChannelCreate) return `criou o canal "${action.title}"`;
  // Eventos técnicos (pagamentos, temas, etc.) não aparecem na conversa.
  return '';
}

export class TelegramService {
  private client: TelegramClient | null = null;
  private state: AuthState = 'logged-out';
  private pending: { resolve: (v: string) => void; reject: (e: Error) => void } | null = null;
  private loginError = '';
  private cancelled = false;
  private contacts = new Map<string, Contact>();
  private entities = new Map<string, Entity>();
  private wasOnline = new Map<string, number>();
  private avatars = new Map<string, string | null>();
  private previews = new Map<string, string | null>();
  private downloaded = new Map<string, string>();
  private me: Me | null = null;
  private appearOffline = false;
  private abouts = new Map<string, string>();
  private aboutQueue: string[] = [];
  private aboutTimer: NodeJS.Timeout | null = null;
  private timers: NodeJS.Timeout[] = [];
  private reloadTimer: NodeJS.Timeout | null = null;
  private lastTypingSent = new Map<string, number>();

  constructor(private hooks: Hooks) {}

  get hasKeys() {
    return Number.isFinite(API_ID) && API_ID > 0 && API_HASH.length > 10;
  }

  authState(): AuthState {
    return this.hasKeys ? this.state : 'missing-keys';
  }

  private setState(s: AuthState) {
    this.state = s;
    this.hooks.emit('auth:state', this.authState());
  }

  private newClient(session = '') {
    const client = new TelegramClient(new StringSession(session), API_ID, API_HASH, {
      connectionRetries: 10,
      deviceModel: process.platform === 'darwin' ? 'Lex Messenger (Mac)' : 'Lex Messenger (Windows)',
      systemVersion: `${process.platform === 'darwin' ? 'macOS' : 'Windows'} ${release()}`,
      appVersion: __APP_VERSION__,
      langCode: 'pt',
      systemLangCode: 'pt-BR',
      autoReconnect: true,
    });
    client.setLogLevel(LogLevel.ERROR);
    client.setParseMode(undefined);
    return client;
  }

  /** Ao abrir o app: reaproveita a sessão salva, se houver. */
  async init(appearOffline: boolean) {
    this.appearOffline = appearOffline;
    if (!this.hasKeys) return this.setState('logged-out');
    const saved = loadSession();
    if (!saved) return this.setState('logged-out');
    this.setState('connecting');
    try {
      this.client = this.newClient(saved);
      await this.client.connect();
      if (await this.client.checkAuthorization()) return await this.afterLogin();
    } catch (e) {
      console.error('Falha ao reconectar:', e);
    }
    await this.client?.destroy().catch(() => {});
    this.client = null;
    this.setState('logged-out');
  }

  // ---------- Login ----------

  private ask(step: LoginStep): Promise<string> {
    if (this.cancelled) return Promise.reject(new Cancelled());
    const withError = { ...step, error: this.loginError || undefined } as LoginStep;
    this.loginError = '';
    this.hooks.emit('login:step', withError);
    return new Promise((resolve, reject) => (this.pending = { resolve, reject }));
  }

  answer(value: string) {
    const p = this.pending;
    this.pending = null;
    p?.resolve(value.trim());
  }

  async cancelLogin() {
    this.cancelled = true;
    this.pending?.reject(new Cancelled());
    this.pending = null;
    if (this.state !== 'ready') {
      await this.client?.destroy().catch(() => {});
      this.client = null;
      this.setState('logged-out');
    }
  }

  async login(method: 'phone' | 'qr') {
    if (!this.hasKeys) return;
    await this.cancelLogin();
    this.cancelled = false;
    this.loginError = '';
    const client = this.newClient();
    this.client = client;
    const onError = async (err: Error) => {
      if (this.cancelled || err instanceof Cancelled) return true;
      const code = (err as { errorMessage?: string }).errorMessage ?? '';
      this.loginError = friendlyError(err);
      if (code === 'SESSION_PASSWORD_NEEDED') return false;
      if (RETRYABLE.has(code) || code.startsWith('FLOOD_WAIT')) return false;
      if (method === 'qr' && (code === 'AUTH_TOKEN_EXPIRED' || !code)) return false;
      this.hooks.emit('login:step', { step: 'failed', error: this.loginError });
      return true;
    };
    try {
      await client.connect();
      if (method === 'qr') {
        await client.signInUserWithQrCode(
          { apiId: API_ID, apiHash: API_HASH },
          {
            qrCode: async ({ token, expires }) => {
              this.hooks.emit('login:step', {
                step: 'qr',
                url: `tg://login?token=${token.toString('base64url')}`,
                expires,
                error: this.loginError || undefined,
              });
              this.loginError = '';
            },
            password: (hint) => this.ask({ step: 'password', hint }),
            onError,
          },
        );
      } else {
        await client.start({
          phoneNumber: () => this.ask({ step: 'phone' }),
          phoneCode: (viaApp) => this.ask({ step: 'code', viaApp: !!viaApp }),
          password: (hint) => this.ask({ step: 'password', hint }),
          firstAndLastNames: async () => {
            throw new Error('Este número ainda não tem conta no Telegram. Crie a conta no app oficial primeiro.');
          },
          onError,
        });
      }
      if (this.cancelled) return;
      saveSession((client.session as StringSession).save());
      this.hooks.emit('login:step', { step: 'done' });
      await this.afterLogin();
    } catch (e) {
      if (this.cancelled || e instanceof Cancelled) return;
      console.error('Falha no login:', e);
      this.hooks.emit('login:step', { step: 'failed', error: this.loginError || friendlyError(e) });
      await client.destroy().catch(() => {});
      if (this.client === client) this.client = null;
      this.setState('logged-out');
    }
  }

  async logout() {
    this.stopTimers();
    try {
      await this.client?.invoke(new Api.auth.LogOut());
    } catch {
      /* sem conexão: apaga só a sessão local */
    }
    await this.client?.destroy().catch(() => {});
    this.client = null;
    clearSession();
    this.contacts.clear();
    this.entities.clear();
    this.avatars.clear();
    this.previews.clear();
    this.me = null;
    this.abouts.clear();
    this.aboutQueue = [];
    this.hooks.unreadChanged(0);
    this.setState('logged-out');
  }

  // ---------- Depois do login ----------

  private async afterLogin() {
    const client = this.client!;
    client.addEventHandler((ev: NewMessageEvent) => void this.onNewMessage(ev), new NewMessage({}));
    client.addEventHandler((u: Api.TypeUpdate) => this.onRaw(u), new Raw({}));
    await this.loadMe();
    await this.loadDialogs();
    this.setState('ready');
    await this.applyStatus();
    this.stopTimers();
    // Mantém o "online" ativo e recalcula quem está ausente.
    this.timers.push(setInterval(() => void this.applyStatus(), 4 * 60 * 1000));
    this.timers.push(setInterval(() => this.refreshAway(), 60 * 1000));
    // Mensagens pessoais mudam sem aviso: relê as de quem está online a cada 15 minutos.
    this.timers.push(
      setInterval(() => this.queueAbouts([...this.contacts.values()].filter((c) => c.kind === 'user' && c.presence !== 'offline').map((c) => c.id)), 15 * 60 * 1000),
    );
    this.hooks.ready(this.me!);
  }

  private stopTimers() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  private async loadMe() {
    const u = (await this.client!.getMe()) as Api.User;
    let about = '';
    try {
      const full = await this.client!.invoke(new Api.users.GetFullUser({ id: 'me' }));
      about = full.fullUser.about ?? '';
    } catch {
      /* ignora */
    }
    this.me = {
      id: u.id.toString(),
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || 'Eu',
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      username: u.username ?? '',
      phone: u.phone ? `+${u.phone}` : '',
      about,
      hasPhoto: u.photo instanceof Api.UserProfilePhoto,
      photoVersion: this.me?.photoVersion ?? 0,
    };
    this.entities.set('me', u);
    this.hooks.emit('me:changed', this.me);
  }

  getMe() {
    return this.me;
  }

  private contactFromEntity(id: string, e: Entity | undefined, base: Partial<Contact> = {}): Contact {
    let kind: Contact['kind'] = 'group';
    let presence: Presence = 'offline';
    let subtitle = '';
    let hasPhoto = false;
    if (e instanceof Api.User) {
      kind = e.self ? 'self' : e.bot ? 'bot' : 'user';
      const p = presenceOf(e.status);
      presence = kind === 'user' ? p.presence : 'offline';
      subtitle = kind === 'bot' ? 'robô' : kind === 'self' ? 'suas anotações' : p.subtitle;
      if (p.wasOnline) this.wasOnline.set(id, p.wasOnline);
      hasPhoto = e.photo instanceof Api.UserProfilePhoto;
    } else if (e instanceof Api.Channel) {
      kind = e.megagroup || e.gigagroup ? 'group' : 'channel';
      subtitle = e.participantsCount ? `${e.participantsCount} membros` : kind === 'channel' ? 'canal' : 'grupo';
      hasPhoto = e.photo instanceof Api.ChatPhoto;
    } else if (e instanceof Api.Chat) {
      subtitle = `${e.participantsCount} membros`;
      hasPhoto = e.photo instanceof Api.ChatPhoto;
    }
    return {
      id,
      name: fullName(e),
      kind,
      presence,
      subtitle,
      lastMessage: '',
      lastDate: 0,
      unread: 0,
      hasPhoto,
      pinned: false,
      about: this.abouts.get(id) ?? '',
      status: parseBio(this.abouts.get(id)).status,
      ...base,
    };
  }

  private async loadDialogs() {
    const dialogs = await this.client!.getDialogs({ limit: 300 });
    this.contacts.clear();
    for (const d of dialogs) {
      if (!d.id || !d.entity) continue;
      if (d.entity instanceof Api.User && d.entity.deleted) continue;
      const id = d.id.toString();
      this.entities.set(id, d.entity);
      const msg = d.message;
      const lastMessage = msg ? this.preview(msg) : '';
      this.contacts.set(
        id,
        this.contactFromEntity(id, d.entity, {
          lastMessage,
          lastDate: d.date,
          unread: d.unreadCount,
          pinned: d.pinned,
        }),
      );
    }
    this.emitContacts();
    this.queueAbouts(
      [...this.contacts.values()]
        .filter((c) => c.kind === 'user' && !this.abouts.has(c.id))
        .sort((a, b) => b.lastDate - a.lastDate)
        .slice(0, 150)
        .map((c) => c.id),
    );
  }

  // ---------- Mensagem pessoal (bio) dos contatos ----------

  /** Lê as bios aos poucos, para não esbarrar no limite de pedidos do Telegram. */
  private queueAbouts(ids: string[], first = false) {
    for (const id of ids) {
      const i = this.aboutQueue.indexOf(id);
      if (i >= 0) this.aboutQueue.splice(i, 1);
      if (first) this.aboutQueue.unshift(id);
      else this.aboutQueue.push(id);
    }
    if (!this.aboutTimer) this.nextAbout(0);
  }

  private nextAbout(delay: number) {
    this.aboutTimer = setTimeout(async () => {
      const id = this.aboutQueue.shift();
      if (!id || !this.client || this.state !== 'ready') {
        this.aboutTimer = null;
        return;
      }
      let wait = 700;
      try {
        const full = await this.client.invoke(new Api.users.GetFullUser({ id: this.entity(id) }));
        const about = full.fullUser.about ?? '';
        this.abouts.set(id, about);
        const c = this.contacts.get(id);
        if (c && c.about !== about) this.patch(id, { about, status: parseBio(about).status });
      } catch (e) {
        const secs = (e as { seconds?: number }).seconds;
        if (secs) {
          this.aboutQueue.unshift(id);
          wait = (secs + 1) * 1000;
        }
      }
      this.nextAbout(wait);
    }, delay);
  }

  refreshContact(id: string) {
    if (this.contacts.get(id)?.kind === 'user') this.queueAbouts([id], true);
  }

  private preview(msg: Api.Message): string {
    if (msg.action) return serviceText(msg.action) || '';
    const text = msg.message === NUDGE_TEXT ? '📳 Chamou a atenção' : msg.message;
    return (text || mediaLabel(mediaOf(msg))).replace(/\s+/g, ' ').slice(0, 80);
  }

  private emitContacts() {
    this.hooks.emit('contacts:changed', this.listContacts());
    this.updateUnread();
  }

  private updateUnread() {
    let total = 0;
    for (const c of this.contacts.values()) if (c.kind !== 'channel') total += c.unread;
    this.hooks.unreadChanged(total);
  }

  private patch(id: string, p: Partial<Contact>) {
    const c = this.contacts.get(id);
    if (!c) return;
    Object.assign(c, p);
    this.hooks.emit('contact:patch', { id, ...p });
    if ('unread' in p) this.updateUnread();
  }

  listContacts(): Contact[] {
    return [...this.contacts.values()];
  }

  getContact(id: string): Contact | null {
    return this.contacts.get(id) ?? null;
  }

  private scheduleReload() {
    if (this.reloadTimer) return;
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      void this.loadDialogs().catch(() => {});
    }, 1500);
  }

  private refreshAway() {
    const now = Date.now();
    for (const [id, was] of this.wasOnline) {
      const c = this.contacts.get(id);
      if (!c || c.presence === 'online') continue;
      const presence: Presence = now - was * 1000 < AWAY_AFTER_MS ? 'away' : 'offline';
      if (presence !== c.presence) this.patch(id, { presence, subtitle: `visto ${fmtTime(was)}` });
    }
  }

  // ---------- Atualizações em tempo real ----------

  private onRaw(u: Api.TypeUpdate) {
    if (u instanceof Api.UpdateUserStatus) {
      const id = u.userId.toString();
      const c = this.contacts.get(id);
      if (!c || c.kind !== 'user') return;
      const p = presenceOf(u.status);
      if (p.wasOnline) this.wasOnline.set(id, p.wasOnline);
      else if (p.presence === 'online') this.wasOnline.delete(id);
      const cameOnline = p.presence === 'online' && c.presence === 'offline';
      this.patch(id, { presence: p.presence, subtitle: p.subtitle });
      if (cameOnline) this.hooks.onContactOnline(c);
    } else if (u instanceof Api.UpdateUserTyping) {
      if (u.action instanceof Api.SendMessageCancelAction) return;
      const id = u.userId.toString();
      const c = this.contacts.get(id);
      if (c) this.hooks.emit('typing', { chatId: id, name: c.name });
    } else if (u instanceof Api.UpdateChatUserTyping || u instanceof Api.UpdateChannelUserTyping) {
      if (u.action instanceof Api.SendMessageCancelAction) return;
      const peer =
        u instanceof Api.UpdateChatUserTyping ? new Api.PeerChat({ chatId: u.chatId }) : new Api.PeerChannel({ channelId: u.channelId });
      const chatId = utils.getPeerId(peer);
      const fromId = utils.getPeerId(u.fromId);
      const name = this.contacts.get(fromId)?.name ?? fullName(this.entities.get(fromId)) ?? 'Alguém';
      this.hooks.emit('typing', { chatId, name: name === 'Desconhecido' ? 'Alguém' : name });
    } else if (u instanceof Api.UpdateDeleteMessages) {
      this.hooks.emit('message:deleted', { ids: u.messages });
    } else if (u instanceof Api.UpdateDeleteChannelMessages) {
      this.hooks.emit('message:deleted', {
        chatId: utils.getPeerId(new Api.PeerChannel({ channelId: u.channelId })),
        ids: u.messages,
      });
    } else if (u instanceof Api.UpdateReadHistoryInbox || u instanceof Api.UpdateReadChannelInbox) {
      // Lido em outro aparelho: zera o contador aqui também.
      const chatId =
        u instanceof Api.UpdateReadHistoryInbox
          ? utils.getPeerId(u.peer)
          : utils.getPeerId(new Api.PeerChannel({ channelId: u.channelId }));
      if (u.stillUnreadCount === 0) this.patch(chatId, { unread: 0 });
    }
  }

  private async onNewMessage(ev: NewMessageEvent) {
    const msg = ev.message;
    const chatId = msg.chatId?.toString();
    if (!chatId) return;
    if (!this.entities.has(chatId)) {
      try {
        const chat = await msg.getChat();
        if (chat) this.entities.set(chatId, chat);
      } catch {
        /* ignora */
      }
    }
    const cm = await this.toChatMessage(msg, chatId);
    if (cm.service && !cm.text) return;
    this.hooks.emit('message:new', cm);
    const c = this.contacts.get(chatId);
    if (!c) {
      this.scheduleReload();
    } else {
      const focused = this.hooks.isChatOpenAndFocused(chatId);
      this.patch(chatId, {
        lastMessage: this.preview(msg),
        lastDate: msg.date,
        ...(msg.out ? { unread: 0 } : focused ? {} : { unread: c.unread + 1 }),
      });
      if (focused && !msg.out) this.markRead(chatId);
    }
    if (!msg.out) this.hooks.onIncoming(cm, c);
  }

  private async toChatMessage(msg: Api.Message, chatId: string): Promise<ChatMessage> {
    const senderId = msg.senderId?.toString() ?? chatId;
    let senderName: string;
    if (msg.out) senderName = this.me?.name ?? 'Eu';
    else {
      let s = msg.sender as Entity | undefined;
      if (!s) {
        try {
          s = (await msg.getSender()) as Entity | undefined;
        } catch {
          /* ignora */
        }
      }
      senderName = s ? fullName(s) : this.contacts.get(chatId)?.name ?? 'Alguém';
      if (s && !this.entities.has(senderId)) this.entities.set(senderId, s);
    }
    if (msg.action) {
      return { id: msg.id, chatId, out: !!msg.out, senderId, senderName, date: msg.date, text: serviceText(msg.action), service: true };
    }
    return {
      id: msg.id,
      chatId,
      out: !!msg.out,
      senderId,
      senderName,
      date: msg.date,
      text: msg.message ?? '',
      media: mediaOf(msg),
      nudge: msg.message === NUDGE_TEXT,
    };
  }

  // ---------- Conversas ----------

  private entity(chatId: string): Entity | string {
    return this.entities.get(chatId) ?? chatId;
  }

  async history(chatId: string, beforeId?: number): Promise<ChatMessage[]> {
    if (!this.client) return [];
    const msgs = await this.client.getMessages(this.entity(chatId), { limit: 40, offsetId: beforeId ?? 0 });
    const out: ChatMessage[] = [];
    for (const m of msgs) {
      const cm = await this.toChatMessage(m, chatId);
      if (!(cm.service && !cm.text)) out.push(cm);
    }
    return out.reverse();
  }

  private async emitSent(chatId: string, sent: Api.Message | undefined) {
    if (!sent) return;
    this.hooks.emit('message:new', await this.toChatMessage(sent, chatId));
    this.patch(chatId, { lastMessage: this.preview(sent), lastDate: sent.date, unread: 0 });
  }

  async sendText(chatId: string, text: string) {
    if (!this.client || !text.trim()) return;
    const sent = await this.client.sendMessage(this.entity(chatId), { message: text, parseMode: undefined });
    await this.emitSent(chatId, sent);
  }

  async sendFiles(chatId: string, paths: string[]) {
    if (!this.client) return;
    for (const [i, path] of paths.entries()) {
      const label = paths.length > 1 ? `Enviando ${basename(path)} (${i + 1} de ${paths.length})` : `Enviando ${basename(path)}`;
      this.hooks.emit('send:progress', { chatId, label, progress: 0 });
      try {
        const sent = await this.client.sendFile(this.entity(chatId), {
          file: path,
          workers: 4,
          progressCallback: (p) => this.hooks.emit('send:progress', { chatId, label, progress: Number(p) }),
        });
        await this.emitSent(chatId, sent);
      } finally {
        this.hooks.emit('send:progress', { chatId, label: '', progress: null });
      }
    }
  }

  async sendImageData(chatId: string, dataUrl: string) {
    const m = dataUrl.match(/^data:image\/(png|jpeg|gif|webp);base64,(.+)$/);
    if (!m) return;
    const file = join(tmpdir(), `imagem-colada-${Date.now()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`);
    writeFileSync(file, Buffer.from(m[2], 'base64'));
    await this.sendFiles(chatId, [file]);
  }

  typing(chatId: string) {
    if (!this.client || this.appearOffline) return;
    const last = this.lastTypingSent.get(chatId) ?? 0;
    if (Date.now() - last < 4000) return;
    this.lastTypingSent.set(chatId, Date.now());
    this.client
      .invoke(new Api.messages.SetTyping({ peer: this.entity(chatId), action: new Api.SendMessageTypingAction() }))
      .catch(() => {});
  }

  markRead(chatId: string) {
    const c = this.contacts.get(chatId);
    if (c && c.unread > 0) this.patch(chatId, { unread: 0 });
    this.client?.markAsRead(this.entity(chatId)).catch(() => {});
  }

  // ---------- Fotos de perfil e anexos ----------

  async avatar(id: string): Promise<string | null> {
    if (this.avatars.has(id)) return this.avatars.get(id)!;
    if (!this.client) return null;
    const hasPhoto = id === 'me' ? this.me?.hasPhoto : this.contacts.get(id)?.hasPhoto;
    if (!hasPhoto) return null;
    let url: string | null = null;
    try {
      const buf = await this.client.downloadProfilePhoto(this.entity(id), { isBig: false });
      if (buf && Buffer.isBuffer(buf) && buf.length) url = `data:image/jpeg;base64,${buf.toString('base64')}`;
    } catch {
      /* sem foto */
    }
    this.avatars.set(id, url);
    return url;
  }

  private async getMessage(chatId: string, msgId: number): Promise<Api.Message | undefined> {
    const [m] = await this.client!.getMessages(this.entity(chatId), { ids: [msgId] });
    return m;
  }

  async mediaPreview(chatId: string, msgId: number): Promise<string | null> {
    const key = `${chatId}:${msgId}`;
    if (this.previews.has(key)) return this.previews.get(key)!;
    if (!this.client) return null;
    let url: string | null = null;
    try {
      const msg = await this.getMessage(chatId, msgId);
      const info = msg && mediaOf(msg);
      if (msg && info) {
        let buf: string | Buffer | undefined;
        let mime = 'image/jpeg';
        if (info.kind === 'photo') buf = await this.client.downloadMedia(msg, {});
        else if (info.kind === 'sticker' && info.mime === 'image/webp') {
          buf = await this.client.downloadMedia(msg, {});
          mime = 'image/webp';
        } else if (info.kind === 'video' || info.kind === 'sticker') {
          const doc = (msg.media as Api.MessageMediaDocument).document as Api.Document;
          const thumbs = doc.thumbs?.filter((t) => t instanceof Api.PhotoSize || t instanceof Api.PhotoSizeProgressive) ?? [];
          if (thumbs.length) buf = await this.client.downloadMedia(msg, { thumb: thumbs[thumbs.length - 1] });
        }
        if (buf && Buffer.isBuffer(buf) && buf.length) url = `data:${mime};base64,${buf.toString('base64')}`;
      }
    } catch (e) {
      console.error('Falha ao baixar prévia:', e);
    }
    this.previews.set(key, url);
    return url;
  }

  private async download(chatId: string, msgId: number): Promise<string | null> {
    const key = `${chatId}:${msgId}`;
    const cached = this.downloaded.get(key);
    if (cached && existsSync(cached)) return cached;
    const msg = await this.getMessage(chatId, msgId);
    const info = msg && mediaOf(msg);
    if (!msg || !info) return null;
    const dir = join(app.getPath('downloads'), 'Lex Messenger');
    mkdirSync(dir, { recursive: true });
    const name = (info.name ?? `arquivo-${msgId}`).replace(/[/\\:]/g, '_');
    let file = join(dir, name);
    for (let n = 2; existsSync(file); n++) {
      const ext = extname(name);
      file = join(dir, `${basename(name, ext)} (${n})${ext}`);
    }
    this.hooks.emit('send:progress', { chatId, label: `Baixando ${name}`, progress: 0 });
    try {
      const buf = await this.client!.downloadMedia(msg, {
        progressCallback: (got, total) =>
          this.hooks.emit('send:progress', { chatId, label: `Baixando ${name}`, progress: Number(total) ? Number(got) / Number(total) : null }),
      });
      if (!buf || !Buffer.isBuffer(buf)) return null;
      writeFileSync(file, buf);
    } finally {
      this.hooks.emit('send:progress', { chatId, label: '', progress: null });
    }
    this.downloaded.set(key, file);
    return file;
  }

  async openMedia(chatId: string, msgId: number) {
    const file = await this.download(chatId, msgId);
    if (file) await shell.openPath(file);
  }

  async revealMedia(chatId: string, msgId: number) {
    const file = await this.download(chatId, msgId);
    if (file) shell.showItemInFolder(file);
  }

  // ---------- Meu perfil: status, bio, nome e foto ----------

  async setAppearOffline(offline: boolean) {
    this.appearOffline = offline;
    await this.applyStatus();
  }

  private async applyStatus() {
    if (!this.client || this.state !== 'ready') return;
    await this.client.invoke(new Api.account.UpdateStatus({ offline: this.appearOffline })).catch(() => {});
  }

  async goOffline() {
    await this.client?.invoke(new Api.account.UpdateStatus({ offline: true })).catch(() => {});
  }

  /** Grava a bio exatamente como recebida (o Lex monta o texto antes). */
  async setBio(about: string) {
    if (!this.client || !this.me || about === this.me.about) return;
    await this.client.invoke(new Api.account.UpdateProfile({ about }));
    this.me = { ...this.me, about };
    this.hooks.emit('me:changed', this.me);
  }

  async setName(first: string, last: string) {
    if (!this.client || !this.me) return;
    const firstName = first.trim().slice(0, 64);
    const lastName = last.trim().slice(0, 64);
    if (!firstName) throw new Error('O nome não pode ficar vazio.');
    await this.client.invoke(new Api.account.UpdateProfile({ firstName, lastName }));
    this.me = { ...this.me, firstName, lastName, name: [firstName, lastName].filter(Boolean).join(' ') };
    this.hooks.emit('me:changed', this.me);
  }

  /** Corta a imagem em quadrado, reduz e envia como nova foto de perfil. */
  async setPhoto(path: string) {
    if (!this.client || !this.me) return;
    const img = nativeImage.createFromPath(path);
    if (img.isEmpty()) throw new Error('Não consegui abrir essa imagem. Use JPG ou PNG.');
    const { width, height } = img.getSize();
    const side = Math.min(width, height);
    const square = img.crop({ x: Math.floor((width - side) / 2), y: Math.floor((height - side) / 2), width: side, height: side });
    const jpeg = square.resize({ width: Math.min(side, 640), height: Math.min(side, 640), quality: 'best' }).toJPEG(90);
    const file = await this.client.uploadFile({ file: new CustomFile('foto.jpg', jpeg.length, '', jpeg), workers: 1 });
    await this.client.invoke(new Api.photos.UploadProfilePhoto({ file }));
    this.avatars.delete('me');
    this.avatars.delete(this.me.id);
    this.me = { ...this.me, hasPhoto: true, photoVersion: this.me.photoVersion + 1 };
    this.hooks.emit('me:changed', this.me);
  }
}
