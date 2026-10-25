// Guarda a sessão do Telegram (criptografada pelo Chaveiro do macOS) e as preferências.
import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Prefs } from '../shared/types';

const dir = () => {
  const d = app.getPath('userData');
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
};
const sessionFile = () => join(dir(), 'sessao.bin');
const prefsFile = () => join(dir(), 'preferencias.json');

export function loadSession(): string {
  try {
    if (!existsSync(sessionFile())) return '';
    const raw = readFileSync(sessionFile());
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8');
  } catch {
    return '';
  }
}

export function saveSession(value: string) {
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(value) : Buffer.from(value, 'utf8');
  writeFileSync(sessionFile(), data, { mode: 0o600 });
}

export function clearSession() {
  rmSync(sessionFile(), { force: true });
}

const defaults: Prefs = {
  sounds: true,
  notifications: true,
  onlineAlerts: true,
  status: 'online',
  personalMessage: '',
  shareMusic: false,
  autoAway: true,
};

export function loadPrefs(): Prefs {
  try {
    return { ...defaults, ...JSON.parse(readFileSync(prefsFile(), 'utf8')) };
  } catch {
    return { ...defaults };
  }
}

export function savePrefs(p: Prefs) {
  writeFileSync(prefsFile(), JSON.stringify(p, null, 2));
}
