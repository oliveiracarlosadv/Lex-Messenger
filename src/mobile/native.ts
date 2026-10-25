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
  notify(o: { id: number; chatId: string; title: string; body: string; avatar?: string; silent?: boolean; nudge?: boolean }): Promise<void>;
  cancel(o: { ids: number[] }): Promise<void>;
  takePendingOpen(): Promise<{ chatId?: string | null }>;
  pushSetup(): Promise<{ token?: string; secret?: string }>;
  pushSilent(o: { silent: boolean }): Promise<void>;
  cacheAvatar(o: { chatId: string; avatar: string }): Promise<void>;
  clearAvatars(): Promise<void>;
  addListener(event: 'notificationOpen', cb: (d: { chatId: string }) => void): Promise<{ remove: () => void }>;
  addListener(event: 'screenCapture', cb: (d: { kind: 'screenshot' | 'recording' | 'recording-stop' }) => void): Promise<{ remove: () => void }>;
}

export const LexNative = registerPlugin<LexNativePlugin>('LexNative', {
  web: {
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
    cacheAvatar: async () => {},
    clearAvatars: async () => {},
  } as unknown as LexNativePlugin,
});
