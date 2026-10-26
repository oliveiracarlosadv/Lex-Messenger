// O que o motor do Telegram precisa do celular (Android): sessão, arquivos e foto.
import { Buffer } from 'buffer';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import type { FileInput, Platform } from '../core/telegram';

/** App instalado (Android) ou página aberta no navegador (iPhone pelo Safari). */
export const isNative = Capacitor.isNativePlatform();
/** App instalado no Android / no iPhone (o do iPhone não tem os recursos nativos próprios do Lex). */
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isIOSApp = Capacitor.getPlatform() === 'ios';
export const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** No navegador: entrega o arquivo ao sistema (no iPhone, abre a tela de Compartilhar/visualizar). */
function webHandOff(name: string, data: Buffer, download: boolean) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(data)]));
  const a = document.createElement('a');
  a.href = url;
  if (download) a.download = name;
  else a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const SESSION_KEY = 'lex-session';
const TEMP = 'temporarios';

async function writeTemp(name: string, data: Buffer) {
  const r = await Filesystem.writeFile({
    path: `${TEMP}/${Date.now()}-${name}`,
    data: Buffer.from(data).toString('base64'),
    directory: Directory.Cache,
    recursive: true,
  });
  return r.uri;
}

async function shareFile(uri: string, title: string) {
  await Share.share({ files: [uri], dialogTitle: title });
}

export const mobilePlatform: Platform = {
  deviceModel: isAndroid ? 'Lex Messenger (Android)' : isIOS ? 'Lex Messenger (iPhone)' : 'Lex Messenger (Web)',
  systemVersion:
    navigator.userAgent.match(/Android [\d.]+/)?.[0] ??
    (navigator.userAgent.match(/OS (\d+)_(\d+)/) ? `iOS ${RegExp.$1}.${RegExp.$2}` : 'Navegador'),
  useWSS: true,
  // A sessão fica na área privada do app (outros apps não leem).
  loadSession: async () => (await Preferences.get({ key: SESSION_KEY })).value ?? '',
  saveSession: async (value) => Preferences.set({ key: SESSION_KEY, value }),
  clearSession: async () => Preferences.remove({ key: SESSION_KEY }),
  // Abrir: cópia temporária no cache do app, entregue ao app que o usuário escolher; apagada ao reabrir o Lex.
  async openTemp(name, data) {
    if (!isNative) return webHandOff(name, data, false);
    await shareFile(await writeTemp(name, data), 'Abrir com…');
  },
  // Salvar…: o menu do Android deixa o usuário escolher (Arquivos, Drive, galeria…).
  async saveAs(name, data) {
    if (!isNative) {
      webHandOff(name, data, true);
      return true;
    }
    await shareFile(await writeTemp(name, data), 'Salvar ou compartilhar');
    return true;
  },
  loadData: async (key) => (await Preferences.get({ key: `lex-${key}` })).value,
  saveData: async (key, value) => Preferences.set({ key: `lex-${key}`, value }),
  clearTemp: async () => {
    if (!isNative) return;
    await Filesystem.rmdir({ path: TEMP, directory: Directory.Cache, recursive: true }).catch(() => {});
  },
  async squareJpeg(input: FileInput) {
    if (typeof input === 'string') throw new Error('Escolha uma imagem.');
    const bmp = await createImageBitmap(new Blob([input.data as BlobPart]));
    const side = Math.min(bmp.width, bmp.height);
    const size = Math.min(side, 640);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
    if (!blob) throw new Error('Não consegui abrir essa imagem.');
    return Buffer.from(await blob.arrayBuffer());
  },
};

/** Abre o seletor de arquivos do Android e devolve os arquivos escolhidos já lidos. */
export function pickFiles(accept = '', multiple = true): Promise<{ name: string; data: Uint8Array }[]> {
  return new Promise((resolve) => {
    // O seletor precisa estar dentro da página: o app do iPhone (WKWebView) não abre um seletor "solto".
    const input = document.createElement('input');
    input.type = 'file';
    // Sem filtro, o iPhone oferece Fotos, Câmera e Arquivos; '*/*' faz ele não mostrar nada.
    if (accept && accept !== '*/*') input.accept = accept;
    input.multiple = multiple;
    input.style.cssText = 'position:fixed;left:-1000px;top:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(input);
    let done = false;
    const finish = (files: { name: string; data: Uint8Array }[]) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(files);
    };
    input.onchange = async () => {
      const files = [...(input.files ?? [])];
      finish(await Promise.all(files.map(async (f, i) => ({ name: f.name || `foto-${i + 1}.jpg`, data: new Uint8Array(await f.arrayBuffer()) }))));
    };
    input.oncancel = () => finish([]);
    input.click();
  });
}
