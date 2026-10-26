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
  /** Está na pasta "⭐ Favoritos" do Telegram. */
  favorite?: boolean;
  /** Telefone, quando a pessoa compartilha com você no Telegram (para SMS/RCS). */
  phone?: string;
  /** Você bloqueou esta pessoa. */
  blocked?: boolean;
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

export type MediaKind = 'photo' | 'video' | 'audio' | 'voice' | 'sticker' | 'gif' | 'file' | 'webpage' | 'other';

export interface MediaInfo {
  kind: MediaKind;
  name?: string;
  size?: number;
  mime?: string;
  /** Áudio e vídeo: duração em segundos. */
  duration?: number;
  /** Mensagem de voz: 100 valores de 0 a 31 (a "onda"). */
  waveform?: number[];
  /** Figurinha: imagem parada, vídeo (webm) ou animação do Telegram (tgs). */
  anim?: 'static' | 'video' | 'lottie';
  /** Mídia sensível (spoiler do Telegram): fica coberta até a pessoa tocar. */
  sensitive?: boolean;
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
  /** Mensagem temporária: "1 min", "1 h"… (some sozinha). */
  selfDestruct?: string;
  /** Aviso "🔥 Mensagem autodestruída" (também some em 12 h). */
  destroyedNotice?: boolean;
  /** Aviso do Lex: exportou a conversa, gravou a tela… */
  systemNotice?: boolean;
}

/** Figurinha ou GIF no seletor. */
export interface PickItem {
  key: string;
  kind: 'sticker' | 'gif';
}
export interface StickerPack {
  id: string;
  title: string;
}

export interface CaptureOpts {
  kind: 'photo' | 'video' | 'round';
  name: string;
  /** Mandar coberta, como "🔞 mídia sensível". */
  sensitive?: boolean;
  duration?: number;
  width?: number;
  height?: number;
}

/** Pessoa para começar conversa: contato do Telegram ou da agenda do celular. */
export interface PersonEntry {
  /** Id no Telegram (vazio se a pessoa não tem Telegram). */
  id: string;
  name: string;
  phone?: string;
  hasPhoto?: boolean;
  online?: boolean;
  onTelegram: boolean;
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
  /** Número sem conta no Telegram: nome, sobrenome e aceite dos Termos. Resposta: JSON {first, last}. */
  | { step: 'signup'; error?: string }
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
  /** Silencioso: sem som, sem vibração e sem avisos na tela (as mensagens continuam chegando). */
  silent: boolean;
  /** Desligado até esta hora (ms). 0 = ligado; -1 = desligado até a pessoa ligar de novo. */
  offlineUntil: number;
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

/** Avisos que o Lex manda para a outra pessoa (aparecem como aviso no meio da conversa). */
export const EXPORT_NOTICE = '📤 Exportou esta conversa';
export const RECORDING_NOTICE = '🎥 Começou a gravar a tela nesta conversa';
export const PRINT_CONTEXT_NOTICE = '⚠️ O print incluiu';
export const isSystemNotice = (t: string) => t === EXPORT_NOTICE || t === RECORDING_NOTICE || t.startsWith(PRINT_CONTEXT_NOTICE);

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
  /** Ligou/desligou a conexão (botão Desligado). */
  'connection:changed': { connected: boolean; offlineUntil: number };
  /** Conversa excluída: as janelas dela fecham. */
  'chat:removed': { chatId: string };
  /** Conversa limpa: as janelas dela esvaziam o histórico. */
  'chat:cleared': { chatId: string };
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
  /** Escolhe arquivos (sem enviar ainda): devolve referências e nomes para a confirmação. */
  pickFiles(images?: boolean): Promise<{ id: string; name: string }[]>;
  /** Envia os arquivos escolhidos; sensitive = fotos e vídeos vão cobertos (🔞). */
  sendFiles(chatId: string, ids?: string[], images?: boolean, sensitive?: boolean): Promise<void>;
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
  /** Cria um grupo com os contatos escolhidos. Devolve o id da conversa e quem não pôde ser adicionado. */
  createGroup(title: string, memberIds: string[]): Promise<{ chatId: string; notAdded: string[] }>;
  /** Liga (segundos) ou desliga (0) a autodestruição das próximas mensagens da conversa. */
  setSelfDestruct(chatId: string, seconds: number): Promise<void>;
  getSelfDestruct(chatId: string): Promise<number>;
  /** Põe ou tira da pasta "⭐ Favoritos" (sincronizada com todos os aparelhos e com o Telegram oficial). */
  setFavorite(chatId: string, favorite: boolean): Promise<void>;
  /** Liga/desliga "próximas fotos e vídeos como sensíveis" nesta conversa. */
  setSensitive(chatId: string, on: boolean): Promise<void>;
  /** Desliga o app por um tempo (minutos; 0 = até ligar de novo) ou liga de novo (null). */
  setOffline(minutes: number | null): Promise<void>;
  /** Exporta a conversa para um arquivo (a outra pessoa é avisada). Devolve false se desistir. */
  exportChat(chatId: string): Promise<boolean>;
  /** Exclui a conversa (para mim, ou para os dois). Em grupos e canais: sai deles. */
  deleteChat(chatId: string, forEveryone: boolean): Promise<void>;
  setBlockedContact(chatId: string, blocked: boolean): Promise<void>;
  /** Limpa todas as mensagens, mas mantém a conversa na lista (para mim, ou para os dois). */
  clearChat(chatId: string, forEveryone: boolean): Promise<void>;
  /** Contatos salvos no Telegram (inclusive com quem nunca conversou). */
  telegramContacts(): Promise<PersonEntry[]>;
  /** Confere no Telegram quais destes números têm conta. */
  lookupPhones(people: { name: string; phone: string }[]): Promise<PersonEntry[]>;
  /** Celular (Android): lê a agenda do aparelho (pede permissão). null = sem permissão / indisponível. */
  deviceContacts?(): Promise<{ name: string; phone: string }[] | null>;
  /** Abre (ou cria) a conversa com uma pessoa do Telegram. */
  startChat(userId: string): Promise<void>;
  /** O que está na tela da conversa agora (para avisar sobre prints e gravações). */
  reportView(chatId: string, view: { lastId: number; sensitive: boolean; temporary: boolean } | null): void;
  getSensitive(chatId: string): Promise<boolean>;
  /** Figurinhas recentes, pacotes instalados e GIFs salvos. */
  stickerPanel(): Promise<{ recent: PickItem[]; packs: StickerPack[]; gifs: PickItem[] }>;
  stickerPack(id: string): Promise<PickItem[]>;
  searchGifs(chatId: string, query: string): Promise<PickItem[]>;
  /** Miniatura de uma figurinha/GIF do seletor. */
  pickThumb(key: string): Promise<{ url: string; video: boolean } | null>;
  sendPick(chatId: string, key: string): Promise<void>;
  openSystemNotificationSettings?(): void;
  /** Celular: as notificações push (Firebase) estão funcionando? */
  pushActive?(): Promise<boolean>;
  pushInfo?(): Promise<{ active: boolean; error: string; lastAt: number; lastResult: string; count: number }>;
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
  /** Abre o app de mensagens do aparelho (SMS/RCS) com o número e o texto prontos. */
  openSms(phone: string, text: string): void;
}
