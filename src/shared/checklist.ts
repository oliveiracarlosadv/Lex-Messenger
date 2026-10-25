// Lista de tarefas dentro da conversa, em texto simples (funciona com qualquer app do Telegram):
//   📋 Lista: Documentos do processo
//   ☐ Procuração
//   ☑ RG e CPF
// Quem recebe marca respondendo à lista com "✅ Feito: Procuração" (ou "↩️ Desfeito: …");
// o Lex de quem criou a lista atualiza as marcas ☐/☑ editando a mensagem.

export interface ChecklistItem {
  text: string;
  done: boolean;
}
export interface Checklist {
  title: string;
  items: ChecklistItem[];
}

const HEAD = '📋 Lista: ';
const DONE = '☑ ';
const TODO = '☐ ';
const DONE_REPLY = '✅ Feito: ';
const UNDO_REPLY = '↩️ Desfeito: ';

export function formatChecklist(c: Checklist): string {
  return [HEAD + c.title.trim(), ...c.items.filter((i) => i.text.trim()).map((i) => (i.done ? DONE : TODO) + i.text.trim())].join('\n');
}

export function parseChecklist(text: string): Checklist | null {
  if (!text.startsWith(HEAD)) return null;
  const [first, ...rest] = text.split('\n');
  const items = rest
    .filter((l) => l.startsWith(DONE) || l.startsWith(TODO))
    .map((l) => ({ done: l.startsWith(DONE), text: l.slice(DONE.length).trim() }));
  return items.length ? { title: first.slice(HEAD.length).trim(), items } : null;
}

/** Mensagem de marcação ("✅ Feito: item" / "↩️ Desfeito: item"). */
export function parseToggle(text: string): { item: string; done: boolean } | null {
  if (text.startsWith(DONE_REPLY)) return { item: text.slice(DONE_REPLY.length).trim(), done: true };
  if (text.startsWith(UNDO_REPLY)) return { item: text.slice(UNDO_REPLY.length).trim(), done: false };
  return null;
}

export const toggleText = (item: string, done: boolean) => (done ? DONE_REPLY : UNDO_REPLY) + item;

/** Aplica uma marcação à lista (pelo texto do item). */
export function applyToggle(c: Checklist, item: string, done: boolean): Checklist {
  return { ...c, items: c.items.map((i) => (i.text === item ? { ...i, done } : i)) };
}
