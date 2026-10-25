// Aviso no estilo MSN: uma janelinha que sobe no canto inferior direito da tela.
import { BrowserWindow, screen } from 'electron';

export interface ToastData {
  kind: 'message' | 'online' | 'nudge';
  chatId: string;
  title: string;
  body: string;
  avatarId: string;
  hasPhoto: boolean;
  name: string;
}

const WIDTH = 300;
const HEIGHT = 116;
const GAP = 8;
const MAX = 4;
const toasts: BrowserWindow[] = [];
const toastChat = new WeakMap<BrowserWindow, string>();

/** Conversa lida: fecha os avisos dela que ainda estão na tela. */
export function closeToasts(chatId: string) {
  for (const w of [...toasts]) if (!w.isDestroyed() && toastChat.get(w) === chatId) w.close();
}

type Setup = (win: BrowserWindow, hash: string) => void;

function targetY(index: number) {
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  return { x: wa.x + wa.width - WIDTH - 12, y: wa.y + wa.height - (HEIGHT + GAP) * (index + 1), bottom: wa.y + wa.height };
}

/** Anima a janela até a posição (sobe ou se reacomoda). */
function slide(win: BrowserWindow, fromY: number, toY: number, x: number) {
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    setTimeout(() => {
      if (win.isDestroyed()) return;
      const t = 1 - Math.pow(1 - i / steps, 3);
      win.setBounds({ x, y: Math.round(fromY + (toY - fromY) * t), width: WIDTH, height: HEIGHT });
    }, i * 18);
  }
}

function restack() {
  toasts.forEach((w, i) => {
    if (w.isDestroyed()) return;
    const { x, y } = targetY(i);
    slide(w, w.getBounds().y, y, x);
  });
}

export function showToast(data: ToastData, setup: Setup, preload: string) {
  while (toasts.length >= MAX) toasts.shift()?.destroy();
  const index = toasts.length;
  const { x, y, bottom } = targetY(index);
  const win = new BrowserWindow({
    x,
    y: bottom,
    width: WIDTH,
    height: HEIGHT,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    transparent: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: { preload, contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.setAlwaysOnTop(true, 'pop-up-menu');
  // skipTransformProcessType: sem isso, o macOS tira o Lex do Dock e do Cmd+Tab.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  toasts.push(win);
  toastChat.set(win, data.chatId);
  win.on('closed', () => {
    const i = toasts.indexOf(win);
    if (i >= 0) toasts.splice(i, 1);
    restack();
  });
  win.once('ready-to-show', () => {
    win.showInactive();
    slide(win, bottom, y, x);
  });
  setup(win, `/toast/${encodeURIComponent(JSON.stringify(data))}`);
}
