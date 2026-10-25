// O que o motor do Telegram precisa do computador (Mac/Windows): sessão, arquivos e foto.
import { app, nativeImage, powerMonitor, shell } from 'electron';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { release } from 'node:os';
import { basename, extname, join } from 'node:path';
import type { PresencePlatform } from '../core/presence';
import type { FileInput, Platform } from '../core/telegram';
import { nowPlaying } from './music';
import { clearSession, loadSession, saveSession } from './store';

const isMac = process.platform === 'darwin';

export const desktopPlatform: Platform = {
  deviceModel: isMac ? 'Lex Messenger (Mac)' : 'Lex Messenger (Windows)',
  systemVersion: `${isMac ? 'macOS' : 'Windows'} ${release()}`,
  loadSession: async () => loadSession(),
  saveSession: async (v) => saveSession(v),
  clearSession: async () => clearSession(),
  async saveDownload(name, data) {
    const dir = join(app.getPath('downloads'), 'Lex Messenger');
    mkdirSync(dir, { recursive: true });
    let file = join(dir, name);
    for (let n = 2; existsSync(file); n++) {
      const ext = extname(name);
      file = join(dir, `${basename(name, ext)} (${n})${ext}`);
    }
    writeFileSync(file, data);
    return file;
  },
  hasDownload: async (ref) => existsSync(ref),
  openFile: async (ref) => {
    await shell.openPath(ref);
  },
  revealFile: async (ref) => shell.showItemInFolder(ref),
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
