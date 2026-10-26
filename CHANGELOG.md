# Histórico de versões

## v1.0.1
- **Nova conversa** ✏️: contatos do Telegram (mesmo sem conversa ainda), **agenda do celular** no Android mostrando quem tem Telegram, busca por número e **convite por SMS** para quem não tem.
- **Limpar conversa** 🧹: apaga todas as mensagens (para mim ou para os dois) e mantém a conversa na lista, com o aviso de que toda a conversa será limpa.

## v1.0.0
**Primeira versão oficial do Lex Messenger — Comunicação em primeiro lugar!** Disponível para Mac, Windows, Android e
iPhone (pelo Safari). Reúne tudo das versões de teste (0.1 a 0.5) e mais:
- **Excluir conversa** (para mim ou para os dois; em grupos, sair) e **bloquear/desbloquear contato**, no novo menu ⋯ da conversa e no menu do contato.
- **Exportar conversa** 📤 para um arquivo; a outra pessoa é avisada.
- **Avisos de print e gravação de tela** (aviso oficial do Telegram para prints; diz se havia mensagem temporária ou mídia sensível na tela) no Android 14+, Mac e Windows.
- Lema: **Comunicação em primeiro lugar!** (tela de entrada, “Sobre”, README e manual).
- **Manual do Lex Messenger em PDF**, com capa, sumário, fotos das telas, Termos e Privacidade.
- Ao abrir o app de novo, vai **direto para a lista** (com “Conectando…” no topo), sem mostrar a tela inicial.
- **iPhone sem App Store**: app pelo Safari (“Adicionar à Tela de Início”), com as mesmas telas do Android; áudios no formato de voz do Telegram também no iPhone.
- **Mensagens que se autodestroem** (30 s a 24 h), apagadas para os dois lados; o aviso 🔥 some em 12 horas.
- **Criar conta do Telegram** pelo Lex, para quem ainda não tem (código por SMS, nome e aceite dos Termos de Serviço do Telegram na própria tela).
- **Online / Invisível / Desligado** numa barra rápida; **Desligado por um tempo** (30 min a 3 dias, prazo livre ou até ligar), voltando sozinho no fim.
- **Silencioso** 🔕: mensagens chegam, mas sem som, vibração nem avisos.
- **SMS / RCS** 💬: abre o app de mensagens do aparelho com o número e o texto prontos (usa RCS quando disponível).
- **Android**: notificações com a **foto** de quem mandou; **push do Telegram via Firebase** pronto para ligar (notificações na hora com o app fechado e sem o aviso fixo).
- **Celular**: a tela não arrasta mais para os lados; “chamou a sua atenção” e nomes longos quebram linha; menus (emojis, figurinhas, autodestruição) viram painéis que sobem de baixo, sempre dentro da tela.
- Autodestruição com escolha em botões grandes, mais moderna (em todas as versões).
- 🔞 agora aparece só na confirmação de envio (e na prévia da câmera).
- **Mídia sensível** 🔞: foto, vídeo ou recado vai coberto (spoiler do Telegram) e só aparece quando a pessoa toca; ao fechar, cobre de novo.
- **Lista de tarefas** na conversa: um cria, o outro marca como feito, com progresso para os dois.
- **Figurinhas e GIFs**: recentes, pacotes, GIFs salvos e busca; GIFs e figurinhas animadas tocam na conversa.
- **Vídeos tocam dentro da conversa**.
- **Favoritos** (pasta “⭐ Favoritos” do Telegram, sincronizada) e **criar grupos**.
- **Android**: “música que estou ouvindo”; chamar atenção na barra de notificações com **Abrir conversa / Agora não**; notificações somem quando a conversa é lida.
- Computador: avisos no canto somem quando a conversa é lida.
- Fotos maiores na lista de contatos.
- **Correção**: a sua resposta agora mostra na hora a mensagem que está sendo respondida.

## v0.4.1
- **Mac**: o Lex volta a aparecer sempre no **Cmd + Tab** e no Dock (os avisos no canto o tiravam de lá).
- **Correção**: a foto nova não aparecia depois de trocada. Agora aparece na hora, e fotos trocadas em outro aparelho são atualizadas quando você volta ao Lex (ou quando o computador sai da suspensão).
- O botão **Aa** (transcrever áudio) só aparece para contas Telegram Premium; nas demais, some o botão e o aviso de “recurso Premium”.
- **Correção**: o recado (vídeo redondo) chegava como áudio. A biblioteca do Telegram marcava o arquivo também como mensagem de voz; agora vai só como vídeo redondo. Recados antigos passam a aparecer como vídeo no Lex.
- Quem tem foto aparece com a **foto** no lugar do bonequinho (na lista, na conversa e ao encaminhar), com uma **borda da cor do status**: verde disponível, laranja ausente, vermelha ocupado, cinza offline. Sem foto, continua o bonequinho.

