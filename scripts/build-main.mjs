// Compila o processo principal e o preload do Electron.
// Lê as chaves do Telegram do arquivo .env e as embute no app.
import { build, context } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';

const env = {};
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const apiId = process.env.TELEGRAM_API_ID || env.TELEGRAM_API_ID || '';
const apiHash = process.env.TELEGRAM_API_HASH || env.TELEGRAM_API_HASH || '';
if (!apiId || !apiHash) console.warn('Aviso: TELEGRAM_API_ID/TELEGRAM_API_HASH ausentes no .env — o login não vai funcionar.');

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
    __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync('package.json', 'utf8')).version),
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
