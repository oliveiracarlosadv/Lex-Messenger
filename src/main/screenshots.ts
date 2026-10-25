// Percebe prints e gravações de tela no computador (pela pasta onde o sistema os salva),
// para avisar a outra pessoa da conversa que estava aberta na frente.
import { app } from 'electron';
import { execFileSync } from 'node:child_process';
import { existsSync, statSync, watch, type FSWatcher } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type CaptureKind = 'screenshot' | 'recording';

function folders(): string[] {
  if (process.platform === 'darwin') {
    let dir = '';
    try {
      dir = execFileSync('defaults', ['read', 'com.apple.screencapture', 'location'], { encoding: 'utf8' }).trim().replace(/^~/, homedir());
    } catch {
      /* padrão: Mesa */
    }
    return [dir || join(homedir(), 'Desktop')];
  }
  if (process.platform === 'win32') {
    return [join(app.getPath('pictures'), 'Screenshots'), join(app.getPath('videos'), 'Captures'), join(app.getPath('pictures'), 'Capturas de tela')];
  }
  return [join(app.getPath('pictures'), 'Screenshots')];
}

const SHOT = /^(captura de tela|screenshot|screen shot|imagem da tela)/i;
const REC = /^(grava[cç][aã]o de tela|screen recording)|\.(mov|mp4)$/i;

export function watchCaptures(onCapture: (kind: CaptureKind) => void): () => void {
  const watchers: FSWatcher[] = [];
  const seen = new Set<string>();
  for (const dir of folders()) {
    if (!existsSync(dir)) continue;
    try {
      watchers.push(
        watch(dir, (_ev, file) => {
          if (!file || seen.has(file) || file.startsWith('.')) return;
          const isShot = SHOT.test(file) && /\.(png|jpe?g|heic)$/i.test(file);
          const isRec = REC.test(file) && /\.(mov|mp4)$/i.test(file) && /grava|recording|captur/i.test(file);
          if (!isShot && !isRec) return;
          try {
            const st = statSync(join(dir, file));
            if (Date.now() - st.birthtimeMs > 20_000) return; // arquivo antigo, não é um print novo
          } catch {
            return;
          }
          seen.add(file);
          onCapture(isRec ? 'recording' : 'screenshot');
        }),
      );
    } catch {
      /* pasta sem permissão */
    }
  }
  return () => watchers.forEach((w) => w.close());
}
