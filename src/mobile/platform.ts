// O que o motor do Telegram precisa do celular (Android): sessão, arquivos e foto.
import { Buffer } from 'buffer';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import type { FileInput, Platform } from '../core/telegram';

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
  deviceModel: 'Lex Messenger (Android)',
  systemVersion: navigator.userAgent.match(/Android [\d.]+/)?.[0] ?? 'Android',
  useWSS: true,
  // A sessão fica na área privada do app (outros apps não leem).
  loadSession: async () => (await Preferences.get({ key: SESSION_KEY })).value ?? '',
  saveSession: async (value) => Preferences.set({ key: SESSION_KEY, value }),
  clearSession: async () => Preferences.remove({ key: SESSION_KEY }),
  // Abrir: cópia temporária no cache do app, entregue ao app que o usuário escolher; apagada ao reabrir o Lex.
  async openTemp(name, data) {
    await shareFile(await writeTemp(name, data), 'Abrir com…');
  },
  // Salvar…: o menu do Android deixa o usuário escolher (Arquivos, Drive, galeria…).
  async saveAs(name, data) {
    await shareFile(await writeTemp(name, data), 'Salvar ou compartilhar');
    return true;
  },
  clearTemp: async () => {
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
export function pickFiles(accept = '*/*', multiple = true): Promise<{ name: string; data: Uint8Array }[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = async () => {
      const files = [...(input.files ?? [])];
      resolve(await Promise.all(files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) }))));
    };
    input.oncancel = () => resolve([]);
    input.click();
  });
}
