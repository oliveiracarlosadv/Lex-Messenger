import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { AuthState } from '../shared/types';
import { ChatWindow } from './components/ChatWindow';
import { ContactList } from './components/ContactList';
import { Login } from './components/Login';
import { lex } from './lib/api';
import { playSound } from './lib/sounds';
import './styles.css';

const route = decodeURIComponent(location.hash.replace(/^#/, ''));
const chatMatch = route.match(/^\/chat\/(.+)$/);

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>{chatMatch ? <ChatApp chatId={chatMatch[1]} /> : <ListApp />}</StrictMode>,
);
