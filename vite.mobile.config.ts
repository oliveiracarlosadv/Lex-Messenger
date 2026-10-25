// Monta o app do celular (Android): as mesmas telas + o motor do Telegram rodando dentro do app.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
// @ts-expect-error script em JavaScript puro
import { appVersion, telegramKeys } from './scripts/env.mjs';

const { apiId, apiHash } = telegramKeys();

export default defineConfig({
  root: 'src/mobile',
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // O GramJS foi feito para Node: estas peças imitam o Node dentro do app.
    nodePolyfills({ include: ['buffer', 'process', 'util', 'os', 'path', 'events', 'stream', 'crypto', 'net', 'constants', 'assert'], globals: { Buffer: true, process: true, global: true } }),
  ],
  define: {
    __API_ID__: JSON.stringify(apiId),
    __API_HASH__: JSON.stringify(apiHash),
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  build: { outDir: '../../dist-mobile', emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 4000 },
  server: { port: 5174, strictPort: true },
});
