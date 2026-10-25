import { useEffect, useRef, useState } from 'react';
import type { AuthState, Contact } from '../shared/types';
import { Avatar } from '../renderer/components/Avatar';
import { ChatWindow } from '../renderer/components/ChatWindow';
import { ContactList } from '../renderer/components/ContactList';
import { Login } from '../renderer/components/Login';
import { lex } from '../renderer/lib/api';
import { playSound, unlockAudio } from '../renderer/lib/sounds';
import type { InAppToast, MobileBridge } from './bridge';
import { NudgePopup, type NudgeData } from '../renderer/components/NudgePopup';
import { isIOS, isNative } from './platform';

/** iPhone no Safari, ainda não instalado na tela de início: explica como instalar. */
function InstallHint() {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone || matchMedia('(display-mode: standalone)').matches;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('lex-install-hint') === '0';
    } catch {
      return false;
    }
  });
  if (isNative || !isIOS || standalone || hidden) return null;
  return (
    <div className="install-hint" role="note">
      <span>
        📲 <b>Instale no iPhone:</b> toque em <b>Compartilhar</b> <span className="ios-share">⬆︎</span> e depois em{' '}
        <b>“Adicionar à Tela de Início”</b>.
      </span>
      <button
        aria-label="Fechar"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem('lex-install-hint', '0');
          } catch {
            /* ignora */
          }
        }}
      >
        ×
      </button>
    </div>
  );
}

const chatFromHash = () => {
  const m = location.hash.match(/^#\/chat\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
};

export function MobileApp({ bridge }: { bridge: MobileBridge }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [chat, setChat] = useState<string | null>(chatFromHash);
  const [toast, setToast] = useState<InAppToast | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [nudge, setNudge] = useState<NudgeData | null>(null);
  const toastTimer = useRef(0);

  useEffect(() => {
    void lex.authState().then(setAuth);
    const onHash = () => setChat(chatFromHash());
    window.addEventListener('hashchange', onHash);
    const unlock = () => unlockAudio();
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('click', unlock, { once: true });
    // Não lidas por conversa, para o contador do botão voltar (canais não contam).
    const fromList = (list: Contact[]) =>
      setUnread(Object.fromEntries(list.filter((c) => c.kind !== 'channel').map((c) => [c.id, c.muted ? 0 : c.unread])));
    void lex.contacts().then(fromList);
    const offs = [
      lex.on('contacts:changed', fromList),
      lex.on('contact:patch', (p) => {
        if (typeof p.unread === 'number' || 'muted' in p) void lex.contacts().then(fromList);
      }),
      lex.on('auth:state', setAuth),
      lex.on('sound', playSound),
      bridge.on('nudge-popup', (n) => setNudge(n as NudgeData)),
      bridge.on('toast', (t) => {
        setToast(t as InAppToast);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 5000);
      }),
    ];
    return () => {
      offs.forEach((f) => f());
      window.removeEventListener('hashchange', onHash);
    };
  }, [bridge]);

  useEffect(() => {
    bridge.currentChat = chat;
    if (chat) setToast((t) => (t?.chatId === chat ? null : t));
  }, [bridge, chat]);

  const otherUnread = Object.entries(unread).reduce((n, [id, v]) => (id === chat ? n : n + v), 0);

  if (!auth) return null;
  if (auth !== 'ready')
    return (
      <>
        <InstallHint />
        <Login auth={auth} />
      </>
    );

  return (
    <div className="mobile-shell">
      <InstallHint />
      <div className={`screen list-screen ${chat ? 'behind' : ''}`}>
        <ContactList />
      </div>
      {chat && (
        <div className="screen chat-screen" key={chat}>
          <div className="mobile-topbar">
            <button
              className="back-btn"
              onClick={() => history.back()}
              aria-label={otherUnread ? `Voltar. ${otherUnread} mensagens não lidas em outras conversas` : 'Voltar'}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15.5 4.5 8 12l7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {otherUnread > 0 && <span className="back-badge">{otherUnread > 99 ? '99+' : otherUnread}</span>}
            </button>
          </div>
          <ChatWindow chatId={chat} />
        </div>
      )}
      {nudge && (
        <div className="modal-back nudge-back">
          <NudgePopup
            data={nudge}
            onOpen={() => {
              setNudge(null);
              lex.openChat(nudge.chatId);
            }}
            onClose={() => setNudge(null)}
          />
        </div>
      )}
      {toast && (
        <button
          className={`toast mobile-toast toast-${toast.kind}`}
          onClick={() => {
            setToast(null);
            lex.openChat(toast.chatId);
          }}
        >
          <div className="toast-bar">
            <span>Lex Messenger</span>
          </div>
          <div className="toast-main">
            <Avatar id={toast.chatId} name={toast.name} hasPhoto={toast.hasPhoto} size={40} />
            <div className="toast-text">
              <b>{toast.kind === 'message' ? `${toast.title} diz:` : toast.title}</b>
              <span className="toast-msg">{toast.body}</span>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
