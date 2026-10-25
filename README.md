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
<p align="center">
  <img src="docs/imagens/perfil.png" width="230" alt="Meu perfil">
  <img src="docs/imagens/aviso.png" width="300" alt="Aviso de nova mensagem no canto da tela">
</p>

<sub>As imagens usam contatos fictícios.</sub>

## O que ele faz

- **Entra com a sua conta do Telegram**, pelo QR Code (aponte a câmera do celular) ou pelo número de telefone.
- **Lista de contatos** separada em Online, Offline, Grupos e Canais, com quem está ausente e mensagens não lidas.
- **Uma janela para cada conversa**: cada mensagem com o nome de quem enviou e a hora em cima, fotos de perfil e o aviso “está digitando…”.
- **Aviso no canto da tela**, como no MSN: sobe uma janelinha com a foto, “Fulano diz:” e o começo da mensagem; clique para abrir a conversa. Também avisa quando um contato entra.
- **Status do MSN**: Disponível, Ocupado, Ausente, Volto já, Em horário de almoço, Ao telefone e Aparecer offline, e “Ausente” automático com o computador parado.
- **Música que estou ouvindo** 🎵: mostra a música do Apple Music ou do Spotify (no Windows, do player que estiver tocando) na sua mensagem pessoal.
- **Meu perfil**: troque nome, sobrenome e foto direto pelo Lex Messenger.
- **Chamar atenção**: faz a janela do outro tremer (quando ele também usa o Lex Messenger; no Telegram comum, chega como mensagem 📳).
- **Sons** de mensagem, de contato entrando e de chamar atenção.
- **Arquivos e fotos**: botão, arrastar e soltar, ou colar uma imagem. Com confirmação antes de enviar.
- **Emoticons**: `:)` vira 😊, `:D` vira 😃 e há um seletor com dezenas de opções.
- **Fica na barra de menus** (Mac) ou na bandeja (Windows), com o número de mensagens não lidas no ícone do Dock.
- **Mensagem pessoal** (é a sua bio do Telegram), que também aparece ao lado do nome dos seus contatos.

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
