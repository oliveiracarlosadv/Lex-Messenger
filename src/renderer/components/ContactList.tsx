import { useEffect, useMemo, useState } from 'react';
import { STATUS, STATUS_ORDER } from '../../shared/status';
import type { Contact, Me, MyStatus, PresenceInfo, Prefs } from '../../shared/types';
import { lex } from '../lib/api';
import { describe } from '../lib/presence';
import { Avatar } from './Avatar';
import { Buddy } from './Icons';
import { ContactIcon } from './ContactIcon';
import { ProfileDialog } from './ProfileDialog';
import { SettingsDialog } from './SettingsDialog';
import { NewGroupDialog } from './NewGroupDialog';
import { NewChatDialog } from './NewChatDialog';
import { QuickBar } from './QuickBar';
import { DeleteChatDialog, toggleBlock } from './ChatActions';

type Section = 'favorites' | 'online' | 'offline' | 'groups' | 'others';
const TITLES: Record<Section, string> = {
  favorites: '⭐ Favoritos',
  online: 'Online',
  offline: 'Offline',
  groups: 'Grupos',
  others: 'Canais, robôs e anotações',
};

function sectionOf(c: Contact): Section {
  if (c.favorite) return 'favorites';
  if (c.kind === 'user') return c.presence === 'offline' ? 'offline' : 'online';
  if (c.kind === 'group') return 'groups';
  return 'others';
}

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem('lex-collapsed') ?? '{}');
  } catch {
    return {};
  }
}

