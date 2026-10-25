export function formatSize(bytes?: number): string {
  if (!bytes) return '';
  const units = ['bytes', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: i ? 1 : 0 })} ${units[i]}`;
}

export function formatTime(sec: number): string {
  return new Date(sec * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDay(sec: number): string {
  const d = new Date(sec * 1000);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yest.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** Separa o texto em pedaços comuns e links clicáveis. */
export function splitLinks(text: string): { text: string; url?: string }[] {
  const out: { text: string; url?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], url: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
