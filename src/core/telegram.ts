// Conexão com o Telegram (conta do próprio usuário, via MTProto/GramJS).
// Este "motor" roda igual no Mac/Windows (Electron) e no Android (Capacitor). O que muda de um para o outro
// (onde guardar a sessão, salvar e abrir arquivos, cortar a foto) vem da "Platform" de cada um.
import { Api, TelegramClient, utils } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, NewMessageEvent, Raw } from 'telegram/events';
import { LogLevel } from 'telegram/extensions/Logger';
import { CustomFile } from 'telegram/client/uploads';
import type { Entity } from 'telegram/define';
import bigInt from 'big-integer';
import {
  EXPORT_NOTICE,
  NUDGE_TEXT,
  PRINT_CONTEXT_NOTICE,
  RECORDING_NOTICE,
  isSystemNotice,
  type AuthState,
  type ChatMessage,
  type Contact,
  type LexEvents,
  type LoginStep,
  type AccountSettings,
  type CaptureOpts,
  type MediaInfo,
  type Me,
  type PickItem,
  type PrivacyKey,
  type StickerPack,
  type PrivacyValue,
  type Reaction,
  type Presence,
} from '../shared/types';
import { parseBio } from '../shared/status';
import { applyToggle, formatChecklist, parseChecklist, parseToggle } from '../shared/checklist';

declare const __API_ID__: string;
declare const __API_HASH__: string;
declare const __APP_VERSION__: string;

const API_ID = Number(__API_ID__);
const API_HASH = __API_HASH__;
const AWAY_AFTER_MS = 10 * 60 * 1000;

/** Um arquivo para enviar: caminho no disco (computador) ou bytes já lidos (celular). */
export type FileInput = string | { name: string; data: Uint8Array };

export interface Platform {
  deviceModel: string;
  systemVersion: string;
  /** Conexão por WebSocket seguro (necessária dentro de um app de celular/navegador). */
  useWSS?: boolean;
  loadSession(): Promise<string>;
  saveSession(value: string): Promise<void>;
  clearSession(): Promise<void>;
  /**
   * Abre um arquivo recebido a partir de uma cópia TEMPORÁRIA (apagada ao fechar o app).
   * Nada vai para Downloads, galeria ou memória do app sem o usuário pedir.
   */
  openTemp(name: string, data: Buffer): Promise<void>;
  /** "Salvar…": o usuário escolhe onde guardar. Devolve false se ele desistir. */
  saveAs(name: string, data: Buffer): Promise<boolean>;
  /** Apaga as cópias temporárias. */
  clearTemp(): Promise<void>;
  /** Computador: lê um arquivo escolhido (para enviar como mídia sensível). */
  readFile?(path: string): Promise<Uint8Array>;
  /** Pequenos dados do app (ex.: a lista de mensagens a autodestruir — só números, nunca o conteúdo). */
  loadData(key: string): Promise<string | null>;
  saveData(key: string, value: string): Promise<void>;
  /** Foto de perfil: corta em quadrado, reduz e devolve JPEG. */
  squareJpeg(input: FileInput): Promise<Buffer>;
}

// ---------- Mensagens que se autodestroem ----------
export const SELF_DESTRUCT_OPTIONS: [number, string][] = [
  [30, '30 s'],
  [60, '1 min'],
  [300, '5 min'],
  [3600, '1 h'],
  [86400, '24 h'],
];
export const DESTROYED_NOTICE = '🔥 Mensagem autodestruída';
const NOTICE_LIFETIME = 12 * 3600; // o aviso também some depois de 12 horas
const ttlLabel = (s: number) => SELF_DESTRUCT_OPTIONS.find(([v]) => v === s)?.[1] ?? `${s} s`;
const ttlTag = (s: number) => `⏱ Some em ${ttlLabel(s)}`;
interface Doom {
  chatId: string;
  id: number;
  at: number;
  /** Depois de apagar, deixa o aviso "🔥 Mensagem autodestruída" (que também some em 12 h). */
  notice: boolean;
}

const fileName = (f: FileInput) => (typeof f === 'string' ? f.split(/[\\/]/).pop() || 'arquivo' : f.name);

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
  PHONE_NUMBER_UNOCCUPIED: 'Este número ainda não tem conta no Telegram.',
  FIRSTNAME_INVALID: 'Nome inválido. Use letras e no máximo 64 caracteres.',
  LASTNAME_INVALID: 'Sobrenome inválido.',
  PHONE_NUMBER_FLOOD: 'Muitas tentativas com este número. Tente mais tarde.',
  PHONE_NUMBER_OCCUPIED: 'Este número já tem conta no Telegram: use “Entrar com número de telefone”.',
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
  'FIRSTNAME_INVALID',
  'LASTNAME_INVALID',
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
  if (m instanceof Api.MessageMediaPhoto) return { kind: 'photo', name: `foto-${msg.id}.jpg`, mime: 'image/jpeg', sensitive: !!m.spoiler };
  if (m instanceof Api.MessageMediaDocument && m.document instanceof Api.Document) {
    const doc = m.document;
    const info: MediaInfo = { kind: 'file', mime: doc.mimeType, size: Number(doc.size), sensitive: !!m.spoiler };
    // Vídeo primeiro: recados antigos traziam também a marca de voz, e a ordem das marcas varia.
    const attrs = [...doc.attributes].sort((x, y) => Number(y instanceof Api.DocumentAttributeVideo) - Number(x instanceof Api.DocumentAttributeVideo));
    for (const a of attrs) {
      if (a instanceof Api.DocumentAttributeFilename) info.name = a.fileName;
      if (a instanceof Api.DocumentAttributeSticker) {
        info.kind = 'sticker';
        info.anim = doc.mimeType === 'video/webm' ? 'video' : doc.mimeType === 'application/x-tgsticker' ? 'lottie' : 'static';
      }
      if (a instanceof Api.DocumentAttributeAnimated && info.kind !== 'sticker') info.kind = 'gif';
      if (a instanceof Api.DocumentAttributeVideo && (info.kind === 'file' || info.kind === 'gif')) {
        const gif = info.kind === 'gif';
        info.kind = gif ? 'gif' : 'video';
        info.duration = a.duration;
        info.round = !!a.roundMessage;
        info.width = a.w;
        info.height = a.h;
      }
      // Recados enviados por versões antigas tinham também a marca de voz: o vídeo redondo vale mais.
      if (a instanceof Api.DocumentAttributeAudio && !info.round) {
        info.kind = a.voice ? 'voice' : 'audio';
        info.duration = a.duration;
        if (a.waveform?.length) info.waveform = unpackWaveform(a.waveform);
      }
    }
    if (!info.name) {
      const ext = (doc.mimeType.split('/')[1] ?? 'bin').replace('mpeg', 'mp3').replace('quicktime', 'mov');
      const label = { video: 'video', audio: 'audio', voice: 'audio', sticker: 'figurinha' }[info.kind as string] ?? 'arquivo';
      info.name = `${label}-${msg.id}.${ext}`;
    }
    return info;
  }
  if (m instanceof Api.MessageMediaWebPage) {
    const w = m.webpage;
    if (!(w instanceof Api.WebPage)) return undefined;
    return {
      kind: 'webpage',
      link: { url: w.url, site: w.siteName, title: w.title, description: w.description, hasPhoto: w.photo instanceof Api.Photo },
    };
  }
  return { kind: 'other' };
}

