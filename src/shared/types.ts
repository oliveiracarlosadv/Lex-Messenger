// Tipos trocados entre o processo principal (Telegram) e as janelas.

export type Presence = 'online' | 'away' | 'offline';
import type { MyStatus } from './status';
export type { MyStatus } from './status';
export type ContactKind = 'user' | 'bot' | 'group' | 'channel' | 'self';

export interface Contact {
  id: string;
  name: string;
  kind: ContactKind;
  presence: Presence;
  /** Texto curto: "visto por último…" ou nº de membros. */
  subtitle: string;
  lastMessage: string;
  lastDate: number;
  unread: number;
  hasPhoto: boolean;
  pinned: boolean;
  /** Bio do contato no Telegram (mensagem pessoal, música e status do Lex). */
  about: string;
  /** Status do Lex lido da bio (Ocupado, Ausente…). */
  status?: MyStatus;
  /** Conversa silenciada: sem som nem aviso. */
  muted?: boolean;
  /** Assinante do Telegram Premium (selo ⭐). */
  premium?: boolean;
  /** Até que mensagem minha a pessoa já leu (para os ✓✓). */
  readOutboxMaxId?: number;
}

export interface Me {
  id: string;
  name: string;
  username: string;
  phone: string;
  firstName: string;
  lastName: string;
  /** Bio atual no Telegram, como está lá. */
  about: string;
  hasPhoto: boolean;
  /** Muda a cada troca de foto, para as janelas recarregarem a imagem. */
  photoVersion: number;
  premium?: boolean;
}

export type MediaKind = 'photo' | 'video' | 'audio' | 'voice' | 'sticker' | 'file' | 'webpage' | 'other';

export interface MediaInfo {
  kind: MediaKind;
  name?: string;
  size?: number;
  mime?: string;
  /** Áudio e vídeo: duração em segundos. */
  duration?: number;
  /** Mensagem de voz: 100 valores de 0 a 31 (a "onda"). */
  waveform?: number[];
  /** Vídeo redondo ("recado") do Telegram. */
  round?: boolean;
  width?: number;
  height?: number;
  /** Prévia de link. */
  link?: { url: string; site?: string; title?: string; description?: string; hasPhoto: boolean };
}

export interface ChatMessage {
  id: number;
  chatId: string;
  out: boolean;
  senderId: string;
  senderName: string;
  date: number;
  text: string;
  media?: MediaInfo;
  nudge?: boolean;
  service?: boolean;
  /** Mensagem respondida. */
  replyTo?: { id: number; senderName: string; text: string };
  /** Encaminhada de quem. */
  forwardedFrom?: string;
  edited?: boolean;
  reactions?: Reaction[];
}

