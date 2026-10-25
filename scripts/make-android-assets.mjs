// Gera os ícones do Android (app, notificação) e a tela de abertura a partir de build/icon.svg.
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RES = 'android/app/src/main/res';
const icon = readFileSync('build/icon.svg', 'utf8');
const defs = icon.match(/<defs>[\s\S]*?<\/defs>/)[0];
const bubbles = icon.slice(icon.indexOf('<!-- balão azul, atrás'), icon.lastIndexOf('</svg>'));
const bg = '<linearGradient id="abg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a63d8"/><stop offset="0.5" stop-color="#1c3a9e"/><stop offset="1" stop-color="#0c1a52"/></linearGradient>';

const svg = (w, h, body, extraDefs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${defs.replace('</defs>', extraDefs + '</defs>')}${body}</svg>`;
const png = (src, width, out) => {
  mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
  writeFileSync(out, new Resvg(src, { fitTo: { mode: 'width', value: width } }).render().asPng());
};
const pngSize = (file) => {
  const b = readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

// Ícone adaptativo: frente (balões, dentro da área segura) e fundo (degradê azul).
const fg = svg(1024, 1024, `<g transform="translate(512 512) scale(0.82) translate(-512 -555)">${bubbles}</g>`);
const back = svg(1024, 1024, '<rect width="1024" height="1024" fill="url(#abg)"/>', bg);
// Ícone antigo (Android 7 e anteriores): o ícone completo.
const legacy = icon.replace('viewBox="0 0 1024 1024"', 'viewBox="90 90 844 860"');
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  png(fg, 108 * k, `${RES}/mipmap-${d}/ic_launcher_foreground.png`);
  png(back, 108 * k, `${RES}/mipmap-${d}/ic_launcher_background.png`);
  png(legacy, 48 * k, `${RES}/mipmap-${d}/ic_launcher.png`);
  png(legacy, 48 * k, `${RES}/mipmap-${d}/ic_launcher_round.png`);
  // Ícone pequeno da notificação: silhueta branca dos balões.
  const tray = readFileSync('build/tray.svg', 'utf8').replaceAll('#000', '#fff');
  png(tray, 24 * k, `${RES}/drawable-${d}/ic_stat_lex.png`);
}
for (const f of ['mipmap-anydpi-v26/ic_launcher.xml', 'mipmap-anydpi-v26/ic_launcher_round.xml']) {
  const p = join(RES, f);
  writeFileSync(p, readFileSync(p, 'utf8').replace('@color/ic_launcher_background', '@mipmap/ic_launcher_background'));
}

// Tela de abertura: fundo azul-claro com o ícone no centro.
for (const dir of readdirSync(RES).filter((d) => d.startsWith('drawable'))) {
  const file = join(RES, dir, 'splash.png');
  let size;
  try {
    size = pngSize(file);
  } catch {
    continue;
  }
  const [w, h] = size;
  const s = Math.min(w, h) * 0.32;
  const splash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs><linearGradient id="sp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f9ff"/><stop offset="1" stop-color="#b9d3f0"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#sp)"/>
    <svg x="${(w - s) / 2}" y="${(h - s) / 2}" width="${s}" height="${s}" viewBox="0 0 1024 1024">${icon.slice(icon.indexOf('>') + 1, icon.lastIndexOf('</svg>'))}</svg>
  </svg>`;
  writeFileSync(file, new Resvg(splash).render().asPng());
}
console.log('ícones do Android gerados');
