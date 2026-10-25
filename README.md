<p align="center"><img src="docs/imagens/icone.png" width="128" alt="Ícone do Lex Messenger"></p>

<h1 align="center">Lex Messenger</h1>

<p align="center">O jeitinho dos mensageiros dos anos 2000, com a sua conta do Telegram.<br>
Lista de contatos, uma janela para cada conversa, “chamar atenção”, sons e envio de arquivos.</p>

<p align="center">
  <a href="https://github.com/oliveiracarlosadv/Lex-Messenger/releases/latest/download/LexMessenger-macOS-arm64.dmg"><b>⬇️ Mac (Apple M1, M2, M3, M4)</b></a> ·
  <a href="https://github.com/oliveiracarlosadv/Lex-Messenger/releases/latest/download/LexMessenger-macOS-x64.dmg"><b>⬇️ Mac (Intel)</b></a> ·
  <a href="https://github.com/oliveiracarlosadv/Lex-Messenger/releases/latest/download/LexMessenger-Windows-Instalador.exe"><b>⬇️ Windows</b></a>
</p>

<p align="center"><a href="https://github.com/oliveiracarlosadv/Lex-Messenger/releases">Todas as versões</a> · <a href="docs/MANUAL.md">Manual</a> · <a href="docs/PRIVACIDADE.md">Privacidade</a> · <a href="docs/TERMOS.md">Termos</a></p>

---

<p align="center">
  <img src="docs/imagens/entrada.png" width="230" alt="Tela de entrada">
  <img src="docs/imagens/contatos.png" width="230" alt="Lista de contatos">
</p>
<p align="center"><img src="docs/imagens/conversa.png" width="560" alt="Janela de conversa"></p>

<sub>As imagens usam contatos fictícios.</sub>

## O que ele faz

- **Entra com a sua conta do Telegram**, pelo QR Code (aponte a câmera do celular) ou pelo número de telefone.
- **Lista de contatos** separada em Online, Offline, Grupos e Canais, com quem está ausente e mensagens não lidas.
- **Uma janela para cada conversa**, com “Fulano diz:”, fotos de perfil e o aviso “está digitando…”.
- **Chamar atenção**: faz a janela do outro tremer (quando ele também usa o Lex Messenger; no Telegram comum, chega como mensagem 📳).
- **Sons** de mensagem, de contato entrando e de chamar atenção.
- **Arquivos e fotos**: botão, arrastar e soltar, ou colar uma imagem. Com confirmação antes de enviar.
- **Emoticons**: `:)` vira 😊, `:D` vira 😃 e há um seletor com dezenas de opções.
- **Fica na barra de menus** (Mac) ou na bandeja (Windows), com o número de mensagens não lidas no ícone do Dock.
- **Status** Disponível ou Aparecer offline, e **mensagem pessoal** (é a sua bio do Telegram).

## Como instalar

**Mac:** baixe o arquivo do seu tipo de Mac (em  > Sobre este Mac: “Apple M…” ou “Intel”), abra e arraste o
Lex Messenger para a pasta Aplicativos. Na primeira vez, o macOS avisa que não pode verificar o desenvolvedor: abra
**Ajustes do Sistema > Privacidade e Segurança**, role até o fim e clique em **Abrir Mesmo Assim**.

**Windows:** baixe e execute o instalador. Se aparecer “O Windows protegeu o computador”, clique em
**Mais informações > Executar assim mesmo**.

Esses avisos aparecem porque o app ainda não tem certificado pago da Apple/Microsoft. O código é aberto e está todo aqui.

Passo a passo completo, com o primeiro acesso: [Manual](docs/MANUAL.md).

## Privacidade, em resumo

O Lex Messenger conversa **direto** com o Telegram. Não há servidor nosso no meio, nem coleta de dados. A sessão fica
guardada criptografada no seu computador (no Mac, pelo Chaveiro). Detalhes em [Privacidade](docs/PRIVACIDADE.md).

## Para desenvolvedores

Electron + React + TypeScript + Vite + Tailwind, com [GramJS](https://github.com/gram-js/gramjs) (MTProto).
Como compilar e publicar: [docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md).

---

<sub>O Lex Messenger é um aplicativo independente da Lex Tecnologias. Não é afiliado ao Telegram nem à Microsoft.
“Telegram” e “MSN” são marcas de seus respectivos donos; o visual é apenas uma homenagem, com desenhos e sons próprios.</sub>
