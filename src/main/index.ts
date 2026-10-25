// Processo principal: janelas, ícone na barra de menus, Dock e notificações.
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, Notification, powerMonitor, shell, systemPreferences, Tray } from 'electron';
import { join } from 'node:path';
import { STATUS, STATUS_ORDER } from '../shared/status';
import { NUDGE_TEXT, type Contact, type LexEvents, type MyStatus, type Prefs, type SoundName } from '../shared/types';
import { loadPrefs, savePrefs } from './store';
import { enableDemo, loginSnapshot, snapshot } from './demo';
import { PresenceManager } from '../core/presence';
import { TelegramService } from '../core/telegram';
import { desktopPlatform, desktopPresence } from './platform';
import { showToast, type ToastData } from './toast';

app.setName('Lex Messenger');
// Os sons tocam sozinhos, sem precisar de um clique antes (o padrão do Chromium bloqueia).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Modo demonstração: pasta de dados separada, para não mexer na conta real nem brigar com o app aberto.
if (process.env.LEX_DEMO) app.setPath('userData', join(app.getPath('temp'), 'lex-messenger-demo'));
if (process.platform === 'win32') app.setAppUserModelId('br.com.lextecnologias.messenger');

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let listWin: BrowserWindow | null = null;
const chatWins = new Map<string, BrowserWindow>();
let tray: Tray | null = null;
let quitting = false;
let prefs: Prefs = loadPrefs();
let lastOnlineSound = 0;
let lastResync = Date.now();
const lastNudgeSent = new Map<string, number>();

function allWindows() {
  return BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
}

function emit<K extends keyof LexEvents>(event: K, data: LexEvents[K]) {
  for (const w of allWindows()) w.webContents.send(event, data);
  if (event === 'auth:state') buildMenus();
}

function playSound(name: SoundName) {
  if (!prefs.sounds) return;
  listWin?.webContents.send('sound', name);
}

const tg = new TelegramService(
  {
  emit,
  isChatOpenAndFocused: (chatId) => {
    const w = chatWins.get(chatId);
    return !!w && !w.isDestroyed() && w.isFocused() && w.isVisible();
  },
  unreadChanged: (total) => {
    // Contador no ícone do Dock (Mac) ou da barra de tarefas, e ao lado do ícone da barra de menus.
    if (process.platform === 'darwin') app.dock?.setBadge(total ? (total > 999 ? '999+' : String(total)) : '');
    else app.setBadgeCount(total);
    if (process.platform === 'darwin') tray?.setTitle(total ? ` ${total}` : '');
    tray?.setToolTip(total ? `Lex Messenger — ${total} não lida(s)` : 'Lex Messenger');
  },
  ready: (me) => {
    presence.start(me);
    askNotificationPermission();
  },
  onContactOnline: (c) => {
    if (!prefs.onlineAlerts) return;
    if (Date.now() - lastOnlineSound > 15000) {
      lastOnlineSound = Date.now();
      playSound('online');
      toast({ kind: 'online', chatId: c.id, title: c.name, body: 'acabou de entrar.', avatarId: c.id, hasPhoto: c.hasPhoto, name: c.name });
    }
  },
  onIncoming: (msg, contact) => {
    const muted = contact?.kind === 'channel' || !!contact?.muted;
    if (muted) return;
    const win = chatWins.get(msg.chatId);
    const focused = !!win && !win.isDestroyed() && win.isFocused();
    if (msg.nudge) {
      playSound('nudge');
      // Conversa aberta: ela treme. Se não estiver na frente, aparece a pergunta "Deseja abrir a conversa?".
      if (win && !win.isDestroyed()) shake(win);
      if (!focused) {
        nudgePopup(msg.chatId, contact?.name ?? msg.senderName, !!contact?.hasPhoto);
        if (process.platform === 'darwin') app.dock?.bounce('critical');
      }
      return;
    }
    if (focused) return;
    playSound('message');
    if (win && !win.isDestroyed()) win.flashFrame(true);
    if (process.platform === 'darwin') app.dock?.bounce('informational');
    const body = msg.text || (msg.media ? 'enviou um anexo 📎' : '');
    toastFor(msg.chatId, contact, msg.senderName, body, 'message');
  },
  },
  desktopPlatform,
);

