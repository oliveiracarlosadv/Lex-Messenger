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
}

export type MediaKind = 'photo' | 'video' | 'audio' | 'voice' | 'sticker' | 'file' | 'other';

export interface MediaInfo {
  kind: MediaKind;
  name?: string;
  size?: number;
  mime?: string;
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
}

export interface LexApi {
  version: string;
  platform: string;
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
  sendFiles(chatId: string, paths?: string[]): Promise<void>;
  sendImageData(chatId: string, dataUrl: string): Promise<void>;
  pathForFile(file: File): string;
  typing(chatId: string): void;
  markRead(chatId: string): void;
  mediaPreview(chatId: string, msgId: number): Promise<string | null>;
  openMedia(chatId: string, msgId: number): Promise<void>;
  revealMedia(chatId: string, msgId: number): Promise<void>;
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
