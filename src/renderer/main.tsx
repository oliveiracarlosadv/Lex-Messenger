import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { AuthState } from '../shared/types';
import { ChatWindow } from './components/ChatWindow';
import { ContactList } from './components/ContactList';
import { Login } from './components/Login';
import { Toast, type ToastProps } from './components/Toast';
import { NudgePopup, type NudgeData } from './components/NudgePopup';
import { lex } from './lib/api';
import { playSound } from './lib/sounds';
import './styles.css';

const route = decodeURIComponent(location.hash.replace(/^#/, ''));
const chatMatch = route.match(/^\/chat\/(.+)$/);
const toastMatch = route.match(/^\/toast\/(.+)$/s);
const nudgeMatch = route.match(/^\/nudge\/(.+)$/s);

function ListApp() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  useEffect(() => {
    void lex.authState().then(setAuth);
    const offs = [lex.on('auth:state', setAuth), lex.on('sound', playSound)];
    return () => offs.forEach((f) => f());
  }, []);
  if (!auth) return null;
  return auth === 'ready' ? <ContactList /> : <Login auth={auth} />;
}

function ChatApp({ chatId }: { chatId: string }) {
  useEffect(() => lex.on('auth:state', (s) => s !== 'ready' && s !== 'connecting' && window.close()), []);
  return <ChatWindow chatId={chatId} />;
}

function NudgeWindow({ data }: { data: NudgeData }) {
  useEffect(() => document.body.classList.add('toast-body'), []);
  return (
    <NudgePopup
      data={data}
      onOpen={() => {
        lex.openChat(data.chatId);
        window.close();
      }}
      onClose={() => window.close()}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {nudgeMatch ? (
      <NudgeWindow data={JSON.parse(nudgeMatch[1]) as NudgeData} />
    ) : toastMatch ? (
      <Toast {...(JSON.parse(toastMatch[1]) as ToastProps)} />
    ) : chatMatch ? (
      <ChatApp chatId={chatMatch[1]} />
    ) : (
      <ListApp />
    )}
  </StrictMode>,
);