/** O Telegram guarda a onda em 5 bits por ponto. */
function unpackWaveform(buf: Buffer): number[] {
  const n = Math.floor((buf.length * 8) / 5);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const bit = i * 5;
    const byte = bit >> 3;
    const word = buf[byte] | ((buf[byte + 1] ?? 0) << 8);
    out.push((word >> (bit & 7)) & 31);
  }
  return out;
}

function packWaveform(values: number[]): Buffer {
  const out = Buffer.alloc(Math.ceil((values.length * 5) / 8));
  values.forEach((v, i) => {
    const bit = i * 5;
    const byte = bit >> 3;
    const val = (Math.max(0, Math.min(31, Math.round(v))) << (bit & 7)) & 0xffff;
    out[byte] |= val & 0xff;
    if (byte + 1 < out.length) out[byte + 1] |= val >> 8;
  });
  return out;
}

function reactionsOf(msg: Api.Message): Reaction[] | undefined {
  const r = msg.reactions?.results;
  if (!r?.length) return undefined;
  return r
    .filter((x) => x.reaction instanceof Api.ReactionEmoji)
    .map((x) => ({ emoji: (x.reaction as Api.ReactionEmoji).emoticon, count: x.count, mine: x.chosenOrder != null }));
}

const PRIVACY_KEYS: Record<PrivacyKey, () => Api.TypeInputPrivacyKey> = {
  lastSeen: () => new Api.InputPrivacyKeyStatusTimestamp(),
  photo: () => new Api.InputPrivacyKeyProfilePhoto(),
  phone: () => new Api.InputPrivacyKeyPhoneNumber(),
  invites: () => new Api.InputPrivacyKeyChatInvite(),
  forwards: () => new Api.InputPrivacyKeyForwards(),
  calls: () => new Api.InputPrivacyKeyPhoneCall(),
};

function privacyValue(rules: Api.TypePrivacyRule[]): PrivacyValue {
  if (rules.some((r) => r instanceof Api.PrivacyValueAllowAll)) return 'everybody';
  if (rules.some((r) => r instanceof Api.PrivacyValueAllowContacts)) return 'contacts';
  return 'nobody';
}