export function ContactList({ connecting = false }: { connecting?: boolean }) {
  const [me, setMe] = useState<Me | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);
  const [pm, setPm] = useState('');
  const [editingPm, setEditingPm] = useState(false);
  const [presence, setPresence] = useState<PresenceInfo | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [newChat, setNewChat] = useState(false);
  const [rowMenu, setRowMenu] = useState<{ c: Contact; x: number; y: number } | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [clearingC, setClearingC] = useState<Contact | null>(null);
  const toggleFavorite = async (c: Contact) => {
    try {
      await lex.setFavorite(c.id, !c.favorite);
    } catch (e) {
      alert((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    }
  };

  // Terminou de conectar: busca perfil e contatos (a tela já estava aberta).
  useEffect(() => {
    if (connecting) return;
    void lex.me().then((m) => m && setMe(m));
    void lex.contacts().then((c) => c.length && setContacts(c));
  }, [connecting]);

  useEffect(() => {
    void lex.me().then(setMe);
    void lex.contacts().then(setContacts);
    void lex.prefs().then((p) => {
      setPrefs(p);
      setPm(p.personalMessage);
    });
    void lex.presence().then(setPresence);
    const offs = [
      lex.on('me:changed', setMe),
      lex.on('presence:changed', setPresence),
      lex.on('profile:open', () => setProfileOpen(true)),
      lex.on('settings:open', () => setSettingsOpen(true)),
      lex.on('contacts:changed', setContacts),
      lex.on('contact:patch', (p) => setContacts((list) => list.map((c) => (c.id === p.id ? { ...c, ...p } : c)))),
      lex.on('prefs:changed', (p) => {
        setPrefs(p);
        setPm(p.personalMessage);
      }),
    ];
    return () => offs.forEach((f) => f());
  }, []);

  const toggle = (s: Section) => {
    const next = { ...collapsed, [s]: !collapsed[s] };
    setCollapsed(next);
    try {
      localStorage.setItem('lex-collapsed', JSON.stringify(next));
    } catch {
      /* ignora */
    }
  };

  const sections = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('pt-BR');
    const groups: Record<Section, Contact[]> = { favorites: [], online: [], offline: [], groups: [], others: [] };
    for (const c of contacts) {
      if (q && !c.name.toLocaleLowerCase('pt-BR').includes(q)) continue;
      groups[sectionOf(c)].push(c);
    }
    for (const list of Object.values(groups)) {
      list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastDate - a.lastDate);
    }
    return groups;
  }, [contacts, query]);

  const savePm = () => {
    setEditingPm(false);
    if (prefs && pm !== prefs.personalMessage) void lex.setPersonalMessage(pm);
  };

  const status: MyStatus = prefs?.status ?? 'online';
  const effective: MyStatus = presence?.effective ?? status;
  const music = prefs?.shareMusic && effective !== 'invisible' ? presence?.music : null;

  return (
    <div className="list-window">
      {connecting && (
        <div className="connecting-bar" role="status">
          <span className="mini-spinner" /> Conectando ao Telegram…
        </div>
      )}
      <header className="list-head">
        <button className="avatar-btn" onClick={() => setProfileOpen(true)} title="Trocar foto e nome">
          <Avatar id="me" name={me?.name ?? ''} hasPhoto={me?.hasPhoto} size={48} version={me?.photoVersion} />
        </button>
        <div className="list-me">
          <div className="me-line">
            <Buddy presence={STATUS[effective].color} size={16} title={STATUS[effective].label} />
            <button className="me-name" onClick={() => setProfileOpen(true)} title="Editar meu perfil">
              {me?.name ?? '…'}
            </button>
            <select
              className="status-select"
              value={status}
              onChange={(e) => void lex.setStatus(e.target.value as MyStatus)}
              aria-label="Meu status"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  ({STATUS[s].label})
                </option>
              ))}
            </select>
          </div>
          {presence?.autoAway && <div className="auto-away">Ausente automaticamente (computador parado)</div>}
          <div className="pm-line">
            {editingPm ? (
              <input
                className="about-input"
                autoFocus
                maxLength={70}
                value={pm}
                placeholder="Digite uma mensagem pessoal"
                onChange={(e) => setPm(e.target.value)}
                onBlur={savePm}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') savePm();
                  if (e.key === 'Escape') {
                    setPm(prefs?.personalMessage ?? '');
                    setEditingPm(false);
                  }
                }}
              />
            ) : (
              <button className="about" onClick={() => setEditingPm(true)} title="Aparece como sua bio no Telegram">
                {music ? `🎵 ${music}` : prefs?.personalMessage || '<Digite uma mensagem pessoal>'}
              </button>
            )}
            {lex.features.music && (
            <button
              className={`music-btn ${prefs?.shareMusic ? 'on' : ''}`}
              onClick={() => void lex.setPrefs({ shareMusic: !prefs?.shareMusic })}
              title={prefs?.shareMusic ? 'Parar de mostrar a música que estou ouvindo' : 'Mostrar a música que estou ouvindo'}
              aria-pressed={!!prefs?.shareMusic}
            >
              🎵
            </button>
            )}
          </div>
          {presence?.musicError && <div className="music-error">{presence.musicError}</div>}
        </div>
      </header>

      {prefs && <QuickBar prefs={prefs} />}

      <div className="search">
        <button className="gear-btn" onClick={() => setSettingsOpen(true)} title="Configurações" aria-label="Configurações">
          ⚙️
        </button>
        <button className="gear-btn" onClick={() => setNewChat(true)} title="Nova conversa (contatos do Telegram e da agenda)" aria-label="Nova conversa">
          ✏️
        </button>
        <button className="gear-btn" onClick={() => setGroupOpen(true)} title="Criar um grupo" aria-label="Criar um grupo">
          👥
        </button>
        <input placeholder="🔍 Procurar um contato…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="contacts" role="listbox" aria-label="Contatos">
        {(Object.keys(TITLES) as Section[]).map((s) => {
          const list = sections[s];
          if (!list.length && s !== 'online') return null;
          const isCollapsed = collapsed[s] && !query;
          return (
            <section key={s}>
              <button className="group-title" onClick={() => toggle(s)} aria-expanded={!isCollapsed}>
                <span className={`arrow ${isCollapsed ? '' : 'open'}`}>▶</span>
                {TITLES[s]} ({list.length})
              </button>
              {!isCollapsed &&
                list.map((c) => {
                  const d = describe(c);
                  return (
                  <div
                    key={c.id}
                    role="option"
                    aria-selected={selected === c.id}
                    tabIndex={0}
                    className={`contact ${selected === c.id ? 'selected' : ''} ${c.unread ? 'has-unread' : ''}`}
                    onClick={() => (lex.features.mobile ? lex.openChat(c.id) : setSelected(c.id))}
                    onDoubleClick={() => lex.openChat(c.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setRowMenu({ c, x: e.clientX, y: e.clientY });
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && lex.openChat(c.id)}
                    title={[c.subtitle, c.lastMessage && `Última mensagem: ${c.lastMessage}`].filter(Boolean).join('\n')}
                  >
                    <ContactIcon id={c.id} kind={c.kind} color={d.color} hasPhoto={c.hasPhoto} size={lex.features.mobile ? 50 : 42} title={d.label || undefined} />
                    {/* Nome em cima; status e mensagem pessoal (ou música) logo abaixo, em letra menor. */}
                    <div className="contact-lines">
                      <span className="contact-name">
                        {c.name}
                        {c.premium && <span className="premium-badge" title="Telegram Premium"> ⭐</span>}
                        {c.muted && <span className="muted-icon" title="Conversa silenciada"> 🔕</span>}
                      </span>
                      {(d.label || d.personal || c.lastMessage) && (
                        <span className={`contact-sub ${d.personal ? 'personal' : ''} ${d.music ? 'music' : ''}`}>
                          {d.label && <span className={`contact-status ${d.color}`}>{d.label}</span>}
                          {d.label && (d.personal || c.lastMessage) && ' · '}
                          {d.personal || c.lastMessage}
                        </span>
                      )}
                    </div>
                    {c.unread > 0 && <span className={`badge ${c.muted ? 'muted' : ''}`}>{c.unread > 99 ? '99+' : c.unread}</span>}
                  </div>
                  );
                })}
              {!isCollapsed && !list.length && <p className="empty">Ninguém online agora.</p>}
            </section>
          );
        })}
      </div>

      <footer className="list-foot">
        {lex.features.mobile ? 'Toque em um contato para conversar.' : 'Clique duas vezes em um contato para conversar.'}
      </footer>
      {profileOpen && me && prefs && <ProfileDialog me={me} prefs={prefs} presence={presence} onClose={() => setProfileOpen(false)} />}
      {groupOpen && <NewGroupDialog onClose={() => setGroupOpen(false)} />}
      {newChat && <NewChatDialog onClose={() => setNewChat(false)} />}
      {deleting && <DeleteChatDialog contact={deleting} onClose={() => setDeleting(null)} />}
      {clearingC && <DeleteChatDialog contact={clearingC} mode="clear" onClose={() => setClearingC(null)} />}
      {rowMenu && (
        <div className="menu-back" onMouseDown={() => setRowMenu(null)} onContextMenu={(e) => e.preventDefault()}>
          <div
            className="msg-menu"
            style={{ left: Math.min(rowMenu.x, window.innerWidth - 230), top: Math.min(rowMenu.y, window.innerHeight - 210) }}
            onMouseDown={(e) => e.stopPropagation()}
            role="menu"
          >
            <button
              role="menuitem"
              onClick={() => {
                lex.openChat(rowMenu.c.id);
                setRowMenu(null);
              }}
            >
              💬 Abrir conversa
            </button>
            <button
              role="menuitem"
              onClick={() => {
                void toggleFavorite(rowMenu.c);
                setRowMenu(null);
              }}
            >
              {rowMenu.c.favorite ? '☆ Tirar dos favoritos' : '⭐ Adicionar aos favoritos'}
            </button>
            {rowMenu.c.kind === 'user' && (
              <button
                role="menuitem"
                onClick={() => {
                  void toggleBlock(rowMenu.c, (t) => alert(t));
                  setRowMenu(null);
                }}
              >
                {rowMenu.c.blocked ? '✅ Desbloquear' : '🚫 Bloquear contato'}
              </button>
            )}
            <button
              role="menuitem"
              className="danger"
              onClick={() => {
                setClearingC(rowMenu.c);
                setRowMenu(null);
              }}
            >
              🧹 Limpar conversa
            </button>
            <button
              role="menuitem"
              className="danger"
              onClick={() => {
                setDeleting(rowMenu.c);
                setRowMenu(null);
              }}
            >
              🗑 Excluir conversa
            </button>
          </div>
        </div>
      )}
      {settingsOpen && me && prefs && (
        <SettingsDialog me={me} prefs={prefs} onClose={() => setSettingsOpen(false)} onProfile={() => setProfileOpen(true)} />
      )}
    </div>
  );
}
