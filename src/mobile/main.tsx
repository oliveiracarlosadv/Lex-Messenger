import { createRoot } from 'react-dom/client';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { MobileBridge } from './bridge';
import '../renderer/styles.css';
import './mobile.css';

// A ponte precisa existir antes das telas, que usam window.lex.
const bridge = new MobileBridge();
window.lex = bridge.api();

// Links das mensagens abrem no navegador do celular.
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
  if (a && /^https?:/i.test(a.href)) {
    e.preventDefault();
    window.lex.openExternal(a.href);
  }
});

// Botão "voltar" do Android: sai da conversa; na lista, minimiza o app.
void CapApp.addListener('backButton', () => {
  if (location.hash.startsWith('#/chat/')) history.back();
  else void CapApp.minimizeApp();
}).catch(() => {});

// Voltou para o app: busca o que chegou enquanto estava em segundo plano.
void CapApp.addListener('appStateChange', ({ isActive }) => {
  bridge.setForeground(isActive);
  if (isActive) bridge.resync();
}).catch(() => {});

// Navegador (iPhone): aba escondida conta como fora de uso.
document.addEventListener('visibilitychange', () => bridge.setForeground(document.visibilityState === 'visible'));

void bridge.start();

// Versão pelo navegador (iPhone): registra o serviço que permite abrir sem internet.
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator && location.protocol === 'https:') {
  void navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// As telas leem window.lex ao carregar, por isso entram depois da ponte.
void import('./App').then(({ MobileApp }) => createRoot(document.getElementById('root')!).render(<MobileApp bridge={bridge} />));