const presence = new PresenceManager(
  tg,
  () => prefs,
  (p) => {
    prefs = { ...prefs, ...p };
    savePrefs(prefs);
    emit('prefs:changed', prefs);
  },
  (info) => {
    emit('presence:changed', info);
    buildMenus();
  },
  desktopPresence,
);

// ---------- "Chamou a sua atenção": pergunta se quer abrir a conversa ----------

let nudgeWin: BrowserWindow | null = null;

function nudgePopup(chatId: string, name: string, hasPhoto: boolean) {
  if (nudgeWin && !nudgeWin.isDestroyed()) nudgeWin.destroy();
  const w = new BrowserWindow({
    width: 400,
    height: 220,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    hasShadow: true,
    show: false,
    center: true,
    backgroundColor: '#00000000',
    webPreferences: webPreferences(),
  });
  w.setAlwaysOnTop(true, 'pop-up-menu');
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  secure(w);
  w.once('ready-to-show', () => {
    w.show();
    w.focus();
    shake(w);
  });
  w.on('closed', () => {
    if (nudgeWin === w) nudgeWin = null;
  });
  nudgeWin = w;
  load(w, `/nudge/${encodeURIComponent(JSON.stringify({ chatId, name, hasPhoto }))}`);
}

// ---------- Avisos no canto da tela (estilo MSN) ----------

/**
 * No macOS, o número no ícone do Dock só aparece se o app tiver permissão de notificações.
 * Na primeira conexão, um aviso de boas-vindas faz o sistema pedir essa permissão.
 */
function askNotificationPermission() {
  if (prefs.notifPrimed || !Notification.isSupported()) return;
  updatePrefs({ notifPrimed: true });
  new Notification({
    title: 'Lex Messenger conectado',
    body: 'Permita as notificações para ver o número de mensagens no ícone do Dock.',
    silent: true,
  }).show();
}

function toast(data: ToastData) {
  if (!prefs.notifications) return;
  showToast(
    data,
    (w, hash) => {
      secure(w);
      load(w, hash);
    },
    join(__dirname, 'preload.js'),
  );
}

function toastFor(chatId: string, contact: Contact | undefined, sender: string, body: string, kind: ToastData['kind']) {
  const inGroup = contact && contact.kind !== 'user' && contact.kind !== 'self';
  toast({
    kind,
    chatId,
    title: inGroup ? `${sender} em ${contact.name}` : sender,
    body,
    avatarId: chatId,
    hasPhoto: !!contact?.hasPhoto,
    name: contact?.name ?? sender,
  });
}



// ---------- Janelas ----------

function load(win: BrowserWindow, hash: string) {
  if (isDev) void win.loadURL(`${process.env.VITE_DEV_SERVER_URL}#${hash}`);
  else void win.loadFile(join(__dirname, '../dist/index.html'), { hash });
}

function secure(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://') && !(isDev && url.startsWith(process.env.VITE_DEV_SERVER_URL!))) e.preventDefault();
  });
}

const webPreferences = () => ({
  preload: join(__dirname, 'preload.js'),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  spellcheck: true,
});

function createListWindow() {
  listWin = new BrowserWindow({
    width: 340,
    height: 640,
    minWidth: 300,
    minHeight: 460,
    title: 'Lex Messenger',
    autoHideMenuBar: true,
    backgroundColor: '#dfeaf7',
    show: false,
    webPreferences: { ...webPreferences(), backgroundThrottling: false },
  });
  secure(listWin);
  listWin.once('ready-to-show', () => listWin?.show());
  listWin.on('close', (e) => {
    // Como no MSN: fechar a janela não desconecta; o app fica na barra de menus.
    if (!quitting) {
      e.preventDefault();
      listWin?.hide();
    }
  });
  listWin.on('closed', () => (listWin = null));
  // Ao voltar para o Lex: confere o que mudou (mensagens, foto trocada em outro aparelho…), no máximo 1x por minuto.
  listWin.on('focus', () => {
    if (Date.now() - lastResync > 60_000) {
      lastResync = Date.now();
      void tg.resync();
    }
  });
  load(listWin, '/');
}

