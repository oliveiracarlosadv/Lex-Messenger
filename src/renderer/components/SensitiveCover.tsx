import { useEffect, useRef, useState } from 'react';

/**
 * Mídia sensível: fica coberta até a pessoa tocar. Volta a cobrir ao tocar em "Ocultar",
 * quando o vídeo/recado termina ou ao sair da conversa. Antes de abrir, nem a miniatura é baixada.
 */
export function SensitiveCover({ children, label = 'Mídia sensível' }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Vídeo ou recado terminou: cobre de novo. (Eventos de mídia não "sobem", mas passam pela captura.)
  useEffect(() => {
    const el = box.current;
    if (!el || !open) return;
    const onEnded = () => setOpen(false);
    el.addEventListener('ended', onEnded, true);
    return () => el.removeEventListener('ended', onEnded, true);
  }, [open]);

  if (!open) {
    return (
      <button className="sensitive-cover" onClick={() => setOpen(true)} aria-label={`${label}: toque para ver`}>
        <span className="sensitive-icon">🔞</span>
        <b>{label}</b>
        <span>Toque para ver</span>
      </button>
    );
  }
  return (
    <div className="sensitive-open" ref={box}>
      {children}
      <button className="link-btn sensitive-hide" onClick={() => setOpen(false)}>
        🙈 Ocultar de novo
      </button>
    </div>
  );
}
