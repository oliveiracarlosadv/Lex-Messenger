// Lê as chaves do Telegram do .env (ou das variáveis de ambiente, no GitHub) — usado pelo computador e pelo celular.
import { existsSync, readFileSync } from 'node:fs';

export function telegramKeys() {
  const env = {};
  if (existsSync('.env')) {
    for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  const apiId = process.env.TELEGRAM_API_ID || env.TELEGRAM_API_ID || '';
  const apiHash = process.env.TELEGRAM_API_HASH || env.TELEGRAM_API_HASH || '';
  if (!apiId || !apiHash) {
    // Instalador para distribuir nunca pode sair sem as chaves: o usuário veria "Falta configurar o aplicativo".
    if (process.env.LEX_REQUIRE_KEYS) {
      console.error('Erro: faltam TELEGRAM_API_ID/TELEGRAM_API_HASH (.env ou segredos do GitHub). Instalador não gerado.');
      process.exit(1);
    }
    console.warn('Aviso: TELEGRAM_API_ID/TELEGRAM_API_HASH ausentes no .env — o login não vai funcionar (só modo demonstração).');
  }
  return { apiId, apiHash };
}

export const appVersion = () => JSON.parse(readFileSync('package.json', 'utf8')).version;
