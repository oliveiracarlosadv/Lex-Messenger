// Ponte do celular: oferece às telas a mesma "window.lex" do computador, mas rodando o motor
// do Telegram dentro do próprio app (não há processo principal separado no Android).
import { Haptics } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { Browser } from '@capacitor/browser';
import { PresenceManager } from '../core/presence';
import { TelegramService } from '../core/telegram';
import { applyDemo } from '../shared/demoData';
import { STATUS } from '../shared/status';
import { NUDGE_TEXT, type ChatMessage, type Contact, type LexApi, type LexEvents, type MyStatus, type Prefs } from '../shared/types';
import { mobilePlatform, pickFiles } from './platform';

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
};

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
          void this.askNotifications();
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
    void LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
      const chatId = a.notification.extra?.chatId;
      if (chatId) this.openChat(String(chatId));
    }).catch(() => {});
    await this.tg.init(this.prefs.status === 'invisible');
  }

  // ---------- Eventos ----------

  on(event: string, cb: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  emit<K extends keyof LexEvents>(event: K | 'toast', data: LexEvents[K] | InAppToast) {
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

  private async askNotifications() {
    try {
      const p = await LocalNotifications.checkPermissions();
      if (p.display !== 'granted') await LocalNotifications.requestPermissions();
    } catch {
      /* navegador comum: sem notificações do sistema */
    }
  }

  private notify(chatId: string, title: string, body: string) {
    if (!this.prefs.notifications) return;
    LocalNotifications.schedule({
      notifications: [{ id: this.notifId++, title, body, extra: { chatId }, smallIcon: 'ic_stat_lex', iconColor: '#2b6cc4' }],
    }).catch(() => {});
  }

  private onIncoming(m: ChatMessage, c: Contact | undefined) {
    if (c?.kind === 'channel') return;
    const visible = document.visibilityState === 'visible';
    const inGroup = c && c.kind !== 'user' && c.kind !== 'self';
    const title = inGroup ? `${m.senderName} em ${c.name}` : m.senderName;
    if (m.nudge) {
      void Haptics.vibrate({ duration: 700 }).catch(() => {});
      this.sound('nudge');
      if (visible) {
        this.openChat(m.chatId);
        this.shake();
      } else this.notify(m.chatId, title, '📳 chamou a sua atenção!');
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
    location.hash = `#/chat/${encodeURIComponent(chatId)}`;
  }

  // ---------- A mesma interface do computador ----------

  api(): LexApi {
    const tg = this.tg;
    return {
      version: __APP_VERSION__,
      platform: this.demo ? 'web' : 'android',
      features: { music: false, mobile: true },
      on: (event, cb) => this.on(event, cb as Listener),
      authState: async () => tg.authState(),
      loginStart: async (method) => void tg.login(method),
      loginAnswer: async (v) => tg.answer(v),
      loginCancel: () => tg.cancelLogin(),
      logout: async () => {
        this.presence.stop();
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
      sendFiles: async (id) => {
        const files = await pickFiles();
        if (files.length) await tg.sendFiles(id, files);
      },
      sendImageData: (id, dataUrl) => tg.sendImageData(id, dataUrl),
      pathForFile: () => '',
      typing: (id) => tg.typing(id),
      markRead: (id) => tg.markRead(id),
      mediaPreview: (id, msg) => tg.mediaPreview(id, msg),
      openMedia: (id, msg) => tg.openMedia(id, msg),
      revealMedia: (id, msg) => tg.revealMedia(id, msg),
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
        await this.savePrefs(p);
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
