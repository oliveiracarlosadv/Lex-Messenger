# Política de Privacidade do Lex Messenger

Última atualização: 26/10/2026 (versão 1.1.1). Responsável: Carlos Alexandre Albuquerque Oliveira (Lex Tecnologias).

1. **Sem servidor intermediário.** O Lex Messenger se conecta diretamente aos servidores do Telegram, com o protocolo
   oficial (MTProto). Nenhuma mensagem, contato ou arquivo passa por servidores da Lex Tecnologias.
2. **Sem coleta de dados.** O app não tem estatísticas de uso, anúncios nem rastreadores, e não envia dados a
   terceiros além do próprio Telegram e, no Android, do serviço de avisos do Google (item 3).
3. **Avisos com o app fechado (Android) — Google Firebase.** Para avisar de mensagens com o app fechado, o Android
   usa o Firebase Cloud Messaging, do Google. O Lex registra no Telegram um **código do aparelho** (token) gerado pelo
   Google e uma **chave criada no próprio celular**. O Telegram manda o aviso **criptografado com essa chave**; o Google
   só entrega o pacote e **não consegue ler** quem mandou nem o texto. Só o seu celular decifra. O Google pode tratar
   dados técnicos do aparelho para fazer a entrega, conforme a política dele: <https://policies.google.com/privacy>.
   Ao **desconectar a conta**, o registro é apagado no Telegram. No iPhone e no computador não há esse serviço.
4. **O que fica no seu aparelho:**
   - a sessão de acesso ao Telegram, criptografada pelo sistema (Chaveiro, no Mac); no Android, na área privada do
     app, que outros apps não conseguem ler;
   - suas preferências (sons, notificações, status);
   - para as mensagens que se autodestroem, só o **número** da mensagem e a **hora** de apagar (nunca o conteúdo),
     até que ela seja apagada;
   - no iPhone, a sessão fica na área privada do app (instalado pelo Sideloadly) ou no armazenamento do site (pelo
     Safari), no próprio aparelho;
   - **Android:** fotos de perfil pequenas, para mostrar nos avisos com o app fechado, na área privada do app
     (apagadas ao desconectar a conta);
   - **widget “Online agora”** (Android e iPhone): nome, status e foto pequena de até 12 contatos online, na área
     privada do app, só para o widget mostrar (apagados ao desconectar a conta);
   - nada mais: arquivos que você **abre** usam uma cópia temporária, apagada quando o app fecha, e só ficam guardados
     os que você **salvar** de propósito, no lugar que escolher. Fotos, vídeos, recados e áudios feitos pelo Lex não
     vão para a galeria.
   Fora os casos acima (avisos e widget), fotos de perfil e prévias ficam só na memória e somem quando o app é
   fechado. No iPhone, a foto que acompanha cada aviso é entregue ao sistema de avisos do iOS, que a guarda junto
   do aviso.
5. **O que vai para a sua bio do Telegram.** Sua mensagem pessoal e, se você escolher, o status (Ocupado, Ausente…) e
   a música que está tocando. A bio é visível para quem pode ver o seu perfil no Telegram, conforme as suas
   configurações de privacidade lá. A leitura da música é **desligada por padrão**: só acontece se você ativar o botão
   🎵, e o app lê apenas o nome da música e do artista no Apple Music, no Spotify ou nos controles de mídia do Windows.
6. **Agenda do celular (Android).** Só é lida se você tocar em **Procurar na agenda** e der a permissão. Os números são
   enviados ao Telegram apenas para conferir quem tem conta (o mesmo que o app oficial faz) e ficam salvos como seus
   contatos no Telegram. O Lex não guarda a agenda.
7. **Android — “Acesso a notificações”.** Só é pedido se você ligar a “música que estou ouvindo”, porque é o único
   jeito de o Android dizer qual música está tocando. O Lex lê apenas o título e o artista da música; não lê o
   conteúdo das suas notificações.
8. **Microfone e câmera.** Usados só enquanto você grava um áudio (🎤) ou está com a câmera da conversa aberta (📷).
   Fotos, vídeos e áudios vão direto para o Telegram; o Lex não guarda gravações.
9. **Transcrição de áudio.** Ao tocar em **Aa**, o pedido de transcrição é feito ao Telegram (recurso Premium), que
   devolve o texto.
10. **Bio dos contatos.** Para mostrar a mensagem pessoal dos seus contatos, o app consulta a bio deles no Telegram,
   como o app oficial faz ao abrir um perfil. Nada disso é guardado em disco.
11. **Telegram.** O tratamento dos dados da sua conta pelo Telegram segue a política dele:
   <https://telegram.org/privacy>.
12. **Como apagar tudo.** Use **Desconectar conta…** no menu e, se quiser, apague o app. No Mac, os dados ficam em
   `~/Library/Application Support/Lex Messenger`; no Windows, em `%APPDATA%\Lex Messenger`; no Android, basta
   desinstalar o app (ou limpar os dados dele em Configurações > Apps).
13. **Contato.** Dúvidas: abra uma “issue” em <https://github.com/oliveiracarlosadv/Lex-Messenger/issues>.