## v0.4.0
- **Mensagens de áudio** em todas as versões: segurar para gravar, ou **mãos livres** (um toque grava sem segurar). Tocador com onda sonora, velocidade e “ouvir em sequência”. Áudios no formato de voz do Telegram.
- **Ações nas mensagens**: responder citando, editar, apagar para mim/para todos, encaminhar, reações, copiar; ✓/✓✓ de lido; “(editada)”; mensagens encaminhadas identificadas.
- **Câmera na conversa**: foto, vídeo e **recado** (vídeo redondo do Telegram, em MP4), com prévia, “refazer” e troca de câmera; recados tocam dentro da conversa.
- **Chamar atenção**: quem recebe vê um aviso no meio da tela perguntando se quer abrir a conversa.
- **Nada é guardado sem você pedir**: abrir um arquivo usa uma cópia temporária (apagada ao fechar o app); o botão **Salvar…** guarda onde você escolher. Antes, o Lex do computador salvava sozinho em Downloads.
- Conversas abrem sempre na **última mensagem**, mesmo quando fotos e prévias carregam depois.
- **Prévias de links** (cartão com site, título e imagem).
- **Silenciar conversas** (🔕), que também deixam de contar no número de não lidas.
- **Configurações**: avisos, privacidade, aparelhos conectados, bloqueados, verificação em duas etapas e limpeza de temporários.
- **Telegram Premium**: transcrição de áudios em texto, selo ⭐ e arquivos de até 4 GB (para contas Premium).
- **Android em segundo plano**: serviço de conexão (“Conectado ao Telegram”), pedido de liberação de bateria, canal de notificação de alta prioridade e sincronização ao voltar para o app.
- **Android**: seta de voltar com o número de não lidas nas outras conversas.
- Lista de contatos em duas linhas: nome em cima; status e mensagem pessoal (ou música) embaixo, em letra menor.
- Botões de arquivo, foto e chamar atenção agora ficam só na barra de baixo da conversa.

## v0.3.0
- **Versão para Android** (`LexMessenger-Android.apk`): mesma conta, contatos e visual. Lista de contatos como tela inicial, conversa com botão de voltar, aviso estilo MSN no topo, notificações do Android com o app em segundo plano, vibração ao chamar atenção, envio de fotos e arquivos, abrir e compartilhar anexos, Meu perfil e status.
- No Android ainda não há “música que estou ouvindo” nem avisos com o app totalmente fechado.
- Por dentro: o motor do Telegram passou a ser o mesmo no computador e no celular.

## v0.2.0
- **Aviso no canto da tela**, como no MSN: janelinha com foto, “Fulano diz:” e o começo da mensagem; clique para abrir a conversa. Também avisa quando um contato entra.
- **Conversa organizada**: cada mensagem mostra quem enviou e a hora em cima, com o texto embaixo.
- **Status do MSN**: Ocupado, Ausente, Volto já, Em horário de almoço e Ao telefone, além de Disponível e Aparecer offline. “Ausente” automático com o computador parado.
- **Música que estou ouvindo** (Apple Music e Spotify no Mac; o player em uso no Windows).
- **Meu perfil**: trocar foto, nome e sobrenome.
- A lista e a conversa mostram a **mensagem pessoal dos contatos**.
- **Sons novos** com timbre de sininho, no estilo MSN, e correção: antes eles podiam não tocar até o primeiro clique.
- **Contador de mensagens no ícone do Dock** (o app agora pede a permissão de notificações que o macOS exige) e ao lado do ícone da barra de menus.
- Eventos técnicos do Telegram deixam de aparecer como “evento da conversa”.

## v0.1.0
Primeira versão.
- Entrada com a conta do Telegram por QR Code ou número de telefone (com verificação em duas etapas).
- Lista de contatos com Online, Ausente e Offline, grupos, canais, busca e mensagens não lidas.
- Uma janela para cada conversa, com “está digitando…”, fotos de perfil e histórico.
- Chamar atenção (janela treme), sons próprios, emoticons.
- Envio de arquivos e fotos por botão, arrastar e soltar ou colar; abrir e salvar anexos recebidos.
- Ícone na barra de menus / bandeja, contador no Dock e notificações.
- Instaladores para Mac (Apple e Intel) e Windows.
