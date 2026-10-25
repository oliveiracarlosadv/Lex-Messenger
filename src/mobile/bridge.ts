// Ponte do celular: oferece às telas a mesma "window.lex" do computador, mas rodando o motor
// do Telegram dentro do próprio app (não há processo principal separado no Android).
import { Haptics } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { Browser } from '@capacitor/browser';
import { MusicPermissionError, PresenceManager } from '../core/presence';
import { TelegramService } from '../core/telegram';
import { applyDemo } from '../shared/demoData';
import { STATUS } from '../shared/status';
import { NUDGE_TEXT, type ChatMessage, type Contact, type LexApi, type LexEvents, type MyStatus, type Prefs } from '../shared/types';
import { LexNative } from './native';
import { isIOS, isNative, mobilePlatform, pickFiles } from './platform';
import type { NudgeData } from '../renderer/components/NudgePopup';

declare const __APP_VERSION__: string;

const PREFS_KEY = 'lex-prefs';
const defaults: Prefs = {
  sounds: true,
  notifications: true,
  onlineAlerts: true,
  status: 'online',
  personalMessage: '',
  shareMusic: false,
  autoAway: false,
  notifPrimed: false,
  background: true,
  batteryAsked: false,
};

const CHANNEL = 'mensagens';

export interface InAppToast {
  chatId: string;
  title: string;
  body: string;
  hasPhoto: boolean;
  name: string;
  kind: 'message' | 'online' | 'nudge';
}

type Listener = (data: unknown) => void;

export class MobileBridge {
  private listeners = new Map<string, Set<Listener>>();
  private prefs: Prefs = { ...defaults };
  private tg: TelegramService;
  private presence: PresenceManager;
  private notifId = 1;
  /** Notificações abertas por conversa, para tirar da barra quando a conversa for lida. */
  private shown = new Map<string, number[]>();
  private lastNudge = new Map<string, number>();
  private lastOnlineAlert = 0;
  /** Conversa aberta na tela agora (o celular só mostra uma por vez). */
  currentChat: string | null = null;
  readonly demo: boolean;

  constructor() {
    this.demo = /[?&]demo\b/.test(location.search);
    this.tg = new TelegramService(
      {
        emit: (e, d) => this.emit(e, d),
        isChatOpenAndFocused: (id) => this.currentChat === id && document.visibilityState === 'visible',
        unreadChanged: () => {},
        ready: (me) => {
          this.presence.start(me);
          void this.setupBackground();
        },
        onContactOnline: (c) => this.onContactOnline(c),
        onIncoming: (m, c) => this.onIncoming(m, c),
      },
      mobilePlatform,
    );
    this.presence = new PresenceManager(
      this.tg,
      () => this.prefs,
      (p) => void this.savePrefs(p),
      (info) => this.emit('presence:changed', info),
      {
        // Música tocando no celular (precisa de "Acesso a notificações" liberado nos ajustes do Android).
        nowPlaying: async () => {
          if (this.demo) return null;
          const r = await LexNative.nowPlaying();
          if (!r.granted) throw new MusicPermissionError();
          return r.title ? { title: r.title, artist: r.artist ?? '' } : null;
        },
        musicPermissionHint: 'Libere o Lex em Ajustes > Notificações > Acesso a notificações (toque em 🎵 de novo para abrir).',
      },
    );
    if (this.demo) applyDemo(this.tg, /demo=login/.test(location.search));
  }

