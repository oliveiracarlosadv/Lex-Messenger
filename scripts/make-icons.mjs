// Gera os PNGs do ícone a partir dos SVGs em build/.
import { Resvg } from '@resvg/resvg-js';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const render = (svgFile, width, out) => {
  const png = new Resvg(readFileSync(svgFile, 'utf8'), { fitTo: { mode: 'width', value: width } }).render().asPng();
  writeFileSync(out, png);
  console.log('gerado', out);
};
render('build/icon.svg', 1024, 'build/icon.png');
render('build/icon.svg', 256, 'build/tray/tray-color.png');
render('build/tray.svg', 16, 'build/tray/trayTemplate.png');
render('build/tray.svg', 32, 'build/tray/trayTemplate@2x.png');
render('build/icon.svg', 32, 'build/tray/tray.png');
render('build/icon.svg', 64, 'build/tray/tray@2x.png');
copyFileSync('build/icon.svg', 'src/renderer/assets/logo.svg');