function mediaLabel(media: MediaInfo | undefined): string {
  if (!media) return '';
  if (media.kind === 'webpage') return media.link?.url ?? '🔗 Link';
  return (
    { photo: '📷 Foto', video: '🎬 Vídeo', audio: '🎵 Áudio', voice: '🎤 Mensagem de voz', sticker: '🙂 Figurinha', gif: '🎞️ GIF', file: '📎 ' + (media.name ?? 'Arquivo'), other: '📎 Anexo' }[media.kind] ?? ''
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
  private me: Me | null = null;
  private appearOffline = false;
  /** Botão "Desligado": sem conexão até a hora marcada. */
  private paused = false;
  private wakeTimer: ReturnType<typeof setTimeout> | null = null;
  private pickDocs = new Map<string, Api.Document>();
  private inlinePicks = new Map<string, { queryId: bigInt.BigInteger; id: string }>();
  private favorites = new Set<string>();
  private favFolderId: number | null = null;
  private selfDestruct = new Map<string, number>();
  private sensitiveChats = new Set<string>();
  private doomed: Doom[] = [];
  private doomBusy = false;
  private myPhotoId = '';
  private abouts = new Map<string, string>();
  private aboutQueue: string[] = [];
  private aboutTimer: NodeJS.Timeout | null = null;
  private timers: NodeJS.Timeout[] = [];
  private reloadTimer: NodeJS.Timeout | null = null;
  private lastTypingSent = new Map<string, number>();

  constructor(
    private hooks: Hooks,
    private platform: Platform,
  ) {}

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
      deviceModel: this.platform.deviceModel,
      systemVersion: this.platform.systemVersion,
      useWSS: this.platform.useWSS,
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
    const saved = await this.platform.loadSession();
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
      if (/SIGN_?UP|REGISTRATION/i.test(code))
        this.loginError = 'O Telegram não permitiu criar a conta por aqui. Crie pelo app oficial do Telegram e depois entre no Lex com o seu número.';
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
          // Número sem conta: a pessoa informa o nome e aceita os Termos do Telegram na tela do Lex
          // (o aceite que a biblioteca envia depois só acontece porque ela marcou "Li e aceito").
          firstAndLastNames: async () => {
            const v = JSON.parse(await this.ask({ step: 'signup' })) as { first: string; last: string; accepted: boolean };
            if (!v.accepted) throw new Cancelled();
            return [v.first.trim(), v.last.trim() || undefined];
          },
          onError,
        });
      }
      if (this.cancelled) return;
      await this.platform.saveSession((client.session as StringSession).save());
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
    await this.platform.clearSession();
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
    await this.loadFavorites();
    await this.loadDialogs();
    this.setState('ready');
    await this.applyStatus();
    this.stopTimers();
    // Mantém o "online" ativo e recalcula quem está ausente.
    this.timers.push(setInterval(() => void this.applyStatus(), 4 * 60 * 1000));
    this.timers.push(setInterval(() => this.refreshAway(), 60 * 1000));
    // Autodestruição: carrega o que ficou pendente (app fechado na hora marcada) e confere a cada 2 s.
    try {
      this.doomed = JSON.parse((await this.platform.loadData('autodestruir')) ?? '[]');
    } catch {
      this.doomed = [];
    }
    this.timers.push(setInterval(() => void this.runDoom(), 2000));
    void this.runDoom();
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
      premium: !!u.premium,
    };
    this.entities.set('me', u);
    this.entities.set(u.id.toString(), u);
    this.myPhotoId = u.photo instanceof Api.UserProfilePhoto ? u.photo.photoId.toString() : '';
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
      base = { premium: !!e.premium, phone: e.phone ? `+${e.phone}` : undefined, ...base };
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
          muted: (d.dialog.notifySettings?.muteUntil ?? 0) > Date.now() / 1000,
          favorite: this.favorites.has(id),
          readOutboxMaxId: d.dialog.readOutboxMaxId,
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
        if (c && !!c.blocked !== !!full.fullUser.blocked) this.patch(id, { blocked: !!full.fullUser.blocked });
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

  /**
   * Depois de o app ficar parado (celular em repouso, computador dormindo): garante a conexão,
   * recarrega a lista e avisa as conversas abertas para buscarem o que chegou.
   */
  async resync() {
    if (!this.client || this.state !== 'ready' || this.paused) return;
    try {
      if (!this.client.connected) await this.client.connect();
      await this.client.invoke(new Api.updates.GetState());
      await this.loadDialogs();
      await this.refreshMyPhoto();
      this.hooks.emit('chat:resync', true);
      await this.applyStatus();
    } catch (e) {
      console.error('Falha ao sincronizar:', e);
    }
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
    for (const c of this.contacts.values()) if (c.kind !== 'channel' && !c.muted) total += c.unread;
    this.hooks.unreadChanged(total);
  }

  private patch(id: string, p: Partial<Contact>) {
    const c = this.contacts.get(id);
    if (!c) return;
    Object.assign(c, p);
    this.hooks.emit('contact:patch', { id, ...p });
    if ('unread' in p || 'muted' in p) this.updateUnread();
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
    } else if (u instanceof Api.UpdateDialogFilter || u instanceof Api.UpdateDialogFilters) {
      // Pastas mudaram (aqui ou em outro aparelho): relê os favoritos.
      void this.loadFavorites().then(() => {
        for (const c of this.contacts.values()) {
          const fav = this.favorites.has(c.id);
          if (!!c.favorite !== fav) this.patch(c.id, { favorite: fav });
        }
      });
    } else if (u instanceof Api.UpdateReadHistoryOutbox) {
      // A pessoa leu minhas mensagens: ✓✓.
      this.patch(utils.getPeerId(u.peer), { readOutboxMaxId: u.maxId });
    } else if (u instanceof Api.UpdateMessageReactions) {
      const reactions = (u.reactions.results ?? [])
        .filter((x) => x.reaction instanceof Api.ReactionEmoji)
        .map((x) => ({ emoji: (x.reaction as Api.ReactionEmoji).emoticon, count: x.count, mine: x.chosenOrder != null }));
      this.hooks.emit('message:patch', { chatId: utils.getPeerId(u.peer), id: u.msgId, reactions });
    } else if (u instanceof Api.UpdateTranscribedAudio) {
      this.hooks.emit('transcription', { chatId: utils.getPeerId(u.peer), id: u.msgId, text: u.text, pending: !!u.pending });
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
    void this.syncChecklist(msg, chatId);
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

  private async toChatMessage(msg: Api.Message, chatId: string, replies?: Map<number, Api.Message>): Promise<ChatMessage> {
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
    let text = msg.message ?? '';
    const ttlMatch = text.match(/^⏱ Some em ([^·\n]+?)(?: · |$)/);
    if (ttlMatch) text = text.slice(ttlMatch[0].length);
    const cm: ChatMessage = {
      id: msg.id,
      chatId,
      out: !!msg.out,
      senderId,
      senderName,
      date: msg.date,
      text,
      selfDestruct: ttlMatch?.[1].trim(),
      destroyedNotice: text === DESTROYED_NOTICE,
      systemNotice: isSystemNotice(text),
      media: mediaOf(msg),
      nudge: msg.message === NUDGE_TEXT,
      edited: !!msg.editDate && !msg.editHide,
      reactions: reactionsOf(msg),
    };
    const fwd = msg.fwdFrom;
    if (fwd) {
      let from = fwd.fromName ?? '';
      if (!from && fwd.fromId) {
        const fid = utils.getPeerId(fwd.fromId);
        from = this.contacts.get(fid)?.name ?? fullName(this.entities.get(fid));
        if (from === 'Desconhecido') from = '';
      }
      cm.forwardedFrom = from || 'alguém';
    }
    const replyId = msg.replyTo instanceof Api.MessageReplyHeader ? msg.replyTo.replyToMsgId : undefined;
    if (replyId) {
      let r = replies?.get(replyId);
      if (!r && !replies) {
        try {
          r = (await msg.getReplyMessage()) ?? undefined;
        } catch {
          /* ignora */
        }
      }
      if (r) {
        const rs = r.out ? this.me?.name ?? 'Você' : fullName((r.sender as Entity | undefined) ?? this.entities.get(r.senderId?.toString() ?? ''));
        cm.replyTo = { id: replyId, senderName: rs === 'Desconhecido' ? 'Mensagem' : rs, text: this.preview(r) };
      } else cm.replyTo = { id: replyId, senderName: 'Mensagem', text: '' };
    }
    return cm;
  }

  // ---------- Conversas ----------

  private entity(chatId: string): Entity | string {
    return this.entities.get(chatId) ?? chatId;
  }

  async history(chatId: string, beforeId?: number): Promise<ChatMessage[]> {
    if (!this.client) return [];
    const msgs = await this.client.getMessages(this.entity(chatId), { limit: 40, offsetId: beforeId ?? 0 });
    // Busca de uma vez as mensagens respondidas que não vieram neste lote.
    const replies = new Map<number, Api.Message>(msgs.map((m) => [m.id, m]));
    const missing = [
      ...new Set(
        msgs
          .map((m) => (m.replyTo instanceof Api.MessageReplyHeader ? m.replyTo.replyToMsgId : undefined))
          .filter((id): id is number => !!id && !replies.has(id)),
      ),
    ];
    if (missing.length) {
      try {
        for (const r of await this.client.getMessages(this.entity(chatId), { ids: missing })) if (r) replies.set(r.id, r);
      } catch {
        /* ignora */
      }
    }
    const out: ChatMessage[] = [];
    for (const m of msgs) {
      const cm = await this.toChatMessage(m, chatId, replies);
      if (!(cm.service && !cm.text)) out.push(cm);
    }
    return out.reverse();
  }

  private async emitSent(chatId: string, sent: Api.Message | undefined, applyTimer = true, replyToId?: number) {
    if (!sent) return;
    const ttl = applyTimer ? this.selfDestruct.get(chatId) : undefined;
    if (ttl) await this.doom({ chatId, id: sent.id, at: Math.floor(Date.now() / 1000) + ttl, notice: true });
    const cm = await this.toChatMessage(sent, chatId);
    // O Telegram devolve a mensagem enviada "resumida", sem dizer a que ela respondia: completa aqui.
    if (replyToId && !cm.replyTo?.text) {
      try {
        const [r] = await this.client!.getMessages(this.entity(chatId), { ids: [replyToId] });
        if (r) {
          const who = r.out ? this.me?.name ?? 'Você' : fullName((r.sender as Entity | undefined) ?? this.entities.get(r.senderId?.toString() ?? ''));
          cm.replyTo = { id: replyToId, senderName: who === 'Desconhecido' ? 'Mensagem' : who, text: this.preview(r) };
        }
      } catch {
        cm.replyTo = { id: replyToId, senderName: 'Mensagem', text: '' };
      }
    }
    this.hooks.emit('message:new', cm);
    this.patch(chatId, { lastMessage: this.preview(sent), lastDate: sent.date, unread: 0 });
  }

  // ---------- Autodestruição ----------

  // ---------- Mídia sensível (spoiler do Telegram) ----------

  setSensitive(chatId: string, on: boolean) {
    if (on) this.sensitiveChats.add(chatId);
    else this.sensitiveChats.delete(chatId);
  }

  getSensitive(chatId: string) {
    return this.sensitiveChats.has(chatId);
  }

  /** Envia foto ou vídeo coberto: quem recebe só vê depois de tocar (no Lex e no Telegram oficial). */
  private async sendSpoiler(chatId: string, name: string, data: Uint8Array, kind: 'photo' | 'video' | 'round', meta: { duration?: number; width?: number; height?: number } = {}) {
    const c = this.client!;
    const label = `Enviando ${name} (sensível)`;
    this.hooks.emit('send:progress', { chatId, label, progress: 0 });
    try {
      const file = await c.uploadFile({
        file: new CustomFile(name, data.length, '', Buffer.from(data)),
        workers: 4,
        onProgress: (p) => this.hooks.emit('send:progress', { chatId, label, progress: Number(p) }),
      });
      const tag = this.tag(chatId);
      const media =
        kind === 'photo'
          ? new Api.InputMediaUploadedPhoto({ file, spoiler: true })
          : new Api.InputMediaUploadedDocument({
              file,
              spoiler: true,
              mimeType: name.toLowerCase().endsWith('.webm') ? 'video/webm' : name.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
              attributes: [
                new Api.DocumentAttributeVideo({
                  duration: Math.max(1, Math.round(meta.duration ?? 1)),
                  w: meta.width ?? 0,
                  h: meta.height ?? 0,
                  supportsStreaming: true,
                  roundMessage: kind === 'round',
                }),
                new Api.DocumentAttributeFilename({ fileName: name }),
              ],
            });
      const updates = await c.invoke(
        new Api.messages.SendMedia({
          peer: this.entity(chatId),
          media,
          message: kind === 'round' ? '' : tag,
          randomId: bigInt(Math.floor(Math.random() * 1e15)),
        }),
      );
      const sent = this.messageFromUpdates(updates);
      if (sent) await this.emitSent(chatId, sent);
    } finally {
      this.hooks.emit('send:progress', { chatId, label: '', progress: null });
    }
  }

  /** Liga (segundos) ou desliga (0) a autodestruição das próximas mensagens nesta conversa. */
  setSelfDestruct(chatId: string, seconds: number) {
    if (seconds > 0) this.selfDestruct.set(chatId, seconds);
    else this.selfDestruct.delete(chatId);
  }

  getSelfDestruct(chatId: string) {
    return this.selfDestruct.get(chatId) ?? 0;
  }

  /** Texto que marca a mensagem para quem a recebe (inclusive no Telegram comum). */
  private tag(chatId: string): string {
    const ttl = this.selfDestruct.get(chatId);
    return ttl ? ttlTag(ttl) : '';
  }

  private async doom(d: Doom) {
    this.doomed.push(d);
    await this.saveDoom();
  }

  private saveDoom() {
    return this.platform.saveData('autodestruir', JSON.stringify(this.doomed)).catch(() => {});
  }

  private async runDoom() {
    if (this.doomBusy || !this.client || this.state !== 'ready') return;
    const now = Math.floor(Date.now() / 1000);
    const due = this.doomed.filter((d) => d.at <= now);
    if (!due.length) return;
    this.doomBusy = true;
    try {
      for (const d of due) {
        try {
          await this.client.deleteMessages(this.entity(d.chatId), [d.id], { revoke: true });
        } catch {
          /* já tinha sido apagada */
        }
        this.hooks.emit('message:deleted', { chatId: d.chatId, ids: [d.id] });
        this.doomed = this.doomed.filter((x) => x !== d);
        if (d.notice) {
          try {
            const n = await this.client.sendMessage(this.entity(d.chatId), { message: DESTROYED_NOTICE, silent: true });
            this.doomed.push({ chatId: d.chatId, id: n.id, at: Math.floor(Date.now() / 1000) + NOTICE_LIFETIME, notice: false });
            await this.emitSent(d.chatId, n, false);
          } catch {
            /* sem conexão: tenta na próxima */
          }
        }
        await this.saveDoom();
      }
    } finally {
      this.doomBusy = false;
    }
  }

  async sendText(chatId: string, text: string, replyTo?: number) {
    if (!this.client || !text.trim()) return;
    // linkPreview: o Telegram monta a prévia (título, imagem) dos links da mensagem.
    const tag = this.tag(chatId);
    const message = tag ? `${tag} · ${text}` : text;
    const sent = await this.client.sendMessage(this.entity(chatId), { message, parseMode: undefined, linkPreview: true, replyTo });
    await this.emitSent(chatId, sent, true, replyTo);
  }

  // ---------- Ações em mensagens ----------

  async editMessage(chatId: string, id: number, text: string) {
    if (!this.client || !text.trim()) return;
    const m = await this.client.editMessage(this.entity(chatId), { message: id, text, linkPreview: true });
    this.hooks.emit('message:patch', { chatId, id, text: m.message ?? text, edited: true, media: mediaOf(m) });
  }

  async deleteMessages(chatId: string, ids: number[], forEveryone: boolean) {
    if (!this.client) return;
    await this.client.deleteMessages(this.entity(chatId), ids, { revoke: forEveryone });
    this.hooks.emit('message:deleted', { chatId, ids });
  }

  async forwardMessages(fromChat: string, ids: number[], toChat: string) {
    if (!this.client) return;
    const sent = await this.client.forwardMessages(this.entity(toChat), { messages: ids, fromPeer: this.entity(fromChat) });
    for (const m of sent) if (m) await this.emitSent(toChat, m);
  }

  async react(chatId: string, id: number, emoji: string | null) {
    if (!this.client) return;
    await this.client.invoke(
      new Api.messages.SendReaction({
        peer: this.entity(chatId),
        msgId: id,
        reaction: emoji ? [new Api.ReactionEmoji({ emoticon: emoji })] : [],
      }),
    );
  }

  /** Telegram Premium: transforma o áudio em texto. */
  async transcribe(chatId: string, id: number): Promise<{ text: string; pending: boolean }> {
    if (!this.client) return { text: '', pending: false };
    try {
      const r = await this.client.invoke(new Api.messages.TranscribeAudio({ peer: this.entity(chatId), msgId: id }));
      return { text: r.text, pending: !!r.pending };
    } catch (e) {
      const code = (e as { errorMessage?: string }).errorMessage ?? '';
      if (code.includes('PREMIUM')) throw new Error('Transcrever áudios é um recurso do Telegram Premium.');
      if (code.startsWith('FLOOD') || code.includes('TRIAL')) throw new Error('Você usou as transcrições gratuitas desta semana. Com o Telegram Premium não há limite.');
      throw new Error('Não foi possível transcrever este áudio.');
    }
  }

  async setMuted(chatId: string, muted: boolean) {
    if (!this.client) return;
    await this.client.invoke(
      new Api.account.UpdateNotifySettings({
        peer: new Api.InputNotifyPeer({ peer: await this.client.getInputEntity(this.entity(chatId)) }),
        settings: new Api.InputPeerNotifySettings({ muteUntil: muted ? 2147483647 : 0 }),
      }),
    );
    this.patch(chatId, { muted });
  }

  // ---------- Figurinhas e GIFs ----------

  private remember(docs: Api.TypeDocument[], kind: PickItem['kind']): PickItem[] {
    const out: PickItem[] = [];
    for (const d of docs) {
      if (!(d instanceof Api.Document)) continue;
      const key = `doc:${d.id.toString()}`;
      this.pickDocs.set(key, d);
      out.push({ key, kind });
    }
    return out;
  }

  async stickerPanel(): Promise<{ recent: PickItem[]; packs: StickerPack[]; gifs: PickItem[] }> {
    const c = this.client!;
    const [recent, all, gifs] = await Promise.all([
      c.invoke(new Api.messages.GetRecentStickers({ hash: bigInt(0) })).catch(() => null),
      c.invoke(new Api.messages.GetAllStickers({ hash: bigInt(0) })).catch(() => null),
      c.invoke(new Api.messages.GetSavedGifs({ hash: bigInt(0) })).catch(() => null),
    ]);
    const packs = all instanceof Api.messages.AllStickers ? all.sets.map((s) => ({ id: `${s.id}:${s.accessHash}`, title: s.title })) : [];
    return {
      recent: recent instanceof Api.messages.RecentStickers ? this.remember(recent.stickers, 'sticker').slice(0, 40) : [],
      packs,
      gifs: gifs instanceof Api.messages.SavedGifs ? this.remember(gifs.gifs, 'gif') : [],
    };
  }

  async stickerPack(packId: string): Promise<PickItem[]> {
    const [id, accessHash] = packId.split(':');
    const r = await this.client!.invoke(
      new Api.messages.GetStickerSet({ stickerset: new Api.InputStickerSetID({ id: bigInt(id), accessHash: bigInt(accessHash) }), hash: 0 }),
    );
    return r instanceof Api.messages.StickerSet ? this.remember(r.documents, 'sticker') : [];
  }

  /** Busca de GIFs pelo robô oficial @gif do Telegram. */
  async searchGifs(chatId: string, query: string): Promise<PickItem[]> {
    const c = this.client!;
    const r = await c.invoke(new Api.messages.GetInlineBotResults({ bot: 'gif', peer: this.entity(chatId), query: query.trim(), offset: '' }));
    const out: PickItem[] = [];
    for (const res of r.results.slice(0, 40)) {
      if (!(res instanceof Api.BotInlineMediaResult) || !(res.document instanceof Api.Document)) continue;
      const key = `inline:${res.id}`;
      this.pickDocs.set(key, res.document);
      this.inlinePicks.set(key, { queryId: r.queryId, id: res.id });
      out.push({ key, kind: 'gif' });
    }
    return out;
  }

  async pickThumb(key: string): Promise<{ url: string; video: boolean } | null> {
    const cacheKey = `pick:${key}`;
    if (this.previews.has(cacheKey)) return JSON.parse(this.previews.get(cacheKey)!);
    const doc = this.pickDocs.get(key);
    if (!doc || !this.client) return null;
    const media = new Api.MessageMediaDocument({ document: doc });
    let buf: string | Buffer | undefined;
    let mime = 'image/webp';
    let video = false;
    try {
      if (doc.mimeType === 'image/webp' || (doc.mimeType === 'video/webm' && Number(doc.size) < 512 * 1024)) {
        buf = await this.client.downloadMedia(media, {});
        mime = doc.mimeType;
        video = doc.mimeType === 'video/webm';
      } else {
        const thumbs = doc.thumbs?.filter((t) => t instanceof Api.PhotoSize || t instanceof Api.PhotoSizeProgressive) ?? [];
        if (thumbs.length) buf = await this.client.downloadMedia(media, { thumb: thumbs[thumbs.length - 1] });
        mime = 'image/jpeg';
        if (buf && Buffer.isBuffer(buf) && buf[0] === 0x52) mime = 'image/webp'; // "RIFF"
      }
    } catch {
      /* sem miniatura */
    }
    if (!buf || !Buffer.isBuffer(buf)) return null;
    const res = { url: `data:${mime};base64,${buf.toString('base64')}`, video };
    this.previews.set(cacheKey, JSON.stringify(res));
    return res;
  }

  async sendPick(chatId: string, key: string) {
    const c = this.client!;
    const inline = this.inlinePicks.get(key);
    if (inline) {
      const updates = await c.invoke(
        new Api.messages.SendInlineBotResult({ peer: this.entity(chatId), queryId: inline.queryId, id: inline.id, randomId: bigInt(Math.floor(Math.random() * 1e15)), hideVia: true }),
      );
      const sent = this.messageFromUpdates(updates);
      if (sent) await this.emitSent(chatId, sent);
      return;
    }
    const doc = this.pickDocs.get(key);
    if (!doc) return;
    const sent = await c.sendFile(this.entity(chatId), { file: doc });
    await this.emitSent(chatId, sent);
  }

  private messageFromUpdates(u: Api.TypeUpdates): Api.Message | undefined {
    const list = u instanceof Api.Updates || u instanceof Api.UpdatesCombined ? u.updates : [];
    for (const x of list) {
      if ((x instanceof Api.UpdateNewMessage || x instanceof Api.UpdateNewChannelMessage) && x.message instanceof Api.Message) return x.message;
    }
    return undefined;
  }

  // ---------- Excluir conversa e bloquear ----------

  async deleteChat(chatId: string, forEveryone: boolean) {
    const c = this.client!;
    const e = this.entities.get(chatId);
    if (e instanceof Api.Channel) {
      // Grupo grande ou canal: sair dele.
      await c.invoke(new Api.channels.LeaveChannel({ channel: await c.getInputEntity(e) }));
    } else if (e instanceof Api.Chat) {
      await c.invoke(new Api.messages.DeleteChatUser({ chatId: e.id, userId: new Api.InputUserSelf(), revokeHistory: forEveryone }));
      await c.invoke(new Api.messages.DeleteHistory({ peer: this.entity(chatId), maxId: 0, revoke: false })).catch(() => {});
    } else {
      // Conversa individual: apaga o histórico (de mim, ou dos dois), em partes até acabar.
      for (let i = 0; i < 50; i++) {
        const r = await c.invoke(new Api.messages.DeleteHistory({ peer: this.entity(chatId), maxId: 0, revoke: forEveryone, justClear: false }));
        if (!r.offset) break;
      }
    }
    this.contacts.delete(chatId);
    this.hooks.emit('chat:removed', { chatId });
    this.emitContacts();
  }

  async setBlockedContact(chatId: string, blocked: boolean) {
    await this.setBlocked(chatId, blocked);
    this.patch(chatId, { blocked });
  }

  // ---------- Exportar e avisos de print/gravação ----------

  private lastShot = new Map<string, number>();

  /** Avisa a outra pessoa que alguém tirou print (aviso oficial do Telegram, aparece em qualquer app). */
  async notifyScreenshot(chatId: string, lastId: number, context: string[] = []) {
    if (!this.client || this.paused) return;
    if (Date.now() - (this.lastShot.get(chatId) ?? 0) < 4000) return;
    this.lastShot.set(chatId, Date.now());
    try {
      const u = await this.client.invoke(
        new Api.messages.SendScreenshotNotification({
          peer: this.entity(chatId),
          replyTo: new Api.InputReplyToMessage({ replyToMsgId: lastId }),
          randomId: bigInt(Math.floor(Math.random() * 1e15)),
        }),
      );
      const m = this.messageFromUpdates(u);
      if (m) await this.emitSent(chatId, m, false);
    } catch {
      /* alguns tipos de conversa não aceitam */
    }
    if (context.length) await this.sendNotice(chatId, `${PRINT_CONTEXT_NOTICE} ${context.join(' e ')}`);
  }

  async notifyRecording(chatId: string) {
    await this.sendNotice(chatId, RECORDING_NOTICE);
  }

  private async sendNotice(chatId: string, text: string) {
    if (!this.client || this.paused) return;
    try {
      const n = await this.client.sendMessage(this.entity(chatId), { message: text, silent: true });
      await this.emitSent(chatId, n, false);
    } catch {
      /* sem conexão */
    }
  }

  /** Exporta a conversa (texto, em ordem) para um arquivo HTML e avisa a outra pessoa. */
  async exportChat(chatId: string): Promise<boolean> {
    const c = this.client!;
    const contact = this.contacts.get(chatId);
    const name = contact?.name ?? 'Conversa';
    const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
    const rows: string[] = [];
    let day = '';
    for await (const m of c.iterMessages(this.entity(chatId), { reverse: true, limit: 20000 })) {
      const cm = await this.toChatMessage(m as Api.Message, chatId);
      const d = new Date(cm.date * 1000);
      const dd = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      if (dd !== day) {
        day = dd;
        rows.push(`<h2>${esc(dd)}</h2>`);
      }
      const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (cm.service || cm.systemNotice || cm.destroyedNotice) {
        rows.push(`<p class="sys">${esc(`${cm.senderName} ${cm.text}`)} · ${hora}</p>`);
        continue;
      }
      const media = cm.media ? `<span class="midia">[${esc(cm.media.sensitive ? '🔞 mídia sensível' : mediaLabel(cm.media))}]</span> ` : '';
      const reply = cm.replyTo?.text ? `<blockquote>${esc(cm.replyTo.senderName)}: ${esc(cm.replyTo.text)}</blockquote>` : '';
      const flags = [cm.selfDestruct && `⏱ temporária (${cm.selfDestruct})`, cm.edited && 'editada', cm.forwardedFrom && `encaminhada de ${cm.forwardedFrom}`]
        .filter(Boolean)
        .join(' · ');
      rows.push(
        `<div class="m ${cm.out ? 'eu' : ''}"><div class="h"><b>${esc(cm.senderName)}</b> <span>${hora}${flags ? ' · ' + esc(flags) : ''}</span></div>${reply}<div class="t">${media}${esc(cm.nudge ? '📳 chamou a atenção' : cm.text).replace(/\n/g, '<br>')}</div></div>`,
      );
    }
    const now = new Date().toLocaleString('pt-BR');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Conversa com ${esc(name)}</title><style>
body{font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#1d2733;line-height:1.5}
header{border-bottom:2px solid #2b6cc4;margin-bottom:12px}h1{color:#174a8f;margin:0}header p{color:#6b7a8c;margin:4px 0 10px}
h2{font-size:13px;color:#6b7a8c;text-transform:capitalize;text-align:center;margin:18px 0 6px}
.m{padding:6px 0;border-bottom:1px solid #eef2f8}.h b{color:#174a8f}.eu .h b{color:#2f7d1f}.h span{color:#9aa7b8;font-size:12px}
.t{padding-left:12px;white-space:pre-wrap;word-break:break-word}.midia{color:#5a6fb0}.sys{text-align:center;color:#b35a00;font-style:italic;font-size:13px}
blockquote{margin:2px 0 2px 12px;padding:2px 8px;border-left:3px solid #2b6cc4;color:#6b7a8c;font-size:13px}
footer{margin-top:20px;color:#9aa7b8;font-size:12px;text-align:center}</style></head><body>
<header><h1>Conversa com ${esc(name)}</h1><p>Exportada por ${esc(this.me?.name ?? '')} em ${esc(now)} · Lex Messenger — Comunicação em primeiro lugar!</p></header>
${rows.join('\n')}
<footer>Arquivos, fotos e vídeos não são incluídos; aparecem como [anexo].</footer></body></html>`;
    const fileName = `Conversa com ${name.replace(/[\\/:*?"<>|]/g, '_')} - ${new Date().toISOString().slice(0, 10)}.html`;
    const saved = await this.platform.saveAs(fileName, Buffer.from(html, 'utf8'));
    if (saved) await this.sendNotice(chatId, EXPORT_NOTICE);
    return saved;
  }

  // ---------- Lista de tarefas ----------

  /**
   * Alguém marcou um item de uma lista que EU criei: atualizo ☐/☑ editando a minha mensagem,
   * para todos (inclusive no Telegram comum) verem o progresso.
   */
  private async syncChecklist(msg: Api.Message, chatId: string) {
    const t = parseToggle(msg.message ?? '');
    const replyId = msg.replyTo instanceof Api.MessageReplyHeader ? msg.replyTo.replyToMsgId : undefined;
    if (!t || !replyId || !this.client) return;
    try {
      const [orig] = await this.client.getMessages(this.entity(chatId), { ids: [replyId] });
      if (!orig?.out) return;
      const list = parseChecklist(orig.message ?? '');
      if (!list) return;
      const next = formatChecklist(applyToggle(list, t.item, t.done));
      if (next !== orig.message) await this.editMessage(chatId, replyId, next);
    } catch {
      /* sem permissão para editar ou mensagem apagada */
    }
  }

  // ---------- Favoritos (pasta "⭐ Favoritos" do Telegram) ----------

  private async loadFavorites() {
    try {
      const r = await this.client!.invoke(new Api.messages.GetDialogFilters());
      const filters = (r as unknown as { filters: Api.TypeDialogFilter[] }).filters ?? (r as unknown as Api.TypeDialogFilter[]);
      const fav = filters.find((f): f is Api.DialogFilter => f instanceof Api.DialogFilter && f.title?.text === 'Favoritos');
      this.favFolderId = fav?.id ?? null;
      this.favorites = new Set((fav?.includePeers ?? []).map((p) => utils.getPeerId(p)));
      return filters;
    } catch {
      return [];
    }
  }

  async setFavorite(chatId: string, favorite: boolean) {
    const c = this.client!;
    const filters = await this.loadFavorites();
    if (favorite) this.favorites.add(chatId);
    else this.favorites.delete(chatId);
    if (!this.favorites.size) {
      if (this.favFolderId != null) await c.invoke(new Api.messages.UpdateDialogFilter({ id: this.favFolderId }));
      this.favFolderId = null;
    } else {
      const id =
        this.favFolderId ??
        Math.max(1, ...filters.map((f) => (f instanceof Api.DialogFilter || f instanceof Api.DialogFilterChatlist ? f.id : 0))) + 1;
      const includePeers = await Promise.all([...this.favorites].map((pid) => c.getInputEntity(this.entity(pid))));
      try {
        await c.invoke(
          new Api.messages.UpdateDialogFilter({
            id,
            filter: new Api.DialogFilter({
              id,
              title: new Api.TextWithEntities({ text: 'Favoritos', entities: [] }),
              emoticon: '⭐',
              pinnedPeers: [],
              includePeers,
              excludePeers: [],
            }),
          }),
        );
      } catch (e) {
        const code = (e as { errorMessage?: string }).errorMessage ?? '';
        if (favorite) this.favorites.delete(chatId);
        if (code.includes('TOO_MUCH') || code.includes('LIMIT')) throw new Error('Limite de pastas ou de favoritos do Telegram atingido.');
        throw new Error('Não foi possível atualizar os favoritos.');
      }
      this.favFolderId = id;
    }
    this.patch(chatId, { favorite });
  }

  // ---------- Push (Android, via Firebase) ----------

  /** Registra este aparelho para receber as notificações push do Telegram, criptografadas com a chave dele. */
  async registerPush(token: string, secretB64: string) {
    await this.client!.invoke(
      new Api.account.RegisterDevice({ tokenType: 2, token, appSandbox: false, secret: Buffer.from(secretB64, 'base64'), otherUids: [] }),
    );
  }

  async unregisterPush(token: string) {
    await this.client?.invoke(new Api.account.UnregisterDevice({ tokenType: 2, token, otherUids: [] })).catch(() => {});
  }

  // ---------- Grupos ----------

  async createGroup(title: string, memberIds: string[]): Promise<{ chatId: string; notAdded: string[] }> {
    const c = this.client!;
    const name = title.trim().slice(0, 128);
    if (!name) throw new Error('Dê um nome ao grupo.');
    if (!memberIds.length) throw new Error('Escolha pelo menos uma pessoa.');
    const users = await Promise.all(memberIds.map((id) => c.getInputEntity(this.entity(id))));
    const r = await c.invoke(new Api.messages.CreateChat({ users, title: name }));
    const updates = r.updates as Api.Updates;
    const chat = updates.chats?.find((x) => x instanceof Api.Chat || x instanceof Api.Channel);
    if (!chat) throw new Error('O Telegram não confirmou a criação do grupo.');
    const chatId = utils.getPeerId(chat);
    this.entities.set(chatId, chat);
    const notAdded = r.missingInvitees.map((m) => this.contacts.get(m.userId.toString())?.name ?? 'Um contato');
    await this.loadDialogs();
    return { chatId, notAdded };
  }

  // ---------- Configurações da conta ----------

  async accountSettings(): Promise<AccountSettings> {
    const c = this.client!;
    const privacy = {} as AccountSettings['privacy'];
    for (const [k, make] of Object.entries(PRIVACY_KEYS) as [PrivacyKey, () => Api.TypeInputPrivacyKey][]) {
      try {
        const r = await c.invoke(new Api.account.GetPrivacy({ key: make() }));
        privacy[k] = privacyValue(r.rules);
      } catch {
        privacy[k] = 'everybody';
      }
    }
    const pwd = await c.invoke(new Api.account.GetPassword()).catch(() => null);
    const blockedRes = await c.invoke(new Api.contacts.GetBlocked({ offset: 0, limit: 200 })).catch(() => null);
    const blocked = (blockedRes?.users ?? []).filter((u): u is Api.User => u instanceof Api.User).map((u) => ({ id: u.id.toString(), name: fullName(u) }));
    const auths = await c.invoke(new Api.account.GetAuthorizations()).catch(() => null);
    const sessions = (auths?.authorizations ?? []).map((a) => ({
      hash: a.hash.toString(),
      device: [a.deviceModel, a.platform, a.systemVersion].filter(Boolean).join(' · '),
      app: `${a.appName} ${a.appVersion}`.trim(),
      place: [a.region, a.country].filter(Boolean).join(', '),
      lastActive: a.dateActive,
      current: !!a.current,
    }));
    return { privacy, twoStep: !!pwd?.hasPassword, blocked, sessions };
  }

  /** Muda a regra principal e mantém as exceções (pessoas e grupos) que já existiam. */
  async setPrivacy(key: PrivacyKey, value: PrivacyValue) {
    const c = this.client!;
    const current = await c.invoke(new Api.account.GetPrivacy({ key: PRIVACY_KEYS[key]() }));
    const exceptions: Api.TypeInputPrivacyRule[] = [];
    for (const r of current.rules) {
      if (r instanceof Api.PrivacyValueAllowUsers || r instanceof Api.PrivacyValueDisallowUsers) {
        const users = await Promise.all(r.users.map((id) => c.getInputEntity(id).catch(() => null)));
        const list = users.filter((u): u is Api.TypeInputPeer => !!u).map((u) => utils.getInputUser(u));
        if (list.length)
          exceptions.push(r instanceof Api.PrivacyValueAllowUsers ? new Api.InputPrivacyValueAllowUsers({ users: list }) : new Api.InputPrivacyValueDisallowUsers({ users: list }));
      } else if (r instanceof Api.PrivacyValueAllowChatParticipants) exceptions.push(new Api.InputPrivacyValueAllowChatParticipants({ chats: r.chats }));
      else if (r instanceof Api.PrivacyValueDisallowChatParticipants) exceptions.push(new Api.InputPrivacyValueDisallowChatParticipants({ chats: r.chats }));
    }
    const main =
      value === 'everybody'
        ? new Api.InputPrivacyValueAllowAll()
        : value === 'contacts'
          ? new Api.InputPrivacyValueAllowContacts()
          : new Api.InputPrivacyValueDisallowAll();
    await c.invoke(new Api.account.SetPrivacy({ key: PRIVACY_KEYS[key](), rules: [...exceptions, main] }));
  }

  async endSession(hash: string | 'others') {
    const c = this.client!;
    if (hash === 'others') await c.invoke(new Api.auth.ResetAuthorizations());
    else await c.invoke(new Api.account.ResetAuthorization({ hash: bigInt(hash) }));
  }

  async setBlocked(id: string, blocked: boolean) {
    const c = this.client!;
    const peer = await c.getInputEntity(this.entity(id));
    await c.invoke(blocked ? new Api.contacts.Block({ id: peer }) : new Api.contacts.Unblock({ id: peer }));
  }

  clearCache() {
    this.previews.clear();
    this.avatars.clear();
    void this.platform.clearTemp();
  }

  async sendFiles(chatId: string, files: FileInput[], sensitive = false) {
    if (!this.client) return;
    for (const [i, f] of files.entries()) {
      const name = fileName(f);
      const ext = name.toLowerCase().split('.').pop() ?? '';
      const visual = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? 'photo' : ['mp4', 'mov', 'm4v', 'webm'].includes(ext) ? 'video' : null;
      if ((sensitive || this.sensitiveChats.has(chatId)) && visual) {
        const data = typeof f === 'string' ? await this.platform.readFile?.(f) : f.data;
        if (data) {
          await this.sendSpoiler(chatId, name, data, visual);
          continue;
        }
      }
      const label = files.length > 1 ? `Enviando ${name} (${i + 1} de ${files.length})` : `Enviando ${name}`;
      this.hooks.emit('send:progress', { chatId, label, progress: 0 });
      try {
        const file = typeof f === 'string' ? f : new CustomFile(f.name, f.data.length, '', Buffer.from(f.data));
        const sent = await this.client.sendFile(this.entity(chatId), {
          file,
          caption: this.tag(chatId) || undefined,
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
    const name = `imagem-colada-${Date.now()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
    await this.sendFiles(chatId, [{ name, data: Buffer.from(m[2], 'base64') }]);
  }

  async sendVoice(chatId: string, ogg: Uint8Array, duration: number, waveform: number[]) {
    if (!this.client || !ogg.length) return;
    const label = 'Enviando áudio';
    this.hooks.emit('send:progress', { chatId, label, progress: 0 });
    try {
      const sent = await this.client.sendFile(this.entity(chatId), {
        file: new CustomFile(`audio-${Date.now()}.ogg`, ogg.length, '', Buffer.from(ogg)),
        voiceNote: true,
        caption: this.tag(chatId) || undefined,
        attributes: [new Api.DocumentAttributeAudio({ voice: true, duration: Math.round(duration), waveform: packWaveform(waveform) })],
        progressCallback: (p) => this.hooks.emit('send:progress', { chatId, label, progress: Number(p) }),
      });
      await this.emitSent(chatId, sent);
    } finally {
      this.hooks.emit('send:progress', { chatId, label: '', progress: null });
    }
  }

  /** Foto, vídeo ou recado redondo feitos com a câmera da conversa. */
  async sendCaptured(chatId: string, data: Uint8Array, o: CaptureOpts) {
    if (!this.client || !data.length) return;
    if (o.sensitive || this.sensitiveChats.has(chatId)) return this.sendSpoiler(chatId, o.name, data, o.kind, o);
    const label = { photo: 'Enviando foto', video: 'Enviando vídeo', round: 'Enviando recado' }[o.kind];
    this.hooks.emit('send:progress', { chatId, label, progress: 0 });
    try {
      const file = new CustomFile(o.name, data.length, '', Buffer.from(data));
      const isVideo = o.kind !== 'photo';
      const sent = await this.client.sendFile(this.entity(chatId), {
        file,
        // Recado (vídeo redondo) não aceita legenda; a marca vai nos outros.
        caption: o.kind === 'round' ? undefined : this.tag(chatId) || undefined,
        // Atenção: não usar "videoNote: true" do GramJS — ele também marca o arquivo como mensagem de VOZ,
        // e o Telegram passa a mostrar o recado como áudio. O recado é só o atributo de vídeo com roundMessage.
        supportsStreaming: isVideo,
        attributes: isVideo
          ? [
              new Api.DocumentAttributeVideo({
                duration: Math.max(1, Math.round(o.duration ?? 1)),
                w: o.width ?? 0,
                h: o.height ?? 0,
                roundMessage: o.kind === 'round',
                supportsStreaming: true,
              }),
            ]
          : undefined,
        progressCallback: (p) => this.hooks.emit('send:progress', { chatId, label, progress: Number(p) }),
      });
      await this.emitSent(chatId, sent);
    } finally {
      this.hooks.emit('send:progress', { chatId, label: '', progress: null });
    }
  }

  /** Baixa o anexo para tocar dentro do app (áudios, GIFs e vídeos até 150 MB), só na memória. */
  async mediaData(chatId: string, msgId: number): Promise<string | null> {
    const key = `data:${chatId}:${msgId}`;
    if (this.previews.has(key)) return this.previews.get(key)!;
    if (!this.client) return null;
    const msg = await this.getMessage(chatId, msgId);
    const info = msg && mediaOf(msg);
    if (!msg || !info || (info.size ?? 0) > 150 * 1024 * 1024) return null;
    const big = (info.size ?? 0) > 2 * 1024 * 1024;
    const label = info.kind === 'video' ? 'Carregando vídeo' : info.kind === 'gif' ? 'Carregando GIF' : 'Carregando áudio';
    const buf = await this.client
      .downloadMedia(msg, {
        progressCallback: big
          ? (got, total) => this.hooks.emit('send:progress', { chatId, label, progress: Number(total) ? Number(got) / Number(total) : null })
          : undefined,
      })
      .finally(() => big && this.hooks.emit('send:progress', { chatId, label: '', progress: null }));
    if (!buf || !Buffer.isBuffer(buf)) return null;
    const mime = info.kind === 'voice' ? 'audio/ogg' : info.mime || (info.kind === 'video' || info.kind === 'gif' ? 'video/mp4' : 'application/octet-stream');
    const url = `data:${mime};base64,${buf.toString('base64')}`;
    this.previews.set(key, url);
    return url;
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
        if (info.kind === 'photo' || (info.kind === 'webpage' && info.link?.hasPhoto)) buf = await this.client.downloadMedia(msg, {});
        else if (info.kind === 'sticker' && info.mime === 'image/webp') {
          buf = await this.client.downloadMedia(msg, {});
          mime = 'image/webp';
        } else if (info.kind === 'video' || info.kind === 'sticker' || info.kind === 'gif') {
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

  /** Baixa o anexo para a memória (não grava em disco). */
  private async download(chatId: string, msgId: number): Promise<{ name: string; data: Buffer } | null> {
    const msg = await this.getMessage(chatId, msgId);
    const info = msg && mediaOf(msg);
    if (!msg || !info) return null;
    const name = (info.name ?? `arquivo-${msgId}`).replace(/[/\\:]/g, '_');
    this.hooks.emit('send:progress', { chatId, label: `Baixando ${name}`, progress: 0 });
    try {
      const buf = await this.client!.downloadMedia(msg, {
        progressCallback: (got, total) =>
          this.hooks.emit('send:progress', { chatId, label: `Baixando ${name}`, progress: Number(total) ? Number(got) / Number(total) : null }),
      });
      return buf && Buffer.isBuffer(buf) ? { name, data: buf } : null;
    } finally {
      this.hooks.emit('send:progress', { chatId, label: '', progress: null });
    }
  }

  /** Abrir: cópia temporária, apagada quando o app fecha. */
  async openMedia(chatId: string, msgId: number) {
    const f = await this.download(chatId, msgId);
    if (f) await this.platform.openTemp(f.name, f.data);
  }

  /** Salvar…: só quando o usuário pede, no lugar que ele escolher. */
  async saveMedia(chatId: string, msgId: number): Promise<boolean> {
    const f = await this.download(chatId, msgId);
    return f ? this.platform.saveAs(f.name, f.data) : false;
  }


  // ---------- Meu perfil: status, bio, nome e foto ----------

  async setAppearOffline(offline: boolean) {
    this.appearOffline = offline;
    await this.applyStatus();
  }

  private async applyStatus() {
    if (!this.client || this.state !== 'ready' || this.paused) return;
    await this.client.invoke(new Api.account.UpdateStatus({ offline: this.appearOffline })).catch(() => {});
  }

  /** Desliga a conexão (aparece offline e não recebe nada). until: hora em ms, ou -1 = até ligar de novo. */
  async pause(until: number) {
    if (!this.client) return;
    this.paused = true;
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    await this.client.invoke(new Api.account.UpdateStatus({ offline: true })).catch(() => {});
    await this.client.disconnect().catch(() => {});
    this.hooks.emit('connection:changed', { connected: false, offlineUntil: until });
    if (until > 0) this.wakeTimer = setTimeout(() => void this.unpause(), Math.max(0, until - Date.now()));
  }

  /** Liga de novo e busca tudo o que chegou enquanto estava desligado. */
  async unpause() {
    if (!this.paused || !this.client) return;
    this.paused = false;
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    try {
      await this.client.connect();
    } catch {
      /* tenta de novo no resync */
    }
    this.hooks.emit('connection:changed', { connected: true, offlineUntil: 0 });
    await this.resync();
  }

  get isPaused() {
    return this.paused;
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
  async setPhoto(input: FileInput) {
    if (!this.client || !this.me) return;
    const jpeg = await this.platform.squareJpeg(input);
    const file = await this.client.uploadFile({ file: new CustomFile('foto.jpg', jpeg.length, '', jpeg), workers: 1 });
    await this.client.invoke(new Api.photos.UploadProfilePhoto({ file }));
    // Busca o perfil de novo: sem isso, o Lex baixaria a foto antiga (a referência guardada era a anterior).
    await this.refreshMyPhoto(true);
  }

  /** Relê o meu perfil e, se a foto mudou (aqui ou em outro aparelho), faz as janelas recarregarem a imagem. */
  private async refreshMyPhoto(force = false) {
    if (!this.client || !this.me) return;
    const before = this.myPhotoId;
    const version = this.me.photoVersion;
    await this.loadMe();
    if (!force && before === this.myPhotoId) return;
    this.avatars.delete('me');
    this.avatars.delete(this.me!.id);
    this.me = { ...this.me!, photoVersion: version + 1 };
    this.hooks.emit('me:changed', this.me);
  }
}