  async start() {
    try {
      const raw = (await Preferences.get({ key: PREFS_KEY })).value;
      if (raw) this.prefs = { ...defaults, ...JSON.parse(raw) };
    } catch {
      /* usa o padrão */
    }
    // Botões da notificação de "chamou a sua atenção": Abrir conversa / Agora não.
    void LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'NUDGE',
          actions: [
            { id: 'open', title: 'Abrir conversa', foreground: true },
            { id: 'later', title: 'Agora não', destructive: true },
          ],
        },
      ],
    }).catch(() => {});
    void LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
      if (a.actionId === 'later') return;
      const chatId = a.notification.extra?.chatId;
      if (chatId) this.openChat(String(chatId));
    }).catch(() => {});
    await mobilePlatform.clearTemp(); // apaga cópias temporárias de antes
    await this.tg.init(this.prefs.status === 'invisible');
  }

  /** Ao voltar para o app: busca o que chegou enquanto ele estava parado. */
  resync() {
    if (!this.demo) void this.tg.resync();
  }

  // ---------- Eventos ----------

  on(event: string, cb: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  emit<K extends keyof LexEvents>(event: K | 'toast' | 'nudge-popup', data: LexEvents[K] | InAppToast | NudgeData) {
    // Conversa lida (aqui ou em outro aparelho): some da barra de notificações.
    if (event === 'contact:patch') {
      const p = data as LexEvents['contact:patch'];
      if (p.unread === 0) this.clearNotifications(p.id);
    }
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  private sound(name: LexEvents['sound']) {
    if (this.prefs.sounds) this.emit('sound', name);
  }

  private async savePrefs(p: Partial<Prefs>) {
    this.prefs = { ...this.prefs, ...p };
    await Preferences.set({ key: PREFS_KEY, value: JSON.stringify(this.prefs) });
    this.emit('prefs:changed', this.prefs);
  }

  // ---------- Avisos ----------

  /** Permissões, canal de notificação e conexão em segundo plano (Android). */
  private async setupBackground() {
    try {
      const p = await LocalNotifications.checkPermissions();
      if (p.display !== 'granted') await LocalNotifications.requestPermissions();
      // Canal de alta prioridade: o aviso desce no alto da tela, com som e vibração.
      await LocalNotifications.createChannel({
        id: CHANNEL,
        name: 'Mensagens',
        description: 'Mensagens novas e chamadas de atenção',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#2b6cc4',
      });
    } catch {
      /* navegador comum: sem notificações do sistema */
    }
    await this.applyBackground();
    if (this.prefs.background && !this.prefs.batteryAsked) {
      const { unrestricted } = await LexNative.batteryStatus().catch(() => ({ unrestricted: true }));
      await this.savePrefs({ batteryAsked: true });
      if (!unrestricted) await LexNative.requestBatteryExemption().catch(() => {});
    }
  }

  private async applyBackground() {
    if (this.demo) return;
    if (this.prefs.background) await LexNative.startKeepAlive().catch(() => {});
    else await LexNative.stopKeepAlive().catch(() => {});
  }

  private clearNotifications(chatId: string) {
    const ids = this.shown.get(chatId);
    if (!ids?.length) return;
    this.shown.delete(chatId);
    void LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) }).catch(() => {});
    void LocalNotifications.removeDeliveredNotifications?.({ notifications: ids.map((id) => ({ id, title: '', body: '' })) }).catch(() => {});
  }

  private notify(chatId: string, title: string, body: string, actionTypeId?: string) {
    if (!this.prefs.notifications) return;
    const id = this.notifId++;
    this.shown.set(chatId, [...(this.shown.get(chatId) ?? []), id]);
    LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          largeBody: body,
          channelId: CHANNEL,
          group: chatId,
          extra: { chatId },
          actionTypeId,
          smallIcon: 'ic_stat_lex',
          iconColor: '#2b6cc4',
        },
      ],
    }).catch(() => {});
  }

  private onIncoming(m: ChatMessage, c: Contact | undefined) {
    if (c?.kind === 'channel' || c?.muted) return;
    const visible = document.visibilityState === 'visible';
    const inGroup = c && c.kind !== 'user' && c.kind !== 'self';
    const title = inGroup ? `${m.senderName} em ${c.name}` : m.senderName;
    if (m.nudge) {
      void Haptics.vibrate({ duration: 700 }).catch(() => {});
      this.sound('nudge');
      const who = c?.name ?? m.senderName;
      if (visible) {
        this.shake();
        // Fora da conversa: pergunta se quer abrir.
        if (this.currentChat !== m.chatId) this.emit('nudge-popup', { chatId: m.chatId, name: who, hasPhoto: !!c?.hasPhoto });
      }
      // Na barra de notificações, sempre: "Fulano chamou a sua atenção! Deseja abrir a conversa?" com botões.
      if (!(visible && this.currentChat === m.chatId)) this.notify(m.chatId, `📳 ${who} chamou a sua atenção!`, 'Deseja abrir a conversa?', 'NUDGE');
      return;
    }
    if (this.currentChat === m.chatId && visible) return;
    const body = m.text || (m.media ? 'enviou um anexo 📎' : '');
    if (visible) {
      this.sound('message');
      if (this.prefs.notifications)
        this.emit('toast', { kind: 'message', chatId: m.chatId, title, body, hasPhoto: !!c?.hasPhoto, name: c?.name ?? m.senderName });
    } else this.notify(m.chatId, `${title} diz:`, body);
  }

  private onContactOnline(c: Contact) {
    if (!this.prefs.onlineAlerts || document.visibilityState !== 'visible') return;
    if (Date.now() - this.lastOnlineAlert < 15000) return;
    this.lastOnlineAlert = Date.now();
    this.sound('online');
    if (this.prefs.notifications)
      this.emit('toast', { kind: 'online', chatId: c.id, title: c.name, body: 'acabou de entrar.', hasPhoto: c.hasPhoto, name: c.name });
  }

  shake() {
    document.body.classList.remove('shake');
    void document.body.offsetWidth;
    document.body.classList.add('shake');
    void Haptics.vibrate({ duration: 300 }).catch(() => {});
  }

  openChat(chatId: string) {
    this.clearNotifications(chatId);
    location.hash = `#/chat/${encodeURIComponent(chatId)}`;
  }

  // ---------- A mesma interface do computador ----------

  api(): LexApi {
    const tg = this.tg;
    return {
      version: __APP_VERSION__,
      platform: isNative ? 'android' : isIOS ? 'ios' : 'web',
      // No iPhone (Safari) não há como saber a música tocando.
      features: { music: isNative, mobile: true },
      on: (event, cb) => this.on(event, cb as Listener),
      authState: async () => tg.authState(),
      loginStart: async (method) => void tg.login(method),
      loginAnswer: async (v) => tg.answer(v),
      loginCancel: () => tg.cancelLogin(),
      logout: async () => {
        this.presence.stop();
        await LexNative.stopKeepAlive().catch(() => {});
        await tg.logout();
      },
      me: async () => tg.getMe(),
      contacts: async () => tg.listContacts(),
      contact: async (id) => tg.getContact(id),
      avatar: (id) => tg.avatar(id),
      history: (id, before) => tg.history(id, before),
      sendText: async (id, text) => {
        await tg.sendText(id, text);
        this.sound('sent');
      },
      sendNudge: async (id) => {
        if (Date.now() - (this.lastNudge.get(id) ?? 0) < 10000) return false;
        this.lastNudge.set(id, Date.now());
        await tg.sendText(id, NUDGE_TEXT);
        this.shake();
        this.sound('nudge');
        return true;
      },
      sendFiles: async (id, _paths, images) => {
        const files = await pickFiles(images ? 'image/*,video/*' : '*/*');
        if (files.length) await tg.sendFiles(id, files);
      },
      sendImageData: (id, dataUrl) => tg.sendImageData(id, dataUrl),
      sendVoice: async (id, ogg, duration, waveform) => {
        await tg.sendVoice(id, ogg, duration, waveform);
        this.sound('sent');
      },
      mediaData: (id, msg) => tg.mediaData(id, msg),
      // No Android, o pedido de microfone aparece sozinho ao começar a gravar.
      askMicrophone: async () => true,
      askCamera: async () => true,
      sendCaptured: async (id, data, opts) => {
        await tg.sendCaptured(id, data, opts);
        this.sound('sent');
      },
      sendReply: async (id, text, replyTo) => {
        await tg.sendText(id, text, replyTo);
        this.sound('sent');
      },
      editMessage: (id, msg, text) => tg.editMessage(id, msg, text),
      deleteMessages: (id, ids, all) => tg.deleteMessages(id, ids, all),
      forwardMessages: (from, ids, to) => tg.forwardMessages(from, ids, to),
      react: (id, msg, emoji) => tg.react(id, msg, emoji),
      transcribe: (id, msg) => tg.transcribe(id, msg),
      setMuted: (id, muted) => tg.setMuted(id, muted),
      settings: () => tg.accountSettings(),
      setPrivacy: (key, value) => tg.setPrivacy(key, value),
      endSession: (hash) => tg.endSession(hash),
      unblock: (id) => tg.setBlocked(id, false),
      block: (id) => tg.setBlocked(id, true),
      clearCache: async () => tg.clearCache(),
      openSettings: () => this.emit('settings:open', true),
      createGroup: (title, members) => tg.createGroup(title, members),
      setSelfDestruct: async (id, s) => tg.setSelfDestruct(id, s),
      setFavorite: (id, fav) => tg.setFavorite(id, fav),
      stickerPanel: () => tg.stickerPanel(),
      stickerPack: (id) => tg.stickerPack(id),
      searchGifs: (id, q) => tg.searchGifs(id, q),
      pickThumb: (key) => tg.pickThumb(key),
      sendPick: async (id, key) => {
        await tg.sendPick(id, key);
        this.sound('sent');
      },
      getSelfDestruct: async (id) => tg.getSelfDestruct(id),
      openSystemNotificationSettings: () => void LexNative.openNotificationSettings().catch(() => {}),
      copyText: (text) => void navigator.clipboard?.writeText(text).catch(() => {}),
      pathForFile: () => '',
      typing: (id) => tg.typing(id),
      markRead: (id) => {
        tg.markRead(id);
        this.clearNotifications(id);
      },
      mediaPreview: (id, msg) => tg.mediaPreview(id, msg),
      openMedia: (id, msg) => tg.openMedia(id, msg),
      saveMedia: (id, msg) => tg.saveMedia(id, msg),
      openChat: (id) => this.openChat(id),
      setStatus: async (s: MyStatus) => {
        if (!(s in STATUS)) return;
        await this.savePrefs({ status: s });
        await this.presence.refresh();
      },
      setPersonalMessage: async (text) => {
        await this.savePrefs({ personalMessage: text.slice(0, 70) });
        await this.presence.refresh();
      },
      setName: (first, last) => tg.setName(first, last),
      choosePhoto: async () => {
        const [img] = await pickFiles('image/*', false);
        if (!img) return false;
        await tg.setPhoto(img);
        return true;
      },
      presence: async () => this.presence.info(),
      refreshContact: (id) => tg.refreshContact(id),
      prefs: async () => this.prefs,
      setPrefs: async (p) => {
        // Ligou a música sem a permissão do Android: abre a tela para liberar.
        if (p.shareMusic && !this.demo && !(await LexNative.musicAccess().catch(() => ({ granted: true }))).granted)
          await LexNative.requestMusicAccess().catch(() => {});
        await this.savePrefs(p);
        if ('background' in p) await this.applyBackground();
        await this.presence.refresh();
        return this.prefs;
      },
      shakeMe: () => this.shake(),
      openExternal: (url) => {
        if (/^https?:\/\//i.test(url)) void Browser.open({ url });
      },
    };
  }
}
