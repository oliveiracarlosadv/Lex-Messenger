// Funções nativas do Android (ver android/.../LexNativePlugin.java). No navegador, não fazem nada.
import { registerPlugin } from '@capacitor/core';

export interface LexNativePlugin {
  startKeepAlive(): Promise<void>;
  stopKeepAlive(): Promise<void>;
  batteryStatus(): Promise<{ unrestricted: boolean }>;
  requestBatteryExemption(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  musicAccess(): Promise<{ granted: boolean }>;
  requestMusicAccess(): Promise<void>;
  nowPlaying(): Promise<{ granted: boolean; title?: string; artist?: string }>;
  notify(o: { id: number; chatId: string; title: string; body: string; avatar?: string; silent?: boolean; nudge?: boolean; key?: string }): Promise<void>;
  cancel(o: { ids: number[] }): Promise<void>;
  takePendingOpen(): Promise<{ chatId?: string | null }>;
  pushSetup(): Promise<{ token?: string; secret?: string; error?: string }>;
  pushStatus(): Promise<{ lastAt: number; lastResult: string; count: number }>;
  updateWidget(o: { data: string }): Promise<void>;
  pushSilent(o: { silent: boolean }): Promise<void>;
  cacheAvatar(o: { chatId: string; avatar: string }): Promise<void>;
  clearAvatars(): Promise<void>;
  readContacts(): Promise<{ granted: boolean; contacts: { name: string; phone: string }[] }>;
  addListener(event: 'notificationOpen', cb: (d: { chatId: string }) => void): Promise<{ remove: () => void }>;
  addListener(event: 'screenCapture', cb: (d: { kind: 'screenshot' | 'recording' | 'recording-stop' }) => void): Promise<{ remove: () => void }>;
}

// Sem as funções nativas próprias (navegador e app do iPhone): não fazem nada.
const stub = {
  startKeepAlive: async () => {},
  stopKeepAlive: async () => {},
  batteryStatus: async () => ({ unrestricted: true }),
  requestBatteryExemption: async () => {},
  openNotificationSettings: async () => {},
  musicAccess: async () => ({ granted: false }),
  requestMusicAccess: async () => {},
  nowPlaying: async () => ({ granted: false }),
  notify: async () => {},
  cancel: async () => {},
  takePendingOpen: async () => ({ chatId: null }),
  pushSetup: async () => ({}),
  pushSilent: async () => {},
  pushStatus: async () => ({ lastAt: 0, lastResult: '', count: 0 }),
  updateWidget: async () => {},
  cacheAvatar: async () => {},
  clearAvatars: async () => {},
  readContacts: async () => ({ granted: false, contacts: [] }),
} as unknown as LexNativePlugin;

export const LexNative = registerPlugin<LexNativePlugin>('LexNative', { web: stub, ios: stub });
