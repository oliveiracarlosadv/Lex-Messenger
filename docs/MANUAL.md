# Manual do Lex Messenger

*Comunicação em primeiro lugar!*

## 1. Instalar

### Mac
1. Descubra o tipo do seu Mac: menu  > **Sobre este Mac**. Se aparecer “Apple M1/M2/M3/M4”, baixe a versão
   **Apple**; se aparecer “Intel”, baixe a versão **Intel**. Os links estão na [página inicial](../README.md).
2. Abra o arquivo `.dmg` baixado e arraste o **Lex Messenger** para a pasta **Aplicativos**.
3. Abra o app pela pasta Aplicativos ou pelo Launchpad.
4. Na primeira vez, o macOS pode dizer que não consegue verificar o desenvolvedor. Feche o aviso, abra
   **Ajustes do Sistema > Privacidade e Segurança**, role até o fim e clique em **Abrir Mesmo Assim**. Só é preciso
   fazer isso uma vez.

### Windows
1. Baixe o `LexMessenger-Windows-Instalador.exe` e abra.
2. Se aparecer “O Windows protegeu o computador”, clique em **Mais informações > Executar assim mesmo**.
3. Siga o assistente. Um atalho é criado na Área de Trabalho.

### Android
1. No celular, abra a [página de downloads](https://github.com/oliveiracarlosadv/Lex-Messenger/releases/latest) e
   toque em **LexMessenger-Android.apk**.
2. Quando o download terminar, toque no arquivo. O Android avisa que, por segurança, não instala apps desta fonte:
   toque em **Configurações**, ative **Permitir desta fonte** e volte.
3. Toque em **Instalar**. Se aparecer um aviso do Google Play Protect, toque em **Instalar mesmo assim** (o app ainda
   não está na Play Store).
4. Abra o **Lex Messenger** e toque em **Entrar com número de telefone**. O Telegram manda o código dentro do próprio
   app do Telegram, no mesmo celular: copie e volte para o Lex.
5. Permita as **notificações** quando o Android perguntar.

**No celular é um pouco diferente:**
- A lista de contatos é a tela inicial; **toque** num contato para abrir a conversa e use **‹ Contatos** ou o botão
  voltar do Android para sair dela.
- O aviso de mensagem aparece no **topo da tela** com o app aberto; com o app em segundo plano, vira notificação do
  Android.
- **Chamar atenção** faz o celular **vibrar** e a tela tremer.
- **Abrir** mostra o arquivo pelo menu **“Abrir com…”** sem guardar nada; **Salvar…** abre o menu do Android para você
  escolher onde guardar (Arquivos, Drive, galeria etc.).
- **Notificações na hora (push)**: quando o Lex é gerado com o Firebase configurado (veja
  [Desenvolvimento](DESENVOLVIMENTO.md#notificações-push-no-android)), as notificações chegam como no Telegram oficial,
  na hora, **mesmo com o app fechado**, com a **foto** de quem mandou, e sem o aviso fixo “Conectado ao Telegram”.
- **Sem push** (modo “Manter conectado em segundo plano”, em Configurações > Avisos): o Lex continua conectado e
  avisando com o app fora da tela. Fica um aviso fixo e discreto
  **“Conectado ao Telegram”** na barra de notificações: é ele que impede o Android de desligar o app. Na primeira vez,
  o Android pergunta se o Lex pode **rodar em segundo plano sem economia de bateria**: toque em **Permitir**.
- Se você **fechar o app arrastando-o para fora** da lista de apps recentes, alguns celulares desligam tudo; aí os
  avisos voltam quando você abrir o Lex de novo. Em celulares Xiaomi, Samsung e Motorola, vale também liberar o
  “início automático”/“sem restrições de bateria” para o Lex nos ajustes do aparelho.
- Na conversa, a **seta ‹** volta para a lista e mostra quantas mensagens não lidas há nas outras conversas.
- **Música que estou ouvindo**: ao ligar o 🎵, o Android pede para liberar o **“Acesso a notificações”** para o Lex
  (Ajustes > Notificações > Acesso a notificações). É só o jeito que o Android dá para saber qual música está tocando;
  o Lex não lê suas notificações.
- **Chamar atenção** chega na barra de notificações como “Fulano chamou a sua atenção! Deseja abrir a conversa?”, com
  os botões **Abrir conversa** e **Agora não**.
- Notificações de uma conversa **somem da barra** quando ela é lida (aqui ou em outro aparelho).

### iPhone (sem App Store)
1. No iPhone, abra o **Safari** (precisa ser o Safari) e entre em **https://oliveiracarlosadv.github.io/Lex-Messenger/**.
2. Toque em **Compartilhar** (o quadrado com a seta para cima) e depois em **“Adicionar à Tela de Início”** > **Adicionar**.
3. Abra o **Lex Messenger** pelo ícone novo na tela de início e entre com o número de telefone.

**Diferenças no iPhone:** a Apple não deixa apps instalados fora da App Store funcionarem em segundo plano, então
os avisos de mensagem só aparecem com o Lex aberto na tela; ao abrir, ele busca tudo o que chegou. Também não há
“música que estou ouvindo”. Conversas, áudios, câmera, recados, figurinhas, listas, autodestruição e configurações
funcionam como no Android.

## 2. Entrar com a sua conta do Telegram

Você precisa ter uma conta no Telegram (no celular). Há dois jeitos de entrar:

**Pelo QR Code (mais fácil)**
1. No Lex Messenger, clique em **Entrar com o celular (QR Code)**.
2. No celular, abra o Telegram e vá em **Configurações > Dispositivos > Conectar dispositivo**.
3. Aponte a câmera para o código que aparece no computador. Pronto.

**Pelo número de telefone**
1. Clique em **Entrar com número de telefone** e digite seu celular com DDD.
2. O Telegram envia um código **dentro do próprio app do Telegram** no celular (ou por SMS). Digite o código.

Se você ativou a **verificação em duas etapas** no Telegram, o app também pede essa senha.

**Não tem Telegram? Crie a conta pelo Lex**
1. Na tela de entrada, toque em **Não tenho Telegram — criar conta** e digite o seu celular com DDD.
2. O código chega **por SMS** (você ainda não tem o app do Telegram). Digite o código.
3. Informe **nome** e, se quiser, **sobrenome**. Leia os **Termos de Serviço** e a **Política de Privacidade** do
   Telegram (os links abrem no navegador), marque **“Li e aceito”** e toque em **Criar conta**.

A conta é do Telegram, gratuita: depois dá para usar o mesmo número no app oficial também. Se o Telegram não permitir
criar a conta por aqui (ele às vezes restringe por país ou por número), o Lex avisa: nesse caso, crie pelo app oficial
e depois entre no Lex normalmente.

Você só faz isso uma vez: nas próximas aberturas, o Lex Messenger entra sozinho.

## 3. Lista de contatos

- **Online** (bonequinho verde), **Ausente** (laranja, com reloginho: saiu há menos de 10 minutos) e **Offline** (cinza).
- Quem tem **foto** aparece com ela, redonda, e a **borda** mostra o status com as mesmas cores (verde, laranja,
  vermelho para ocupado, cinza). Quem não tem foto aparece com o bonequinho.
- **Grupos** e **Canais, robôs e anotações** ficam em seções próprias. Clique no título para recolher ou abrir.
- O número laranja mostra mensagens não lidas.
- **Clique duas vezes** num contato para abrir a conversa (ou selecione e aperte Enter).
- Use **Procurar um contato…** para achar alguém pelo nome.
- **Seu status**: clique em “(Disponível)” e escolha entre Disponível, Ocupado, Ausente, Volto já, Em horário de almoço,
  Ao telefone e Aparecer offline. Bonequinho verde é disponível, vermelho é ocupado, laranja é ausente.
- **Ausente automático**: se o computador ficar 10 minutos parado (ou com a tela bloqueada), você aparece como Ausente
  e volta sozinho ao mexer. Dá para desligar em **Meu perfil**.
- **Mensagem pessoal**: clique no texto em itálico abaixo do seu nome. Ela vira a sua bio no Telegram (até 70 letras).
- Ao lado do nome dos contatos aparece a **mensagem pessoal deles** (a bio do Telegram) e, se usarem o Lex Messenger,
  o status e a música.

Pessoas que escondem o “visto por último” no Telegram aparecem como Offline.

### Online, Invisível, Desligado e Silencioso
Logo abaixo do seu nome há uma barra rápida:
- **🟢 Online**: conectado e aparecendo online.
- **👻 Invisível**: você **aparece offline**, mas continua **recebendo** mensagens normalmente.
- **⏻ Desligado**: desliga o Lex por um tempo — **30 min, 1 hora, 2 horas, 8 horas, 1 dia, 3 dias**, um prazo seu
  (em minutos, horas ou dias) ou **até você ligar de novo**. Desligado, você aparece offline e não recebe nada; no fim
  do prazo o Lex liga sozinho e busca tudo o que chegou. Para voltar antes, toque em **Ligar agora**.
- **🔔/🔕 Silencioso**: as mensagens continuam chegando e contando, mas **sem som, sem vibração e sem avisos** na
  tela. No celular, elas ficam quietinhas na barra de notificações.

### Como os status chegam aos outros
O Telegram só conhece “online” e “offline”. Por isso o Lex Messenger coloca o status no começo da sua bio, por exemplo
**“⛔ Ocupado · Audiência às 14h”**. Quem usa o Lex Messenger vê o bonequinho vermelho; quem usa o Telegram comum vê
esse texto no seu perfil. **Aparecer offline** deixa você offline no Telegram e não mostra status nem música. Ao sair
do Lex Messenger, a bio volta a ser só a sua mensagem pessoal.

### Nova conversa ✏️ (contatos do Telegram e da agenda)
Toque em **✏️** ao lado da engrenagem:
- **Por número**: digite o celular com DDD e toque em **Procurar**. Se a pessoa tiver Telegram, aparece
  **Conversar**; se não, **Convidar por SMS** (abre o app de mensagens com um convite e o link do Lex).
- **✈️ Contatos do Telegram**: todos os seus contatos que têm Telegram, **mesmo os com quem você nunca conversou**.
- **📒 Agenda do celular** (Android): toque em **Procurar na agenda**. O Android pede permissão para ler os contatos; o
  Lex confere no Telegram quem tem conta (como o app oficial faz) e mostra **Conversar** para quem tem e **Convidar**
  para quem não tem. Os números são enviados ao Telegram só para essa conferência e ficam salvos como contatos lá.
- No computador e no iPhone não há acesso à agenda, mas a aba “Contatos do Telegram” já traz os contatos que o seu
  Telegram sincronizou pelo celular.

### Favoritos ⭐ e grupos 👥
- **Favoritar**: clique com o botão direito num contato (no celular, toque e segure) e escolha **Adicionar aos
  favoritos**, ou toque na **☆** no alto da conversa. Os favoritos ficam na seção **⭐ Favoritos**, no topo da lista.
  Eles ficam numa pasta “Favoritos” da sua conta do Telegram, então aparecem iguais no Mac, no Android, no iPhone e
  no app oficial.
- **Criar grupo**: toque em **👥** ao lado da engrenagem, dê um nome, escolha os participantes e toque em **Criar
  grupo**. Se alguém não puder ser adicionado (por privacidade), o Lex avisa.

## 3.1 Configurações ⚙️

Clique na **engrenagem ⚙️** ao lado da busca (no Mac, também em **Lex Messenger > Configurações…** ou Cmd + ,):
- **Avisos**: som, aviso de mensagem nova, aviso de contato entrando; no Android, também “continuar recebendo em
  segundo plano” e um atalho para os ajustes de notificação do sistema.
- **Privacidade**: quem vê seu visto por último, sua foto e seu telefone, quem pode adicionar você em grupos,
  encaminhar suas mensagens com seu nome e ligar para você (Todos, Meus contatos ou Ninguém). As exceções que você
  já tinha no Telegram são mantidas.
- **Aparelhos**: onde sua conta está conectada; dá para desconectar um aparelho ou todos os outros.
- **Bloqueados**: lista de bloqueados, com a opção de desbloquear.
- **Conta**: dados da conta, verificação em duas etapas, Telegram Premium e limpeza de arquivos temporários.

## 3.2 Meu perfil

Clique na **sua foto** ou no **seu nome**, no topo da lista (ou no menu **Lex Messenger > Editar meu perfil…**):
- **Trocar foto…**: escolha uma imagem; ela é cortada em quadrado e vira sua foto no Telegram.
- **Nome e Sobrenome**: mude e clique em **Salvar**.
- **Status**, **mensagem pessoal**, **música** e **Ausente automático**.

## 3.3 Música que estou ouvindo 🎵

Clique no botão **🎵** ao lado da sua mensagem pessoal (ou marque a opção em Meu perfil). Enquanto uma música toca, a
mensagem pessoal vira **“🎵 Nome da música — Artista”**; quando para, volta ao texto normal.
- **Mac**: funciona com Apple Music e Spotify. Na primeira vez, o macOS pergunta se o Lex Messenger pode controlar o
  app de música: clique em **OK**. Se negou sem querer, libere em **Ajustes do Sistema > Privacidade e Segurança >
  Automação**.
- **Windows**: funciona com o player que estiver tocando (Spotify, Windows Media Player, navegador etc.).
- A troca de música aparece em até meio minuto (o Telegram limita quantas vezes a bio pode mudar).

## 4. Conversas

- Cada conversa abre em **uma janela só dela**. Enter envia; **Shift + Enter** pula linha.
- O aviso **“Fulano está digitando uma mensagem…”** aparece embaixo do histórico.
- **Emoticons**: clique em 😊 ▾ ou digite `:)` `:D` `;)` `:(` `:P` `:O` `<3` e similares.
- Ao abrir uma conversa, ela já aparece na **última mensagem**.
- Cada mensagem mostra **quem enviou e a hora** em cima, com o texto logo abaixo. Seu nome fica em verde; o do contato, em azul.
- **Carregar mensagens anteriores** fica no topo do histórico.
- Links são clicáveis e abrem no navegador.

### Mensagens de áudio 🎤
Com a caixa de texto vazia, o botão **Enviar** vira um **🎤**.
- **Segure** o 🎤 enquanto fala e **solte** para enviar. Para desistir, **arraste para a esquerda** antes de soltar.
- **Mãos livres:** dê **um toque** no 🎤 (ou arraste para cima) e fale à vontade, sem segurar. Depois toque em
  **Enviar ➤**, ou em **🗑 Cancelar**.
- Na primeira vez, o sistema pede permissão para usar o **microfone**: permita.
- Para ouvir, toque no **▶**. Toque na onda para pular para um trecho, e no **1x** para ouvir em 1,5x ou 2x.
- **🔁 Ouvir áudios em sequência** (na barra de baixo): ao terminar um áudio, o próximo toca sozinho.
- Contas **Telegram Premium** também veem o botão **Aa**, que transforma o áudio em texto. Nas demais contas, ele não
  aparece.

### Mensagens que se autodestroem ⏱
Toque no **⏱** da barra de baixo e escolha **30 segundos, 1 minuto, 5 minutos, 1 hora ou 24 horas**. A partir daí,
tudo o que você mandar nessa conversa (texto, foto, áudio, vídeo) leva a marca **“⏱ some em…”** e é **apagado para
os dois lados** quando o tempo acaba. No lugar, fica o aviso **“🔥 Mensagem autodestruída”**, que **também some
12 horas depois**. Para parar, toque em ⏱ e escolha **Desligado**.

- Quem apaga é o Lex de quem enviou: se o seu aparelho estiver sem internet na hora marcada, a mensagem some assim
  que ele voltar a se conectar.
- Quem usa o Telegram comum também vê a marca “⏱ Some em…” e vê a mensagem sumir.
- O Lex guarda só o **número** da mensagem e a hora de apagar — nunca o conteúdo.

### Mídia sensível 🔞
Ao enviar fotos ou vídeos (📎, 🖼️ ou arrastando para a janela), aparece a confirmação **“Enviar … para Fulano?”**
com a opção **🔞 Sensível**; na câmera, a opção fica na prévia, antes de **Enviar**. Quem recebe vê só um quadro
escuro **“🔞 Mídia sensível — Toque para ver”**: a mídia aparece ao tocar e **volta a ficar coberta** ao tocar em
**🙈 Ocultar de novo**, quando o vídeo termina ou ao sair da conversa. Antes de a pessoa tocar, nem a miniatura é
baixada. No Telegram oficial, ela chega com o efeito de “spoiler” (borrada até tocar).

### Exportar a conversa 📤 e avisos de print
- **📤 Exportar**, no alto da conversa, salva toda a conversa num arquivo (abre no navegador e pode ser impresso ou
  salvo em PDF), com datas, horários, respostas e marcas de mensagem temporária. Fotos e arquivos aparecem como
  [anexo]. **A outra pessoa é avisada**: “📤 Exportou esta conversa”.
- **Print da tela** com uma conversa aberta: a outra pessoa recebe o aviso **oficial do Telegram** (“Fulano tirou uma
  captura de tela”, visto até no app oficial). Se havia **mensagem temporária** ou **mídia sensível** na tela, o aviso
  diz isso (“⚠️ O print incluiu mídia sensível”).
- **Gravação da tela**: “🎥 Começou a gravar a tela nesta conversa”.
- Onde funciona: **Android 14 ou mais novo** (gravação: Android 15+), **Mac** e **Windows** (prints e gravações
  feitos pelo próprio sistema, salvos na pasta padrão). No **iPhone pelo Safari** não é possível saber de prints.

### Excluir conversa e bloquear 🗑 🚫
No menu **⋯** no alto da conversa (ou com o botão direito / toque longo no contato, na lista):
- **🚫 Bloquear contato**: a pessoa não consegue mais mandar mensagens nem ligar, e não vê quando você está online.
  Para desfazer, **✅ Desbloquear** no mesmo lugar (ou em Configurações > Bloqueados).
- **🧹 Limpar conversa**: o Lex avisa que **toda a conversa será limpa** e apaga todas as mensagens, fotos, áudios e
  arquivos, mas a conversa **continua na lista**, vazia. Marque “Apagar também para Fulano” para limpar dos dois lados.
- **🗑 Excluir conversa**: apaga a conversa da sua lista; marque **“Apagar também para Fulano”** para apagar dos dois
  lados. Em grupos e canais, a opção é **Sair**. Não dá para desfazer.

### SMS / RCS 💬
O botão **💬** no alto da conversa abre o **app de mensagens do aparelho** (no Android, o Mensagens do Google; no
iPhone e no Mac, o Mensagens) com o número da pessoa e o texto que você estava escrevendo. Se os dois aparelhos
tiverem **RCS**, ele envia por RCS; senão, vai como **SMS** (pode ter custo da operadora). O Lex não envia SMS/RCS
sozinho — isso é feito pelo app de mensagens. O número vem do Telegram quando a pessoa o compartilha; senão, digite.

### Lista de tarefas 📋
Toque no **📋**, dê um título e escreva os itens (um por linha). A outra pessoa **toca nos quadradinhos** para marcar
como feito (ou desmarcar), e a lista mostra **“2 de 5 feitos”** para os dois. Quem criou a lista também pode marcar.
Cada marcação aparece na conversa como “✅ Ana marcou “Procuração””.

### Figurinhas e GIFs 🎞️
Toque no **🎞️**: **🕘** são as figurinhas recentes, **GIF** traz os GIFs salvos e uma busca (ex.: “obrigado”), e os
outros botões são os seus pacotes de figurinhas. Toque numa para enviar. GIFs e figurinhas animadas tocam sozinhos na
conversa.

### Vídeos 🎬
Toque no vídeo para assistir **dentro da conversa**, com pausa, barra de tempo e tela cheia (vídeos de até 150 MB).

### Câmera: foto, vídeo e recado 📷
Toque no **📷** da barra de baixo da conversa e escolha:
- **📷 Foto**: toque no botão branco para tirar a foto.
- **🎬 Vídeo**: toque no botão vermelho para começar e de novo para parar.
- **⭕ Recado**: um vídeo **redondo** de até 1 minuto, como um áudio com imagem (o mesmo das “mensagens de vídeo”
  do Telegram). Quem recebe vê a bolinha tocando, inclusive no app oficial.

Depois de tirar ou gravar, aparece a **prévia**: toque em **Enviar ➤** ou em **↺ Refazer**. O **🔄** troca entre a
câmera da frente e a de trás. Na primeira vez, o sistema pede permissão para usar a **câmera** (e o microfone, para
vídeos): permita. Fotos e vídeos que já estão no aparelho continuam no **🖼️**.

Na conversa, toque no **recado redondo** para assistir com som; toque de novo para pausar.

### Responder, reagir, editar, apagar, encaminhar
Clique com o **botão direito** numa mensagem (no celular, **toque e segure**), ou no **⋯** ao lado da hora:
- **Reações**: escolha um emoji na linha de cima; para tirar, toque de novo nele.
- **Responder**: a mensagem aparece citada acima da sua resposta. Clique na citação para ir até a original.
- **Editar** (só as suas mensagens de texto): o texto volta para a caixa; corrija e clique em **Salvar**.
- **Apagar para mim** ou **para todos**, **Copiar texto** e **Encaminhar…** (escolha a conversa de destino).
- **✓** quer dizer enviada; **✓✓ azul**, lida pela pessoa (só em conversas individuais).
- Links viram um **cartão de prévia** com o nome do site, o título e a imagem.
- **🔔/🔕** no alto da conversa silencia aquela conversa: ela para de tocar som e de avisar.

### Chamar atenção 📳
Quando alguém chama a **sua** atenção, aparece um aviso no meio da tela, tremendo e com o som de chocalho:
**“Fulano chamou a sua atenção! Deseja abrir a conversa?”**. Escolha **Abrir conversa** ou **Agora não**. Se a
conversa já estiver aberta na sua frente, ela só treme. No celular em segundo plano, chega uma notificação; toque nela
para abrir a conversa.

Para chamar a atenção de alguém, toque no **📳** da barra de baixo da conversa. Se a outra pessoa usa o Lex Messenger, a janela dela treme e toca um som. Se ela usa o
Telegram comum, recebe a mensagem “📳 Chamou sua atenção!”. Para não exagerar, é preciso esperar 10 segundos entre
uma chamada e outra.

### Arquivos e fotos 📎
- Clique em **Enviar arquivos** ou **Enviar fotos** e escolha um ou mais arquivos; ou
- **arraste** arquivos para a janela; ou
- **cole** uma imagem (Cmd + V / Ctrl + V), como uma captura de tela.

O app sempre pergunta antes de enviar. Fotos chegam como foto; os demais, como arquivo.

Arquivos recebidos têm os botões **Abrir** e **Salvar…**:
- **Abrir** usa uma cópia **temporária**, apagada quando o Lex fecha. Nada é guardado no computador nem no celular.
- **Salvar…** guarda uma cópia **onde você escolher** (no computador, a pasta sugerida é Downloads).

O Lex **nunca** guarda sozinho fotos, vídeos, recados ou áudios, nem na galeria nem na memória do app.

## 5. Avisos, barra de menus e Dock

- **Aviso no canto da tela**: quando chega mensagem e a conversa não está na frente, sobe uma janelinha no canto
  inferior direito com a foto, “Fulano diz:” e o começo do texto. **Clique** para abrir a conversa ou no **×** para
  fechar; ela some sozinha depois de alguns segundos (parando o mouse em cima, ela espera). Também aparece quando um
  contato entra. Para desligar: ícone da barra de menus > **Notificações**.

- **Fechar a lista de contatos não desconecta**: o Lex Messenger continua no ícone da barra de menus (Mac, perto do
  relógio) ou na bandeja (Windows, perto do relógio). Clique nele para abrir a lista, trocar o status, ligar ou
  desligar sons e notificações, ou sair.
- No Mac, o ícone do Dock mostra **quantas mensagens não lidas** existem e “pula” quando chega mensagem; o número
  também aparece ao lado do ícone da barra de menus. Na primeira vez que você entra, o macOS pergunta se o
  Lex Messenger pode enviar notificações: clique em **Permitir**, porque sem isso o número do Dock não aparece. Se negou
  sem querer, ligue em **Ajustes do Sistema > Notificações > Lex Messenger** (deixe “Indicadores” ativado).
- **Sons**: “plim-plim” para mensagem nova, uma escadinha para contato entrando e um chocalho para chamar atenção.
  Para ouvir, use **Tocar som de teste** no ícone da barra de menus.

## 6. Sair da conta

Menu **Lex Messenger > Desconectar conta…**. Suas conversas continuam no Telegram. Você também pode encerrar a
sessão pelo celular, em **Configurações > Dispositivos**.

## Problemas comuns

| Problema | O que fazer |
| --- | --- |
| “Muitas tentativas. Aguarde…” | O Telegram bloqueia por alguns minutos após muitos códigos. Espere o tempo indicado. |
| O código não chegou | Veja dentro do app do Telegram no celular (vem de “Telegram”, não por SMS). |
| O QR Code expirou | Ele se renova sozinho a cada 30 segundos; aponte de novo. |
| Não ouço sons | Confira o ícone da barra de menus > **Sons**, e o volume do computador. |
| Um contato aparece sempre Offline | Ele esconde o “visto por último” no Telegram. |
| A música não aparece | Confira o botão 🎵 ligado e a permissão em Ajustes do Sistema > Privacidade e Segurança > Automação. |
| Minha bio ficou com “⛔ Ocupado” | Abra o Lex Messenger e escolha Disponível, ou edite a bio pelo celular. |