function showList() {
  if (!listWin) createListWindow();
  else {
    listWin.show();
    listWin.focus();
  }
}

function openChat(chatId: string, focus = true): BrowserWindow {
  let win = chatWins.get(chatId);
  if (win && !win.isDestroyed()) {
    if (focus) {
      win.show();
      win.focus();
    } else if (!win.isVisible()) win.showInactive();
    return win;
  }
  const c = tg.getContact(chatId);
  const offset = (chatWins.size % 6) * 24;
  win = new BrowserWindow({
    width: 620,
    height: 520,
    minWidth: 440,
    minHeight: 360,
    title: c ? `${c.name} — Conversa` : 'Conversa',
    autoHideMenuBar: true,
    backgroundColor: '#eef4fb',
    show: false,
    webPreferences: webPreferences(),
  });
  const [x, y] = win.getPosition();
  win.setPosition(x + offset, y + offset);
  secure(win);
  const w = win;
  w.once('ready-to-show', () => (focus ? w.show() : w.showInactive()));
  w.on('focus', () => {
    w.flashFrame(false);
    tg.markRead(chatId);
  });
  w.on('closed', () => chatWins.delete(chatId));
  chatWins.set(chatId, w);
  load(w, `/chat/${encodeURIComponent(chatId)}`);
  return w;
}

