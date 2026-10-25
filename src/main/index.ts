// Processo principal: janelas, ícone na barra de menus, Dock e notificações.
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, shell, Tray } from 'electron';
import { join } from 'node:path';
import { NUDGE_TEXT, type LexEvents, type MyStatus, type Prefs, type SoundName } from '../shared/types';
import { loadPrefs, savePrefs } from './store';
import { enableDemo, loginSnapshot, snapshot } from './demo';
import { TelegramService } from './telegram';

app.setName('Lex Messenger');
if (process.platform === 'win32') app.setAppUserModelId('br.com.lextecnologias.messenger');

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let listWin: BrowserWindow | null = null;
const chatWins = new Map<string, BrowserWindow>();
let tray: Tray | null = null;
let quitting = false;
let prefs: Prefs = loadPrefs();
let lastOnlineSound = 0;
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

const tg = new TelegramService({
  emit,
  isChatOpenAndFocused: (chatId) => {
    const w = chatWins.get(chatId);
    return !!w && !w.isDestroyed() && w.isFocused() && w.isVisible();
  },
  unreadChanged: (total) => {
    app.setBadgeCount(total);
    tray?.setToolTip(total ? `Lex Messenger — ${total} não lida(s)` : 'Lex Messenger');
  },
  onContactOnline: () => {
    if (!prefs.onlineAlerts) return;
    if (Date.now() - lastOnlineSound > 15000) {
      lastOnlineSound = Date.now();
      playSound('online');
    }
  },
  onIncoming: (msg, contact) => {
    const muted = contact?.kind === 'channel';
    if (muted) return;
    const win = chatWins.get(msg.chatId);
    const focused = !!win && !win.isDestroyed() && win.isFocused();
    if (msg.nudge) {
      const w = openChat(msg.chatId, false);
      shake(w);
      playSound('nudge');
      return;
    }
    if (focused) return;
    playSound('message');
    if (win && !win.isDestroyed()) win.flashFrame(true);
    if (process.platform === 'darwin') app.dock?.bounce('informational');
    if (prefs.notifications && Notification.isSupported()) {
      const where = contact && contact.kind === 'group' ? ` em ${contact.name}` : '';
      const n = new Notification({
        title: `${msg.senderName}${where} diz:`,
        body: msg.text || (msg.media ? 'enviou um anexo' : ''),
        silent: true,
      });
      n.on('click', () => openChat(msg.chatId));
      n.show();
    }
  },
});

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
  const statusItems: Electron.MenuItemConstructorOptions[] = [
    { label: 'Disponível', type: 'radio', checked: prefs.status === 'online', enabled: ready, click: () => void setStatus('online') },
    { label: 'Aparecer offline', type: 'radio', checked: prefs.status === 'invisible', enabled: ready, click: () => void setStatus('invisible') },
  ];
  const toggles: Electron.MenuItemConstructorOptions[] = [
    { label: 'Sons', type: 'checkbox', checked: prefs.sounds, click: (i) => updatePrefs({ sounds: i.checked }) },
    { label: 'Notificações', type: 'checkbox', checked: prefs.notifications, click: (i) => updatePrefs({ notifications: i.checked }) },
    { label: 'Avisar quando contatos entrarem', type: 'checkbox', checked: prefs.onlineAlerts, click: (i) => updatePrefs({ onlineAlerts: i.checked }) },
  ];
  const trayMenu = Menu.buildFromTemplate([
    { label: 'Abrir Lex Messenger', click: showList },
    { type: 'separator' },
    { label: 'Meu status', submenu: statusItems },
    ...toggles,
    { type: 'separator' },
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
  return prefs;
}

async function setStatus(status: MyStatus) {
  updatePrefs({ status });
  await tg.setStatus(status);
}

// ---------- Comunicação com as janelas ----------

function registerIpc() {
  ipcMain.handle('auth:state', () => tg.authState());
  ipcMain.handle('login:start', (_e, method: 'phone' | 'qr') => void tg.login(method));
  ipcMain.handle('login:answer', (_e, v: string) => tg.answer(String(v)));
  ipcMain.handle('login:cancel', () => tg.cancelLogin());
  ipcMain.handle('logout', async () => {
    for (const w of chatWins.values()) w.destroy();
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
  ipcMain.handle('send:files', async (e, chatId: string, paths?: string[]) => {
    let files = paths?.filter(Boolean) ?? [];
    if (!files.length) {
      const w = BrowserWindow.fromWebContents(e.sender);
      const r = await dialog.showOpenDialog(w!, {
        title: 'Enviar arquivos ou fotos',
        buttonLabel: 'Enviar',
        properties: ['openFile', 'multiSelections'],
      });
      if (r.canceled) return;
      files = r.filePaths;
    }
    await tg.sendFiles(chatId, files);
  });
  ipcMain.handle('send:image', (_e, chatId: string, dataUrl: string) => tg.sendImageData(chatId, dataUrl));
  ipcMain.on('typing', (_e, chatId: string) => tg.typing(chatId));
  ipcMain.on('mark-read', (_e, chatId: string) => tg.markRead(chatId));
  ipcMain.handle('media:preview', (_e, chatId: string, id: number) => tg.mediaPreview(chatId, id));
  ipcMain.handle('media:open', (_e, chatId: string, id: number) => tg.openMedia(chatId, id));
  ipcMain.handle('media:reveal', (_e, chatId: string, id: number) => tg.revealMedia(chatId, id));
  ipcMain.on('open-chat', (_e, chatId: string) => openChat(chatId));
  ipcMain.handle('status:set', (_e, s: MyStatus) => setStatus(s));
  ipcMain.handle('about:set', (_e, text: string) => tg.setAbout(String(text)));
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
    tray = new Tray(trayIcon());
    tray.setToolTip('Lex Messenger');
    tray.on('click', () => (process.platform === 'darwin' ? tray?.popUpContextMenu() : showList()));
    buildMenus();
    if (process.env.LEX_DEMO) enableDemo(tg);
    createListWindow();
    await tg.init(prefs.status);
    buildMenus();
    if (process.env.LEX_DEMO) snapshot(openChat, emit);
  });
  app.on('activate', showList);
  app.on('before-quit', async (e) => {
    if (quitting) return;
    quitting = true;
    e.preventDefault();
    await Promise.race([tg.goOffline(), new Promise((r) => setTimeout(r, 1500))]);
    app.quit();
  });
}
