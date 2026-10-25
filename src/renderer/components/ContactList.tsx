import { useEffect, useMemo, useState } from 'react';
import { STATUS, STATUS_ORDER } from '../../shared/status';
import type { Contact, Me, MyStatus, PresenceInfo, Prefs } from '../../shared/types';
import { lex } from '../lib/api';
import { describe } from '../lib/presence';
import { Avatar } from './Avatar';
import { Buddy, KindIcon } from './Icons';
import { ProfileDialog } from './ProfileDialog';

type Section = 'online' | 'offline' | 'groups' | 'others';
const TITLES: Record<Section, string> = {
  online: 'Online',
  offline: 'Offline',
  groups: 'Grupos',
  others: 'Canais, robôs e anotações',
};

function sectionOf(c: Contact): Section {
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

export function ContactList() {
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
    const groups: Record<Section, Contact[]> = { online: [], offline: [], groups: [], others: [] };
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
            <button
              className={`music-btn ${prefs?.shareMusic ? 'on' : ''}`}
              onClick={() => void lex.setPrefs({ shareMusic: !prefs?.shareMusic })}
              title={prefs?.shareMusic ? 'Parar de mostrar a música que estou ouvindo' : 'Mostrar a música que estou ouvindo'}
              aria-pressed={!!prefs?.shareMusic}
            >
              🎵
            </button>
          </div>
          {presence?.musicError && <div className="music-error">{presence.musicError}</div>}
        </div>
      </header>

      <div className="search">
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
                    onClick={() => setSelected(c.id)}
                    onDoubleClick={() => lex.openChat(c.id)}
                    onKeyDown={(e) => e.key === 'Enter' && lex.openChat(c.id)}
                    title={[c.subtitle, c.lastMessage && `Última mensagem: ${c.lastMessage}`].filter(Boolean).join('\n')}
                  >
                    <KindIcon kind={c.kind} color={d.color} title={d.label || undefined} />
                    <span className="contact-name">{c.name}</span>
                    {d.label && <span className={`contact-status ${d.color}`}>({d.label})</span>}
                    {d.personal ? (
                      <span className={`contact-sub personal ${d.music ? 'music' : ''}`}> — {d.personal}</span>
                    ) : (
                      <span className="contact-sub">{c.lastMessage ? ` — ${c.lastMessage}` : ''}</span>
                    )}
                    {c.unread > 0 && <span className="badge">{c.unread > 99 ? '99+' : c.unread}</span>}
                  </div>
                  );
                })}
              {!isCollapsed && !list.length && <p className="empty">Ninguém online agora.</p>}
            </section>
          );
        })}
      </div>

      <footer className="list-foot">Clique duas vezes em um contato para conversar.</footer>
      {profileOpen && me && prefs && <ProfileDialog me={me} prefs={prefs} presence={presence} onClose={() => setProfileOpen(false)} />}
    </div>
  );
}