/** Faz a janela tremer (chamar atenção). */
function shake(win: BrowserWindow) {
  if (win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  const offsets = [
    [-10, 0], [10, -4], [-8, 4], [8, 0], [-6, -4], [6, 4], [-4, 0], [4, -2], [-2, 2], [0, 0],
  ];
  offsets.forEach(([dx, dy], i) =>
    setTimeout(() => {
      if (!win.isDestroyed()) win.setPosition(x + dx, y + dy);
    }, i * 40),
  );
}

// ---------- Barra de menus (ícone ao lado do relógio) e Dock ----------

function trayIcon() {
  const base = app.isPackaged ? join(process.resourcesPath, 'tray') : join(__dirname, '../build/tray');
  if (process.platform !== 'darwin') return nativeImage.createFromPath(join(base, 'tray.png'));
  // No Mac, ícone "modelo": o sistema pinta de preto ou branco conforme o tema.
  const img = nativeImage.createFromPath(join(base, 'trayTemplate.png'));
  img.setTemplateImage(true);
  return img;
}

function buildMenus() {
  const ready = tg.authState() === 'ready';
  const statusItems: Electron.MenuItemConstructorOptions[] = STATUS_ORDER.map((s) => ({
    label: `${STATUS[s].emoji ? STATUS[s].emoji + '  ' : ''}${STATUS[s].label}`,
    type: 'radio' as const,
    checked: prefs.status === s,
    enabled: ready,
    click: () => void setStatus(s),
  }));
  const toggles: Electron.MenuItemConstructorOptions[] = [
    { label: 'Sons', type: 'checkbox', checked: prefs.sounds, click: (i) => updatePrefs({ sounds: i.checked }) },
    { label: 'Notificações', type: 'checkbox', checked: prefs.notifications, click: (i) => updatePrefs({ notifications: i.checked }) },
    { label: 'Avisar quando contatos entrarem', type: 'checkbox', checked: prefs.onlineAlerts, click: (i) => updatePrefs({ onlineAlerts: i.checked }) },
    { label: 'Mostrar a música que estou ouvindo', type: 'checkbox', checked: prefs.shareMusic, enabled: ready, click: (i) => updatePrefs({ shareMusic: i.checked }) },
    { label: 'Ficar Ausente quando o computador estiver parado', type: 'checkbox', checked: prefs.autoAway, click: (i) => updatePrefs({ autoAway: i.checked }) },
  ];
  const profileItem: Electron.MenuItemConstructorOptions = { label: 'Editar meu perfil…', enabled: ready, click: openProfile };
  const settingsItem: Electron.MenuItemConstructorOptions = { label: 'Configurações…', accelerator: 'CmdOrCtrl+,', enabled: ready, click: openSettings };
  const trayMenu = Menu.buildFromTemplate([
    { label: 'Abrir Lex Messenger', click: showList },
    { type: 'separator' },
    { label: 'Meu status', submenu: statusItems },
    profileItem,
    settingsItem,
    ...toggles,
    { type: 'separator' },
    { label: 'Tocar som de teste', click: () => playSound('message') },
    { label: 'Sair do Lex Messenger', click: () => app.quit() },
  ]);
  tray?.setContextMenu(trayMenu);

  if (process.platform === 'darwin') {
    app.dock?.setMenu(Menu.buildFromTemplate([{ label: 'Lista de contatos', click: showList }, { label: 'Meu status', submenu: statusItems }]));
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Lex Messenger',
        submenu: [
          { role: 'about', label: 'Sobre o Lex Messenger' },
          { type: 'separator' },
          { label: 'Meu status', submenu: statusItems },
          profileItem,
          settingsItem,
          ...toggles,
          { type: 'separator' },
          {
            label: 'Desconectar conta…',
            enabled: ready,
            click: async () => {
              const r = await dialog.showMessageBox({
                type: 'question',
                buttons: ['Desconectar', 'Cancelar'],
                defaultId: 1,
                message: 'Desconectar sua conta do Telegram deste Mac?',
                detail: 'Suas conversas continuam no Telegram. Para voltar, basta entrar de novo.',
              });
              if (r.response === 0) {
                for (const w of chatWins.values()) w.destroy();
                presence.stop();
                await tg.logout();
                buildMenus();
              }
            },
          },
          { type: 'separator' },
          { role: 'hide', label: 'Ocultar Lex Messenger' },
          { role: 'hideOthers', label: 'Ocultar outros' },
          { type: 'separator' },
          { role: 'quit', label: 'Sair do Lex Messenger' },
        ],
      },
      {
        label: 'Editar',
        submenu: [
          { role: 'undo', label: 'Desfazer' },
          { role: 'redo', label: 'Refazer' },
          { type: 'separator' },
          { role: 'cut', label: 'Recortar' },
          { role: 'copy', label: 'Copiar' },
          { role: 'paste', label: 'Colar' },
          { role: 'selectAll', label: 'Selecionar tudo' },
        ],
      },
      {
        label: 'Janela',
        submenu: [
          { label: 'Lista de contatos', accelerator: 'CmdOrCtrl+1', click: showList },
          { role: 'minimize', label: 'Minimizar' },
          { role: 'close', label: 'Fechar janela' },
          ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
        ],
      },
    ]),
  );
}

function updatePrefs(p: Partial<Prefs>) {
  prefs = { ...prefs, ...p };
  savePrefs(prefs);
  emit('prefs:changed', prefs);
  buildMenus();
  if ('shareMusic' in p || 'autoAway' in p || 'status' in p || 'personalMessage' in p) void presence.refresh();
  return prefs;
}

async function setStatus(status: MyStatus) {
  updatePrefs({ status });
}

function openSettings() {
  showList();
  listWin?.webContents.send('settings:open', true);
}

function openProfile() {
  showList();
  listWin?.webContents.send('profile:open', true);
}

// ---------- Comunicação com as janelas ----------

