import { useEffect, useMemo, useState } from 'react';
import type { Contact, Me, MyStatus, Prefs } from '../../shared/types';
import { lex } from '../lib/api';
import { Avatar } from './Avatar';
import { Buddy, KindIcon } from './Icons';

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
  const [about, setAbout] = useState('');
  const [editingAbout, setEditingAbout] = useState(false);

  useEffect(() => {
    void lex.me().then((m) => {
      setMe(m);
      setAbout(m?.about ?? '');
    });
    void lex.contacts().then(setContacts);
    void lex.prefs().then(setPrefs);
    const offs = [
      lex.on('me:changed', (m) => {
        setMe(m);
        setAbout(m.about);
      }),
      lex.on('contacts:changed', setContacts),
      lex.on('contact:patch', (p) => setContacts((list) => list.map((c) => (c.id === p.id ? { ...c, ...p } : c)))),
      lex.on('prefs:changed', setPrefs),
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

  const saveAbout = () => {
    setEditingAbout(false);
    if (me && about !== me.about) void lex.setAbout(about);
  };

  const status: MyStatus = prefs?.status ?? 'online';

  return (
    <div className="list-window">
      <header className="list-head">
        <Avatar id="me" name={me?.name ?? ''} hasPhoto={me?.hasPhoto} size={48} />
        <div className="list-me">
          <div className="me-line">
            <Buddy presence={status === 'online' ? 'online' : 'offline'} size={16} />
            <b className="me-name">{me?.name ?? '…'}</b>
            <select
              className="status-select"
              value={status}
              onChange={(e) => void lex.setStatus(e.target.value as MyStatus)}
              aria-label="Meu status"
            >
              <option value="online">(Disponível)</option>
              <option value="invisible">(Aparecer offline)</option>
            </select>
          </div>
          {editingAbout ? (
            <input
              className="about-input"
              autoFocus
              maxLength={70}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              onBlur={saveAbout}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveAbout();
                if (e.key === 'Escape') {
                  setAbout(me?.about ?? '');
                  setEditingAbout(false);
                }
              }}
            />
          ) : (
            <button className="about" onClick={() => setEditingAbout(true)} title="Aparece como sua bio no Telegram">
              {me?.about || '<Digite uma mensagem pessoal>'}
            </button>
          )}
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
                list.map((c) => (
                  <div
                    key={c.id}
                    role="option"
                    aria-selected={selected === c.id}
                    tabIndex={0}
                    className={`contact ${selected === c.id ? 'selected' : ''} ${c.unread ? 'has-unread' : ''}`}
                    onClick={() => setSelected(c.id)}
                    onDoubleClick={() => lex.openChat(c.id)}
                    onKeyDown={(e) => e.key === 'Enter' && lex.openChat(c.id)}
                    title={c.subtitle}
                  >
                    <KindIcon kind={c.kind} presence={c.presence} />
                    <span className="contact-name">{c.name}</span>
                    {c.presence === 'away' && <span className="contact-status">(Ausente)</span>}
                    <span className="contact-sub">{c.lastMessage ? ` — ${c.lastMessage}` : ''}</span>
                    {c.unread > 0 && <span className="badge">{c.unread > 99 ? '99+' : c.unread}</span>}
                  </div>
                ))}
              {!isCollapsed && !list.length && <p className="empty">Ninguém online agora.</p>}
            </section>
          );
        })}
      </div>

      <footer className="list-foot">Clique duas vezes em um contato para conversar.</footer>
    </div>
  );
}