export interface CaptureOpts {
  kind: 'photo' | 'video' | 'round';
  name: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface Session {
  hash: string;
  device: string;
  app: string;
  place: string;
  lastActive: number;
  current: boolean;
}

export type PrivacyKey = 'lastSeen' | 'photo' | 'phone' | 'invites' | 'forwards' | 'calls';
export type PrivacyValue = 'everybody' | 'contacts' | 'nobody';

export interface AccountSettings {
  privacy: Record<PrivacyKey, PrivacyValue>;
  twoStep: boolean;
  blocked: { id: string; name: string }[];
  sessions: Session[];
}

export type LoginStep =
  | { step: 'phone'; error?: string }
  | { step: 'code'; viaApp: boolean; error?: string }
  | { step: 'password'; hint?: string; error?: string }
  | { step: 'qr'; url: string; expires: number; error?: string }
  | { step: 'done' }
  | { step: 'failed'; error: string };

export type AuthState = 'missing-keys' | 'logged-out' | 'connecting' | 'ready';

export interface Prefs {
  sounds: boolean;
  notifications: boolean;
  onlineAlerts: boolean;
  status: MyStatus;
  personalMessage: string;
  shareMusic: boolean;
  autoAway: boolean;
  /** Já pedimos a permissão de notificações (para o contador do Dock). */
  notifPrimed: boolean;
  /** Android: manter conectado em segundo plano (aviso fixo "Conectado ao Telegram"). */
  background: boolean;
  /** Android: já pedimos para o sistema não economizar bateria no app. */
  batteryAsked: boolean;
}

export interface PresenceInfo {
  /** Status escolhido. */
  status: MyStatus;
  /** Status em vigor (vira "Ausente" sozinho quando o computador fica parado). */
  effective: MyStatus;
  autoAway: boolean;
  music: string | null;
  musicError?: string;
}

export type SoundName = 'message' | 'online' | 'nudge' | 'sent';

/** Texto enviado para "chamar a atenção". Outro Lex Messenger reconhece e faz a janela tremer. */
export const NUDGE_TEXT = '📳 Chamou sua atenção!';

export interface LexEvents {
  'auth:state': AuthState;
  'login:step': LoginStep;
  'contacts:changed': Contact[];
  'contact:patch': Partial<Contact> & { id: string };
  'me:changed': Me;
  'message:new': ChatMessage;
  'message:deleted': { chatId?: string; ids: number[] };
  typing: { chatId: string; name: string };
  sound: SoundName;
  nudge: { chatId: string };
  'send:progress': { chatId: string; label: string; progress: number | null };
  'prefs:changed': Prefs;
  'presence:changed': PresenceInfo;
  'profile:open': true;
  /** Voltou a conexão depois de um tempo parado: as conversas abertas recarregam. */
  'chat:resync': true;
  /** Mensagem editada ou com reações novas. */
  'message:patch': Partial<ChatMessage> & { chatId: string; id: number };
  /** Transcrição de áudio pronta (ou em andamento). */
  transcription: { chatId: string; id: number; text: string; pending: boolean };
  'settings:open': true;
}

export interface LexApi {
  version: string;
  platform: string;
  /** O que esta plataforma oferece (o celular não tem janelas separadas nem leitura de música). */
  features: { music: boolean; mobile: boolean };
  on<K extends keyof LexEvents>(event: K, cb: (data: LexEvents[K]) => void): () => void;
  authState(): Promise<AuthState>;
  loginStart(method: 'phone' | 'qr'): Promise<void>;
  loginAnswer(value: string): Promise<void>;
  loginCancel(): Promise<void>;
  logout(): Promise<void>;
  me(): Promise<Me | null>;
  contacts(): Promise<Contact[]>;
  contact(id: string): Promise<Contact | null>;
  avatar(id: string): Promise<string | null>;
  history(chatId: string, beforeId?: number): Promise<ChatMessage[]>;
  sendText(chatId: string, text: string): Promise<void>;
  sendNudge(chatId: string): Promise<boolean>;
  sendFiles(chatId: string, paths?: string[], images?: boolean): Promise<void>;
  sendImageData(chatId: string, dataUrl: string): Promise<void>;
  /** Envia uma mensagem de voz já em Ogg/Opus. */
  sendVoice(chatId: string, ogg: Uint8Array, duration: number, waveform: number[]): Promise<void>;
  /** Baixa um anexo (ex.: áudio) e devolve como data: URL para tocar dentro do app. */
  mediaData(chatId: string, msgId: number): Promise<string | null>;
  /** Pede acesso ao microfone (no Mac, o sistema pergunta na primeira vez). */
  askMicrophone(): Promise<boolean>;
  askCamera(): Promise<boolean>;
  /** Envia o que foi feito com a câmera da conversa: foto, vídeo ou recado redondo. */
  sendCaptured(chatId: string, data: Uint8Array, opts: CaptureOpts): Promise<void>;
  sendReply(chatId: string, text: string, replyTo: number): Promise<void>;
  editMessage(chatId: string, id: number, text: string): Promise<void>;
  deleteMessages(chatId: string, ids: number[], forEveryone: boolean): Promise<void>;
  forwardMessages(fromChat: string, ids: number[], toChat: string): Promise<void>;
  react(chatId: string, id: number, emoji: string | null): Promise<void>;
  transcribe(chatId: string, id: number): Promise<{ text: string; pending: boolean }>;
  setMuted(chatId: string, muted: boolean): Promise<void>;
  settings(): Promise<AccountSettings>;
  setPrivacy(key: PrivacyKey, value: PrivacyValue): Promise<void>;
  endSession(hash: string | 'others'): Promise<void>;
  unblock(id: string): Promise<void>;
  block(id: string): Promise<void>;
  clearCache(): Promise<void>;
  openSettings(): void;
  openSystemNotificationSettings?(): void;
  copyText(text: string): void;
  pathForFile(file: File): string;
  typing(chatId: string): void;
  markRead(chatId: string): void;
  mediaPreview(chatId: string, msgId: number): Promise<string | null>;
  openMedia(chatId: string, msgId: number): Promise<void>;
  /** Abre uma cópia temporária do anexo (apagada ao fechar o app). */
  saveMedia(chatId: string, msgId: number): Promise<boolean>;
  openChat(chatId: string): void;
  setStatus(status: MyStatus): Promise<void>;
  setPersonalMessage(text: string): Promise<void>;
  setName(first: string, last: string): Promise<void>;
  choosePhoto(): Promise<boolean>;
  presence(): Promise<PresenceInfo>;
  refreshContact(id: string): void;
  prefs(): Promise<Prefs>;
  setPrefs(p: Partial<Prefs>): Promise<Prefs>;
  shakeMe(): void;
  openExternal(url: string): void;
}