function registerIpc() {
  ipcMain.handle('auth:state', () => tg.authState());
  ipcMain.handle('login:start', (_e, method: 'phone' | 'qr') => void tg.login(method));
  ipcMain.handle('login:answer', (_e, v: string) => tg.answer(String(v)));
  ipcMain.handle('login:cancel', () => tg.cancelLogin());
  ipcMain.handle('logout', async () => {
    for (const w of chatWins.values()) w.destroy();
    presence.stop();
    await tg.logout();
  });
  ipcMain.handle('me', () => tg.getMe());
  ipcMain.handle('contacts', () => tg.listContacts());
  ipcMain.handle('contact', (_e, id: string) => tg.getContact(id));
  ipcMain.handle('avatar', (_e, id: string) => tg.avatar(id));
  ipcMain.handle('history', (_e, chatId: string, beforeId?: number) => tg.history(chatId, beforeId));
  ipcMain.handle('send:text', async (_e, chatId: string, text: string) => {
    await tg.sendText(chatId, text);
    playSound('sent');
  });
  ipcMain.handle('send:nudge', async (e, chatId: string) => {
    const last = lastNudgeSent.get(chatId) ?? 0;
    if (Date.now() - last < 10000) return false; // evita exageros
    lastNudgeSent.set(chatId, Date.now());
    await tg.sendText(chatId, NUDGE_TEXT);
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) shake(w);
    playSound('nudge');
    return true;
  });
  ipcMain.handle('send:files', async (e, chatId: string, paths?: string[], images?: boolean) => {
    let files = paths?.filter(Boolean) ?? [];
    if (!files.length) {
      const w = BrowserWindow.fromWebContents(e.sender);
      const r = await dialog.showOpenDialog(w!, {
        title: images ? 'Enviar fotos e vídeos' : 'Enviar arquivos',
        buttonLabel: 'Enviar',
        properties: ['openFile', 'multiSelections'],
        filters: images ? [{ name: 'Fotos e vídeos', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'mp4', 'mov', 'm4v'] }] : undefined,
      });
      if (r.canceled) return;
      files = r.filePaths;
    }
    await tg.sendFiles(chatId, files);
  });
  ipcMain.handle('send:image', (_e, chatId: string, dataUrl: string) => tg.sendImageData(chatId, dataUrl));
  ipcMain.handle('send:voice', async (_e, chatId: string, ogg: Uint8Array, duration: number, waveform: number[]) => {
    await tg.sendVoice(chatId, ogg, Number(duration), Array.isArray(waveform) ? waveform : []);
    playSound('sent');
  });
  ipcMain.handle('media:data', (_e, chatId: string, id: number) => tg.mediaData(chatId, id));
  ipcMain.handle('send:reply', async (_e, chatId: string, text: string, replyTo: number) => {
    await tg.sendText(chatId, text, Number(replyTo));
    playSound('sent');
  });
  ipcMain.handle('msg:edit', (_e, chatId: string, id: number, text: string) => tg.editMessage(chatId, Number(id), String(text)));
  ipcMain.handle('msg:delete', (_e, chatId: string, ids: number[], all: boolean) => tg.deleteMessages(chatId, ids.map(Number), !!all));
  ipcMain.handle('msg:forward', (_e, from: string, ids: number[], to: string) => tg.forwardMessages(from, ids.map(Number), to));
  ipcMain.handle('msg:react', (_e, chatId: string, id: number, emoji: string | null) => tg.react(chatId, Number(id), emoji));
  ipcMain.handle('msg:transcribe', (_e, chatId: string, id: number) => tg.transcribe(chatId, Number(id)));
  ipcMain.handle('chat:mute', (_e, chatId: string, muted: boolean) => tg.setMuted(chatId, !!muted));
  ipcMain.handle('settings:get', () => tg.accountSettings());
  ipcMain.handle('settings:privacy', (_e, key, value) => tg.setPrivacy(key, value));
  ipcMain.handle('settings:end-session', (_e, hash: string) => tg.endSession(String(hash)));
  ipcMain.handle('settings:block', (_e, id: string, blocked: boolean) => tg.setBlocked(String(id), !!blocked));
  ipcMain.handle('settings:clear-cache', () => tg.clearCache());
  ipcMain.on('settings:open', () => openSettings());
  ipcMain.on('copy', (_e, text: string) => clipboard.writeText(String(text)));
  ipcMain.handle('camera:ask', async () => {
    if (process.platform !== 'darwin') return true;
    if (systemPreferences.getMediaAccessStatus('camera') === 'granted') return true;
    return systemPreferences.askForMediaAccess('camera');
  });
  ipcMain.handle('send:captured', async (_e, chatId: string, data: Uint8Array, opts) => {
    await tg.sendCaptured(chatId, data, opts);
    playSound('sent');
  });
  ipcMain.handle('mic:ask', async () => {
    if (process.platform !== 'darwin') return true;
    if (systemPreferences.getMediaAccessStatus('microphone') === 'granted') return true;
    return systemPreferences.askForMediaAccess('microphone');
  });
  ipcMain.on('typing', (_e, chatId: string) => tg.typing(chatId));
  ipcMain.on('mark-read', (_e, chatId: string) => tg.markRead(chatId));
  ipcMain.handle('media:preview', (_e, chatId: string, id: number) => tg.mediaPreview(chatId, id));
  ipcMain.handle('media:open', (_e, chatId: string, id: number) => tg.openMedia(chatId, id));
  ipcMain.handle('media:save', (_e, chatId: string, id: number) => tg.saveMedia(chatId, id));
  ipcMain.on('open-chat', (_e, chatId: string) => openChat(chatId));
  ipcMain.handle('status:set', (_e, s: MyStatus) => (s in STATUS ? setStatus(s) : undefined));
  ipcMain.handle('pm:set', (_e, text: string) => void updatePrefs({ personalMessage: String(text).slice(0, 70) }));
  ipcMain.handle('name:set', (_e, first: string, last: string) => tg.setName(String(first), String(last ?? '')));
  ipcMain.handle('photo:choose', async (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(w!, {
      title: 'Escolha sua nova foto',
      buttonLabel: 'Usar esta foto',
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif'] }],
    });
    if (r.canceled || !r.filePaths[0]) return false;
    await tg.setPhoto(r.filePaths[0]);
    return true;
  });
  ipcMain.handle('presence', () => presence.info());
  ipcMain.on('contact:refresh', (_e, id: string) => tg.refreshContact(String(id)));
  ipcMain.handle('prefs', () => prefs);
  ipcMain.handle('prefs:set', (_e, p: Partial<Prefs>) => updatePrefs(p));
  ipcMain.on('shake-me', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) shake(w);
  });
  ipcMain.on('open-external', (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
  });
}

