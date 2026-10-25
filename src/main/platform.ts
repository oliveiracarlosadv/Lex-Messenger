// O que o motor do Telegram precisa do computador (Mac/Windows): sessão, arquivos e foto.
import { app, BrowserWindow, dialog, nativeImage, powerMonitor, shell } from 'electron';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { release } from 'node:os';
import { join } from 'node:path';
import type { PresencePlatform } from '../core/presence';
import type { FileInput, Platform } from '../core/telegram';
import { nowPlaying } from './music';
import { clearSession, loadSession, saveSession } from './store';

const isMac = process.platform === 'darwin';
const tempDir = () => join(app.getPath('temp'), 'lex-messenger-abertos');

export const desktopPlatform: Platform = {
  deviceModel: isMac ? 'Lex Messenger (Mac)' : 'Lex Messenger (Windows)',
  systemVersion: `${isMac ? 'macOS' : 'Windows'} ${release()}`,
  loadSession: async () => loadSession(),
  saveSession: async (v) => saveSession(v),
  clearSession: async () => clearSession(),
  // Abrir: cópia temporária numa pasta própria, apagada quando o app fecha.
  async openTemp(name, data) {
    const dir = join(tempDir(), randomUUID());
    mkdirSync(dir, { recursive: true });
    const file = join(dir, name);
    writeFileSync(file, data, { mode: 0o600 });
    await shell.openPath(file);
  },
  // Salvar…: o usuário escolhe a pasta (o padrão sugerido é Downloads).
  async saveAs(name, data) {
    const win = BrowserWindow.getFocusedWindow();
    const opts = { title: 'Salvar arquivo', buttonLabel: 'Salvar', defaultPath: join(app.getPath('downloads'), name) };
    const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (r.canceled || !r.filePath) return false;
    writeFileSync(r.filePath, data);
    shell.showItemInFolder(r.filePath);
    return true;
  },
  clearTemp: async () => rmSync(tempDir(), { recursive: true, force: true }),
  async squareJpeg(input: FileInput) {
    const img = typeof input === 'string' ? nativeImage.createFromPath(input) : nativeImage.createFromBuffer(Buffer.from(input.data));
    if (img.isEmpty()) throw new Error('Não consegui abrir essa imagem. Use JPG ou PNG.');
    const { width, height } = img.getSize();
    const side = Math.min(width, height);
    const square = img.crop({ x: Math.floor((width - side) / 2), y: Math.floor((height - side) / 2), width: side, height: side });
    return square.resize({ width: Math.min(side, 640), height: Math.min(side, 640), quality: 'best' }).toJPEG(90);
  },
};

export const desktopPresence: PresencePlatform = {
  nowPlaying,
  idleSeconds: () => powerMonitor.getSystemIdleTime(),
  onLock: (cb) => {
    powerMonitor.on('lock-screen', () => cb(true));
    powerMonitor.on('unlock-screen', () => cb(false));
  },
  musicPermissionHint: isMac
    ? 'Permita o Lex Messenger em Ajustes do Sistema > Privacidade e Segurança > Automação.'
    : 'Não foi possível ler a música que está tocando.',
};
