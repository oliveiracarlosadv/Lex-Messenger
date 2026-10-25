import { useEffect, useRef, useState } from 'react';
import type { PickItem, StickerPack } from '../../shared/types';
import { lex } from '../lib/api';

/** Miniatura que só baixa quando aparece na tela. */
function PickThumb({ item, onPick }: { item: PickItem; onPick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [thumb, setThumb] = useState<{ url: string; video: boolean } | null | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          io.disconnect();
          void lex.pickThumb(item.key).then(setThumb);
        }
      },
      { rootMargin: '120px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [item.key]);
  return (
    <button ref={ref} className={`pick ${item.kind}`} onClick={onPick} aria-label={item.kind === 'gif' ? 'Enviar GIF' : 'Enviar figurinha'}>
      {thumb ? thumb.video ? <video src={thumb.url} autoPlay loop muted playsInline /> : <img src={thumb.url} alt="" /> : <span className="pick-empty" />}
    </button>
  );
}

type Tab = 'recent' | 'gif' | string;

/** Seletor de figurinhas e GIFs. */
export function StickerPicker({ chatId, onClose, onSent }: { chatId: string; onClose: () => void; onSent: () => void }) {
  const [tab, setTab] = useState<Tab>('recent');
  const [recent, setRecent] = useState<PickItem[]>([]);
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [gifs, setGifs] = useState<PickItem[]>([]);
  const [packItems, setPackItems] = useState<Record<string, PickItem[]>>({});
  const [q, setQ] = useState('');
  const [found, setFound] = useState<PickItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const searchTimer = useRef(0);

  useEffect(() => {
    void lex
      .stickerPanel()
      .then((p) => {
        setRecent(p.recent);
        setPacks(p.packs);
        setGifs(p.gifs);
        if (!p.recent.length && p.packs[0]) setTab(p.packs[0].id);
      })
      .finally(() => setLoading(false));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (tab === 'recent' || tab === 'gif' || packItems[tab]) return;
    void lex.stickerPack(tab).then((items) => setPackItems((m) => ({ ...m, [tab]: items })));
  }, [tab, packItems]);

  const search = (text: string) => {
    setQ(text);
    window.clearTimeout(searchTimer.current);
    if (!text.trim()) return setFound(null);
    searchTimer.current = window.setTimeout(() => void lex.searchGifs(chatId, text).then(setFound).catch(() => setFound([])), 400);
  };

  const pick = async (item: PickItem) => {
    onClose();
    await lex.sendPick(chatId, item.key);
    onSent();
  };

  const items = tab === 'recent' ? recent : tab === 'gif' ? (found ?? gifs) : (packItems[tab] ?? []);
  return (
    <div className="sticker-picker" role="dialog" aria-label="Figurinhas e GIFs">
      <div className="sticker-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'recent'} className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')} title="Recentes">
          🕘
        </button>
        <button role="tab" aria-selected={tab === 'gif'} className={tab === 'gif' ? 'on' : ''} onClick={() => setTab('gif')} title="GIFs">
          GIF
        </button>
        {packs.map((p) => (
          <button key={p.id} role="tab" aria-selected={tab === p.id} className={tab === p.id ? 'on' : ''} onClick={() => setTab(p.id)} title={p.title}>
            {p.title.slice(0, 14)}
          </button>
        ))}
      </div>
      {tab === 'gif' && <input className="about-input gif-search" placeholder="🔍 Procurar GIF (ex.: obrigado, parabéns)" value={q} onChange={(e) => search(e.target.value)} />}
      <div className={`sticker-grid ${tab === 'gif' ? 'gifs' : ''}`}>
        {items.map((i) => (
          <PickThumb key={i.key} item={i} onPick={() => void pick(i)} />
        ))}
        {!loading && !items.length && (
          <p className="muted center">
            {tab === 'recent' ? 'Nenhuma figurinha recente. Escolha um pacote acima.' : tab === 'gif' ? (q ? 'Nenhum GIF encontrado.' : 'Nenhum GIF salvo. Use a busca.') : 'Carregando…'}
          </p>
        )}
        {loading && <p className="muted center">Carregando…</p>}
      </div>
    </div>
  );
}

/** Figurinha em vídeo ou GIF dentro da conversa: toca sozinho, em loop, sem som. */
export function LoopMedia({ chatId, msgId, kind }: { chatId: string; msgId: number; kind: 'gif' | 'sticker' }) {
  const [src, setSrc] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void lex.mediaPreview(chatId, msgId).then((u) => alive && setThumb(u));
    void lex.mediaData(chatId, msgId).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [chatId, msgId]);
  return (
    <div className={`loop-media ${kind}`}>
      {src ? <video src={src} autoPlay loop muted playsInline /> : thumb ? <img src={thumb} alt="" /> : <span className="pick-empty" />}
      {kind === 'gif' && <span className="gif-badge">GIF</span>}
    </div>
  );
}
