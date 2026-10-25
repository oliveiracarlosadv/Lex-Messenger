// Modo demonstração (LEX_DEMO=1): contatos fictícios para testar as telas e tirar fotos para o manual.
// LEX_SNAPSHOT=<pasta> salva imagens das janelas e fecha o app.
import { app, BrowserWindow } from 'electron';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyDemo } from '../shared/demoData';
import type { TelegramService } from '../core/telegram';

export function enableDemo(tg: TelegramService) {
  applyDemo(tg, process.env.LEX_DEMO === 'login');
}

interface SnapHooks {
  openChat: (id: string) => BrowserWindow;
  emit: (e: 'typing', d: { chatId: string; name: string }) => void;
  list: () => BrowserWindow | null;
  toast: () => void;
  nudge: () => BrowserWindow | null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function snapshot(h: SnapHooks) {
  const dir = process.env.LEX_SNAPSHOT;
  if (!dir) return;
  if (process.env.LEX_DEMO === 'login') return loginSnapshot();
  void (async () => {
    await wait(2500);
    const list = h.list()!;
    list.webContents.send('presence:changed', { status: 'online', effective: 'online', autoAway: false, music: 'Garota de Ipanema — Tom Jobim' });
    list.webContents.send('prefs:changed', { sounds: true, notifications: true, onlineAlerts: true, status: 'online', personalMessage: 'Audiência às 14h ⚖️', shareMusic: true, autoAway: true });
    // Confere se o som pode tocar sem clique (política de autoplay liberada).
    const audio = await list.webContents.executeJavaScript('(async () => { const c = new AudioContext(); await new Promise(r => setTimeout(r, 300)); return c.state; })()');
    console.log('som:', audio);
    const chat = h.openChat('101');
    await wait(1500);
    h.emit('typing', { chatId: '101', name: 'Ana Paula' });
    await wait(1500);
    writeFileSync(join(dir, 'contatos.png'), (await list.webContents.capturePage()).toPNG());
    writeFileSync(join(dir, 'conversa.png'), (await chat.webContents.capturePage()).toPNG());
    list.webContents.send('profile:open', true);
    h.toast();
    await wait(2000);
    writeFileSync(join(dir, 'perfil.png'), (await list.webContents.capturePage()).toPNG());
    await list.webContents.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))");
    list.webContents.send('settings:open', true);
    await wait(1200);
    writeFileSync(join(dir, 'configuracoes.png'), (await list.webContents.capturePage()).toPNG());
    // Menu da mensagem (botão direito) na conversa.
    chat.show();
    chat.focus();
    await chat.webContents.executeJavaScript("document.getElementById('msg-8')?.scrollIntoView({ block: 'start' })");
    await wait(500);
    await chat.webContents.executeJavaScript(
      "(() => { const el = document.getElementById('msg-5'); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: r.left + 120, clientY: r.top + 10 })); })()",
    );
    await wait(800);
    chat.webContents.invalidate();
    await wait(300);
    writeFileSync(join(dir, 'menu-mensagem.png'), (await chat.webContents.capturePage()).toPNG());
    const toastWin = BrowserWindow.getAllWindows().find((w) => w !== list && w !== chat);
    if (toastWin) writeFileSync(join(dir, 'aviso.png'), (await toastWin.webContents.capturePage()).toPNG());
    const n = h.nudge();
    await wait(1500);
    if (n) writeFileSync(join(dir, 'chamar-atencao.png'), (await n.webContents.capturePage()).toPNG());
    app.exit(0);
  })();
}

export function loginSnapshot() {
  const dir = process.env.LEX_SNAPSHOT;
  if (!dir) return;
  setTimeout(async () => {
    const [w] = BrowserWindow.getAllWindows();
    writeFileSync(join(dir, 'entrada.png'), (await w.webContents.capturePage()).toPNG());
    // Tela de criar conta (número sem Telegram)
    await w.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(b => b.textContent.includes('criar conta'))?.click()");
    await new Promise((r) => setTimeout(r, 400));
    w.webContents.send('login:step', { step: 'signup' });
    await new Promise((r) => setTimeout(r, 800));
    writeFileSync(join(dir, 'criar-conta.png'), (await w.webContents.capturePage()).toPNG());
    app.exit(0);
  }, 3000);
}
