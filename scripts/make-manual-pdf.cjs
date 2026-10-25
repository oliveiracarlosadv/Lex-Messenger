// Gera docs/Manual-Lex-Messenger.pdf a partir do manual, termos e privacidade (com fotos das telas).
// Uso: npx electron scripts/make-manual-pdf.cjs
const { app, BrowserWindow } = require('electron');
const { readFileSync, writeFileSync, rmSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const docs = join(root, 'docs');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

app.setPath('userData', join(app.getPath('temp'), 'lex-manual-pdf'));
app.whenReady().then(async () => {
  const { marked } = await import('marked');
  const md = (f) => readFileSync(join(docs, f), 'utf8');
  const strip = (s) => s.replace(/^# .*\n/, ''); // o título vira o título da seção
  const manual = marked.parse(strip(md('MANUAL.md')).replace(/^\*Comunicação em primeiro lugar!\*\n/m, ''));
  const termos = marked.parse(strip(md('TERMOS.md')));
  const priv = marked.parse(strip(md('PRIVACIDADE.md')));
  const shots = [
    ['entrada.png', 'Tela de entrada'],
    ['contatos.png', 'Lista de contatos, com a barra Online / Invisível / Desligado'],
    ['conversa.png', 'Conversa: lista de tarefas, mensagem temporária e mídia sensível'],
    ['menu-mensagem.png', 'Áudio com onda sonora e menu de uma mensagem'],
    ['perfil.png', 'Meu perfil'],
    ['configuracoes.png', 'Configurações'],
    ['aviso.png', 'Aviso de mensagem nova, no canto da tela'],
    ['chamar-atencao.png', 'Chamaram a sua atenção'],
    ['criar-conta.png', 'Criar conta do Telegram'],
    ['android-contatos.png', 'Android: lista de contatos'],
    ['android-conversa.png', 'Android: conversa'],
  ];
  const gallery = shots
    .map(([f, cap]) => `<figure><img src="imagens/${f}" alt=""><figcaption>${cap}</figcaption></figure>`)
    .join('');
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Manual do Lex Messenger</title><style>
    @page { size: A4; margin: 30mm 20mm 20mm 30mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12pt; line-height: 1.5; color: #1d2733; }
    h1 { font-size: 20pt; color: #174a8f; margin: 0 0 6pt; page-break-before: always; }
    h2 { font-size: 15pt; color: #174a8f; margin: 18pt 0 6pt; border-bottom: 1px solid #c7d8ee; padding-bottom: 3pt; }
    h3 { font-size: 13pt; color: #2b6cc4; margin: 14pt 0 4pt; }
    p, li { margin: 3pt 0; text-align: justify; }
    a { color: #2b6cc4; }
    code { font-family: Menlo, monospace; font-size: 10pt; background: #eef4fc; padding: 0 3pt; border-radius: 3pt; }
    table { border-collapse: collapse; width: 100%; margin: 6pt 0; font-size: 11pt; }
    th, td { border: 1px solid #c7d8ee; padding: 4pt 6pt; text-align: left; vertical-align: top; }
    th { background: #eef4fc; }
    .capa { height: 230mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .capa img { width: 46mm; }
    .capa .nome { font-size: 34pt; color: #174a8f; font-weight: 300; margin-top: 10mm; }
    .capa .nome b { color: #2b6cc4; }
    .capa .lema { font-size: 16pt; font-style: italic; color: #3f86da; margin-top: 4mm; }
    .capa .sub { font-size: 13pt; margin-top: 14mm; color: #4a5a6e; }
    .capa .rodape { margin-top: 40mm; font-size: 11pt; color: #6b7a8c; }
    .sumario li { margin: 2pt 0; }
    figure { display: inline-block; width: 48%; margin: 6pt 1%; vertical-align: top; text-align: center; page-break-inside: avoid; }
    figure img { max-width: 100%; max-height: 120mm; border: 1px solid #c7d8ee; border-radius: 6pt; }
    figcaption { font-size: 10pt; color: #4a5a6e; margin-top: 3pt; }
  </style></head><body>
    <section class="capa">
      <img src="imagens/icone.png" alt="">
      <div class="nome">Lex <b>Messenger</b></div>
      <div class="lema">Comunicação em primeiro lugar!</div>
      <div class="sub">Manual do usuário — versão ${version}</div>
      <div class="rodape">Lex Tecnologias · ${today}<br>https://github.com/oliveiracarlosadv/Lex-Messenger</div>
    </section>
    <h1>Sumário</h1>
    <ol class="sumario" id="sumario"></ol>
    <h1 id="s-manual">Manual de uso</h1>${manual}
    <h1 id="s-telas">Telas do Lex Messenger</h1><p>Imagens com contatos fictícios.</p>${gallery}
    <h1 id="s-termos">Termos de Uso</h1>${termos}
    <h1 id="s-priv">Política de Privacidade</h1>${priv}
    <script>
      const ol = document.getElementById('sumario');
      for (const h of document.querySelectorAll('h1[id], #s-manual ~ h2')) {
        if (h.tagName === 'H2' && h.closest('body') && !h.previousElementSibling) continue;
        const li = document.createElement('li');
        li.textContent = h.textContent;
        if (h.tagName === 'H2') li.style.marginLeft = '18pt';
        ol.appendChild(li);
      }
    </script>
  </body></html>`;
  const tmp = join(docs, '.manual-tmp.html');
  writeFileSync(tmp, html);
  const win = new BrowserWindow({ show: false });
  await win.loadFile(tmp);
  await new Promise((r) => setTimeout(r, 800));
  const pdf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-family:Arial;font-size:8pt;color:#6b7a8c;width:100%;text-align:center;">Lex Messenger — Comunicação em primeiro lugar! · página <span class="pageNumber"></span> de <span class="totalPages"></span></div>' });
  writeFileSync(join(docs, 'Manual-Lex-Messenger.pdf'), pdf);
  rmSync(tmp, { force: true });
  console.log('Manual gerado:', (pdf.length / 1024).toFixed(0), 'KB');
  app.exit(0);
});
