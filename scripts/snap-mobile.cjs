// Tira fotos das telas do app de celular (modo demonstração) para o manual.
// Uso: npx vite build -c vite.mobile.config.ts && npx electron scripts/snap-mobile.cjs
const { app, BrowserWindow } = require('electron');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.setPath('userData', join(app.getPath('temp'), 'lex-mobile-snap'));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 390, height: 844, show: false, webPreferences: { offscreen: false } });
  const page = join(__dirname, '../dist-mobile/index.html');
  const shot = async (name) => writeFileSync(join(__dirname, '../docs/imagens', name), (await win.webContents.capturePage()).toPNG());
  await win.loadFile(page, { search: 'demo=login' });
  await wait(1500);
  await shot('android-entrada.png');
  await win.loadFile(page, { search: 'demo' });
  await wait(1500);
  await shot('android-contatos.png');
  await win.webContents.executeJavaScript("location.hash = '#/chat/101'");
  await wait(1500);
  await shot('android-conversa.png');
  app.exit(0);
});
