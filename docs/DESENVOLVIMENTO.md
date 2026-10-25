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
| `npm run build:mobile` | Monta o app de celular em `dist-mobile/`. |
| `npm run android` | Monta e copia para o projeto Android (`android/`). Abrir no Android Studio para rodar no emulador. |
| `npm run dev:mobile` e abrir `http://localhost:5174/?demo` | App de celular no navegador, com contatos fictícios. |
| `npx electron scripts/snap-mobile.cjs` | Fotos das telas do celular para o manual (depois de `build:mobile`). |
| `node scripts/make-android-assets.mjs` | Gera ícones e tela de abertura do Android a partir de `build/icon.svg`. |
| `LEX_DEMO=1 npx electron .` | Abre com contatos fictícios (sem Telegram). Com `LEX_SNAPSHOT=<pasta>`, salva imagens das telas. |

## Publicar uma versão
1. Atualize `version` no `package.json` e o `CHANGELOG.md` (título `## vX.Y.Z`).
2. Para testar os instaladores sem publicar: **Actions > Release > Run workflow** (os arquivos ficam em *Artifacts*).
3. Para publicar: `git tag -a vX.Y.Z -m "Lex Messenger vX.Y.Z" && git push origin vX.Y.Z`. O GitHub gera os
   instaladores do Mac (Apple e Intel) e do Windows e cria a Release. Os links do README apontam sempre para a última.

## Estrutura
- `src/core/telegram.ts` — o motor do Telegram (GramJS), igual no computador e no celular. O que muda entre eles vem
  da `Platform` (sessão, salvar/abrir arquivos, cortar a foto): `src/main/platform.ts` e `src/mobile/platform.ts`.
- `src/core/presence.ts` — status, Ausente automático, música e montagem da bio.
- `src/main/index.ts` — computador: janelas, barra de menus, Dock, avisos no canto e “tremer a janela”.
- `src/mobile/` — celular: a ponte `window.lex` (`bridge.ts`), a navegação lista ↔ conversa (`App.tsx`) e os ajustes de tela.
- `android/` — projeto Android gerado pelo Capacitor (ícones, `MainActivity` e assinatura de teste).
- `src/preload` — a ponte segura `window.lex` entre as janelas e o processo principal.
- `src/renderer` — telas em React: entrada, lista de contatos e conversa; sons em `lib/sounds.ts`.
- `src/shared/types.ts` — tipos compartilhados e o texto do “chamar atenção” (`NUDGE_TEXT`).

## Notificações push no Android

Sem push, o Android (principalmente Samsung e Xiaomi) “adormece” o Lex depois de um tempo e as notificações atrasam.
Com push, elas chegam na hora, com o app fechado, e o aviso fixo “Conectado ao Telegram” some. São três passos, uma
vez só:

1. **Criar o projeto no Firebase** (grátis): <https://console.firebase.google.com> > **Adicionar projeto** (nome:
   `Lex Messenger`; o Google Analytics pode ficar desligado). Dentro dele: **Adicionar app** > **Android** > nome do
   pacote **`br.com.lextecnologias.messenger`** > **Registrar app** > baixe o **`google-services.json`**.
2. **Dar ao Telegram a chave do Firebase**: no Firebase, ⚙️ **Configurações do projeto** > **Contas de serviço** >
   **Gerar nova chave privada** (baixa um arquivo `.json`). Em <https://my.telegram.org> > **API development tools** >
   **Push credentials** > **FCM — FCM service account** > **Update** e envie esse arquivo.
3. **Cadastrar o `google-services.json` no GitHub**: no repositório, **Settings > Secrets and variables > Actions >
   New repository secret**, nome **`GOOGLE_SERVICES_JSON`**, e cole todo o conteúdo do arquivo.

Pronto: a próxima geração do `.apk` já sai com push. Em **Configurações > Avisos**, o Lex mostra
“✅ Notificações instantâneas (push) ligadas”. O conteúdo das notificações vem do Telegram **criptografado com uma
chave criada no próprio celular**; só ele consegue ler.

## Android: assinatura
O `.apk` do GitHub é assinado com uma chave **de teste** (`android/app/lex-teste.keystore`, senha pública no
`build.gradle`), só para que cada versão instale por cima da anterior. Para publicar na Play Store, crie uma chave
própria e secreta e configure-a como segredo do GitHub.

## Segurança
Janelas com `contextIsolation` e `sandbox`, sem acesso direto ao Node; política de conteúdo (CSP) no app final; links
abrem só no navegador externo. A sessão do Telegram fica criptografada com `safeStorage`.
