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
  },
});