// ---------- Ciclo de vida ----------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showList);
  app.whenReady().then(async () => {
    registerIpc();
    void desktopPlatform.clearTemp(); // restos de uma sessão anterior que não fechou direito
    // Computador voltou da suspensão: reconecta e busca o que chegou.
    powerMonitor.on('resume', () => setTimeout(() => void tg.resync(), 3000));
    tray = new Tray(trayIcon());
    tray.setToolTip('Lex Messenger');
    tray.on('click', () => (process.platform === 'darwin' ? tray?.popUpContextMenu() : showList()));
    buildMenus();
    if (process.env.LEX_DEMO) enableDemo(tg);
    createListWindow();
    await tg.init(prefs.status === 'invisible');
    buildMenus();
    if (process.env.LEX_DEMO)
      snapshot({
        openChat,
        emit,
        list: () => listWin,
        toast: () => toastFor('101', tg.getContact('101') ?? undefined, 'Ana Paula', 'Recebeu a petição? Dá uma olhada quando puder 😊', 'message'),
        nudge: () => {
          nudgePopup('102', 'Dr. Ricardo Lima', false);
          return nudgeWin;
        },
      });
  });
  app.on('activate', showList);
  app.on('before-quit', async (e) => {
    if (quitting) return;
    quitting = true;
    e.preventDefault();
    await Promise.race([Promise.all([presence.shutdown(), tg.goOffline()]), new Promise((r) => setTimeout(r, 3000))]);
    await desktopPlatform.clearTemp(); // nada fica guardado depois que o app fecha
    app.quit();
  });
}
