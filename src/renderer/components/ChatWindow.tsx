import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChatMessage, Contact, Me } from '../../shared/types';
import { lex } from '../lib/api';
import { convertFaces, PICKER } from '../lib/emoticons';
import { formatDay, formatSize, formatTime, splitLinks } from '../lib/format';
import { Avatar } from './Avatar';
import { KindIcon } from './Icons';
import { describe } from '../lib/presence';

export function ChatWindow({ chatId }: { chatId: string }) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ label: string; progress: number | null } | null>(null);
  const [picker, setPicker] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState('');
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickBottom = useRef(true);
  const typingTimer = useRef<number>(0);

  // Carrega contato, perfil e histórico.
  useEffect(() => {
    void lex.contact(chatId).then((c) => {
      setContact(c);
      if (c) document.title = `${c.name} — Conversa`;
    });
    void lex.me().then(setMe);
    void lex.history(chatId).then((h) => {
      setMessages(h);
      setHasMore(h.length >= 30);
      setLoading(false);
    });
    lex.markRead(chatId);
    lex.refreshContact(chatId);
    const offs = [
      lex.on('message:new', (m) => {
        if (m.chatId !== chatId) return;
        setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m].sort((a, b) => a.id - b.id)));
        if (!m.out) setTyping(null);
        if (m.nudge && !m.out) flashNotice(`${m.senderName} chamou a sua atenção!`);
      }),
      lex.on('message:deleted', ({ chatId: cid, ids }) => {
        if (cid && cid !== chatId) return;
        if (!cid && chatId.startsWith('-100')) return;
        setMessages((list) => list.filter((m) => !ids.includes(m.id)));
      }),
      lex.on('contact:patch', (p) => p.id === chatId && setContact((c) => (c ? { ...c, ...p } : c))),
      lex.on('contacts:changed', (list) => {
        const c = list.find((x) => x.id === chatId);
        if (c) setContact(c);
      }),
      lex.on('me:changed', setMe),
      lex.on('typing', (t) => {
        if (t.chatId !== chatId) return;
        setTyping(t.name);
        window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setTyping(null), 6000);
      }),
      lex.on('send:progress', (p) => p.chatId === chatId && setProgress(p.label ? p : null)),
    ];
    const onFocus = () => lex.markRead(chatId);
    window.addEventListener('focus', onFocus);
    inputRef.current?.focus();
    return () => {
      offs.forEach((f) => f());
      window.removeEventListener('focus', onFocus);
    };
  }, [chatId]);

  // Mantém a conversa rolada até o fim quando chegam mensagens.
  useLayoutEffect(() => {
    const el = historyRef.current;
    if (el && stickBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const flashNotice = (t: string) => {
    setNotice(t);
    window.setTimeout(() => setNotice(''), 4000);
  };

  const loadOlder = async () => {
    const first = messages[0];
    if (!first) return;
    const el = historyRef.current!;
    const prevHeight = el.scrollHeight;
    const older = await lex.history(chatId, first.id);
    setHasMore(older.length >= 30);
    stickBottom.current = false;
    setMessages((list) => [...older.filter((o) => !list.some((m) => m.id === o.id)), ...list]);
    requestAnimationFrame(() => (el.scrollTop = el.scrollHeight - prevHeight));
  };

  const onScroll = () => {
    const el = historyRef.current!;
    stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const send = async () => {
    const t = convertFaces(text.trim());
    if (!t) return;
    setText('');
    stickBottom.current = true;
    try {
      await lex.sendText(chatId, t);
    } catch {
      setText(t);
      flashNotice('Não foi possível enviar. Verifique a internet e tente de novo.');
    }
    inputRef.current?.focus();
  };

  const nudge = async () => {
    stickBottom.current = true;
    const ok = await lex.sendNudge(chatId);
    if (!ok) flashNotice('Espere um pouquinho antes de chamar a atenção de novo.');
  };

  const sendFiles = async (paths?: string[]) => {
    setPendingFiles([]);
    stickBottom.current = true;
    try {
      await lex.sendFiles(chatId, paths);
    } catch {
      flashNotice('Não foi possível enviar o arquivo.');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const paths = [...e.dataTransfer.files].map((f) => lex.pathForFile(f)).filter(Boolean);
    if (paths.length) setPendingFiles(paths);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const files = [...e.clipboardData.files];
    if (!files.length) return;
    const paths = files.map((f) => lex.pathForFile(f)).filter(Boolean);
    e.preventDefault();
    if (paths.length) return setPendingFiles(paths);
    const img = files.find((f) => f.type.startsWith('image/'));
    if (!img) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (!confirm(`Enviar a imagem colada para ${contact?.name ?? 'o contato'}?`)) return;
      stickBottom.current = true;
      await lex.sendImageData(chatId, String(reader.result));
    };
    reader.readAsDataURL(img);
  };

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    setPicker(false);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const name = contact?.name ?? '…';
  const d = contact ? describe(contact) : null;
  const canWrite = contact?.kind !== 'channel';

  return (
    <div
      className={`chat-window ${dragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <header className="chat-head">
        <div className="chat-to">
          Para: {contact && d && <KindIcon kind={contact.kind} color={d.color} size={16} />} <b>{name}</b>
          <span className="chat-sub">
            {d?.label ? ` (${d.label})` : ''} {contact?.subtitle && `— ${contact.subtitle}`}
          </span>
        </div>
        {d?.personal && <div className={`chat-pm ${d.music ? 'music' : ''}`}>{d.personal}</div>}
        <nav className="chat-toolbar">
          <ToolButton icon="📎" label="Enviar arquivos" onClick={() => void sendFiles()} disabled={!canWrite} />
          <ToolButton icon="🖼️" label="Enviar fotos" onClick={() => void sendFiles()} disabled={!canWrite} />
          <ToolButton icon="📳" label="Chamar atenção" onClick={() => void nudge()} disabled={!canWrite || contact?.kind !== 'user'} />
        </nav>
      </header>

      <div className="chat-main">
        <div className="chat-left">
          <div className="history" ref={historyRef} onScroll={onScroll}>
            {loading && <p className="muted center">Carregando conversa…</p>}
            {!loading && hasMore && (
              <button className="link-btn older" onClick={() => void loadOlder()}>
                Carregar mensagens anteriores
              </button>
            )}
            {!loading && !messages.length && <p className="muted center">Nenhuma mensagem ainda. Diga um oi! 👋</p>}
            {messages.map((m, i) => (
              <MessageItem key={m.id} m={m} prev={messages[i - 1]} chatId={chatId} />
            ))}
          </div>

          <div className="status-line" aria-live="polite">
            {progress ? (
              <span>
                {progress.label}
                {progress.progress != null && ` — ${Math.round(progress.progress * 100)}%`}
              </span>
            ) : notice ? (
              <b>{notice}</b>
            ) : typing ? (
              <span>✏️ {typing} está digitando uma mensagem…</span>
            ) : contact?.kind === 'user' && d?.label && d.color === 'busy' ? (
              <span>
                {name} está {d.label.toLowerCase()} e pode demorar a responder.
              </span>
            ) : contact?.kind === 'user' && contact.presence === 'offline' ? (
              <span>{name} parece estar offline. A mensagem será entregue quando entrar.</span>
            ) : (
              <span>&nbsp;</span>
            )}
          </div>

          {pendingFiles.length > 0 && (
            <div className="confirm-bar">
              Enviar {pendingFiles.length === 1 ? `"${pendingFiles[0].split('/').pop()}"` : `${pendingFiles.length} arquivos`} para{' '}
              {name}?
              <button className="btn btn-primary" onClick={() => void sendFiles(pendingFiles)}>
                Enviar
              </button>
              <button className="btn" onClick={() => setPendingFiles([])}>
                Cancelar
              </button>
            </div>
          )}

          {canWrite ? (
            <div className="compose">
              <div className="format-bar">
                <div className="picker-wrap">
                  <button className="mini-btn" onClick={() => setPicker(!picker)} title="Emoticons" aria-expanded={picker}>
                    😊 ▾
                  </button>
                  {picker && (
                    <div className="picker" role="dialog" aria-label="Emoticons">
                      {PICKER.map((p) => (
                        <button key={p.emoji} title={p.code ? `${p.name}  ${p.code}` : p.name} onClick={() => insertEmoji(p.emoji)}>
                          {p.emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="mini-btn" onClick={() => void nudge()} title="Chamar atenção" disabled={contact?.kind !== 'user'}>
                  📳
                </button>
                <button className="mini-btn" onClick={() => void sendFiles()} title="Enviar arquivo ou foto">
                  📎
                </button>
              </div>
              <div className="compose-row">
                <textarea
                  ref={inputRef}
                  value={text}
                  placeholder={lex.features.mobile ? 'Escreva sua mensagem…' : 'Escreva sua mensagem… (Enter envia, Shift+Enter pula linha)'}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (e.target.value) lex.typing(chatId);
                  }}
                  onPaste={onPaste}
                  onKeyDown={(e) => {
                    // No celular, Enter pula linha e o botão Enviar envia.
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !lex.features.mobile) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <button className="btn btn-send" onClick={() => void send()} disabled={!text.trim()}>
                  Enviar
                </button>
              </div>
            </div>
          ) : (
            <p className="muted center readonly">Este é um canal: só os administradores podem escrever.</p>
          )}
        </div>

        <aside className="chat-right">
          <Avatar id={chatId} name={name} hasPhoto={contact?.hasPhoto} size={96} />
          <Avatar id="me" name={me?.name ?? ''} hasPhoto={me?.hasPhoto} size={96} version={me?.photoVersion} />
        </aside>
      </div>
      {dragOver && <div className="drop-hint">Solte aqui para enviar a {name}</div>}
    </div>
  );
}

function ToolButton({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="tool-btn" onClick={onClick} disabled={disabled}>
      <span className="tool-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

const sameDay = (a: number, b: number) => new Date(a * 1000).toDateString() === new Date(b * 1000).toDateString();

function MessageItem({ m, prev, chatId }: { m: ChatMessage; prev?: ChatMessage; chatId: string }) {
  const newDay = !prev || !sameDay(prev.date, m.date);
  const day = newDay && <div className="day-sep">{formatDay(m.date)}</div>;

  if (m.service) {
    return (
      <>
        {day}
        <div className="service-msg">
          {m.senderName} {m.text} <span className="time">{formatTime(m.date)}</span>
        </div>
      </>
    );
  }
  if (m.nudge) {
    return (
      <>
        {day}
        <div className="nudge-msg">
          <hr />
          {m.out ? 'Você chamou a atenção.' : `${m.senderName} chamou a sua atenção!`} <span className="time">{formatTime(m.date)}</span>
          <hr />
        </div>
      </>
    );
  }
  // Uma mensagem por bloco: quem enviou e a hora em cima, o texto embaixo.
  return (
    <>
      {day}
      <div className={`msg-block ${m.out ? 'me' : 'them'}`}>
        <div className="says">
          <b className="sender">{m.senderName}</b> diz: <span className="time">({formatTime(m.date)})</span>
        </div>
        <div className="msg">
          {m.media && <Media m={m} chatId={chatId} />}
          {m.text && (
            <div className="msg-text">
              {splitLinks(m.text).map((p, i) =>
                p.url ? (
                  <a key={i} href={p.url} target="_blank" rel="noreferrer">
                    {p.text}
                  </a>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Media({ m, chatId }: { m: ChatMessage; chatId: string }) {
  const media = m.media!;
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const visual = media.kind === 'photo' || media.kind === 'video' || media.kind === 'sticker';

  useEffect(() => {
    if (!visual) return;
    let alive = true;
    void lex.mediaPreview(chatId, m.id).then((u) => alive && setPreview(u));
    return () => {
      alive = false;
    };
  }, [chatId, m.id, visual]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    },
    [],
  );
  const open = () => void run(() => lex.openMedia(chatId, m.id));
  const reveal = () => void run(() => lex.revealMedia(chatId, m.id));

  if (visual && preview) {
    return (
      <button className={`media-thumb ${media.kind}`} onClick={open} title="Clique para abrir" disabled={busy}>
        <img src={preview} alt={media.name ?? 'imagem'} />
        {media.kind === 'video' && <span className="play">▶</span>}
      </button>
    );
  }
  const icon = { photo: '🖼️', video: '🎬', audio: '🎵', voice: '🎤', sticker: '🙂', file: '📄', other: '📎' }[media.kind];
  return (
    <div className="file-card">
      <span className="file-icon">{icon}</span>
      <div className="file-info">
        <div className="file-name">{media.kind === 'voice' ? 'Mensagem de voz' : media.name ?? 'Anexo'}</div>
        <div className="muted">{visual && preview === undefined ? 'carregando prévia…' : formatSize(media.size)}</div>
      </div>
      {media.kind !== 'other' && (
        <div className="file-actions">
          <button className="link-btn" onClick={open} disabled={busy}>
            {busy ? 'Baixando…' : 'Abrir'}
          </button>
          <button className="link-btn" onClick={reveal} disabled={busy}>
            {lex.features.mobile ? 'Compartilhar' : 'Mostrar na pasta'}
          </button>
        </div>
      )}
    </div>
  );
}
