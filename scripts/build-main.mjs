// Compila o processo principal e o preload do Electron.
// Lê as chaves do Telegram do arquivo .env e as embute no app.
import { build, context } from 'esbuild';
import { appVersion, telegramKeys } from './env.mjs';

const { apiId, apiHash } = telegramKeys();

const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['electron', 'telegram'],
  define: {
    __API_ID__: JSON.stringify(apiId),
    __API_HASH__: JSON.stringify(apiHash),
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  logLevel: 'info',
};
const entries = [
  { ...common, entryPoints: ['src/main/index.ts'], outfile: 'dist-electron/main.js' },
  { ...common, entryPoints: ['src/preload/index.ts'], outfile: 'dist-electron/preload.js' },
];
if (process.argv.includes('--watch')) {
  for (const e of entries) await (await context(e)).watch();
} else {
  await Promise.all(entries.map((e) => build(e)));
}
