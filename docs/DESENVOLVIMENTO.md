# Desenvolvimento

## Requisitos
Node.js 22 ou mais novo. Para gerar o instalador do Mac, um Mac; o do Windows sai pelo GitHub Actions.

## Chaves do Telegram (uma vez só)
Todo aplicativo que usa contas de usuário do Telegram precisa de um “API ID” e “API hash”. São gratuitos, ficam
embutidos no app, e quem usa o app **não** precisa deles.

1. Entre em <https://my.telegram.org> com o seu número e abra **API development tools**.
2. Crie o aplicativo: *App title* `Lex Messenger`, *Short name* `lexmessenger`, *Platform* `Desktop`.
3. Guarde o **App api_id** e o **App api_hash**. Não publique o hash em lugar nenhum.
4. Para compilar no seu computador: copie `.env.example` para `.env` e preencha.
5. Para o GitHub gerar os instaladores: no repositório, **Settings > Secrets and variables > Actions > New repository
   secret**, crie `TELEGRAM_API_ID` e `TELEGRAM_API_HASH`.

O `.env` está no `.gitignore`: nunca vai para o GitHub.

## Comandos
| Comando | O que faz |
| --- | --- |
| `npm install` | Instala as dependências. |
| `npm run build` | Confere os tipos e compila tudo. |
| `npm start` | Compila e abre o app. |
| `npm run dev` | Modo de desenvolvimento, com recarga automática. |
| `npm run dist` | Gera os `.dmg` do Mac em `release/`. |
| `npm run icons` | Gera os PNGs do ícone a partir de `build/icon.svg` e `build/tray.svg`. |
| `LEX_DEMO=1 npx electron .` | Abre com contatos fictícios (sem Telegram). Com `LEX_SNAPSHOT=<pasta>`, salva imagens das telas. |

## Publicar uma versão
1. Atualize `version` no `package.json` e o `CHANGELOG.md` (título `## vX.Y.Z`).
2. Para testar os instaladores sem publicar: **Actions > Release > Run workflow** (os arquivos ficam em *Artifacts*).
3. Para publicar: `git tag -a vX.Y.Z -m "Lex Messenger vX.Y.Z" && git push origin vX.Y.Z`. O GitHub gera os
   instaladores do Mac (Apple e Intel) e do Windows e cria a Release. Os links do README apontam sempre para a última.

## Estrutura
- `src/main/telegram.ts` — conexão com o Telegram (GramJS): login, contatos, mensagens, arquivos, status.
- `src/main/index.ts` — janelas, barra de menus, Dock, notificações e “tremer a janela”.
- `src/preload` — a ponte segura `window.lex` entre as janelas e o processo principal.
- `src/renderer` — telas em React: entrada, lista de contatos e conversa; sons em `lib/sounds.ts`.
- `src/shared/types.ts` — tipos compartilhados e o texto do “chamar atenção” (`NUDGE_TEXT`).

## Segurança
Janelas com `contextIsolation` e `sandbox`, sem acesso direto ao Node; política de conteúdo (CSP) no app final; links
abrem só no navegador externo. A sessão do Telegram fica criptografada com `safeStorage`.
