import { useEffect, useRef, useState } from 'react';
import { BIO_MAX, STATUS, STATUS_ORDER } from '../../shared/status';
import type { Me, MyStatus, PresenceInfo, Prefs } from '../../shared/types';
import { lex } from '../lib/api';
import { Avatar } from './Avatar';

/** "Meu perfil": foto, nome, status, mensagem pessoal e música. */
export function ProfileDialog({ me, prefs, presence, onClose }: { me: Me; prefs: Prefs; presence: PresenceInfo | null; onClose: () => void }) {
  const [first, setFirst] = useState(me.firstName);
  const [last, setLast] = useState(me.lastName);
  const [pm, setPm] = useState(prefs.personalMessage);
  const [busy, setBusy] = useState<'' | 'name' | 'photo'>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const nameChanged = first.trim() !== me.firstName || last.trim() !== me.lastName;

  const save = async () => {
    setMsg(null);
    try {
      if (nameChanged) {
        setBusy('name');
        await lex.setName(first, last);
      }
      if (pm !== prefs.personalMessage) await lex.setPersonalMessage(pm);
      setMsg({ ok: true, text: 'Perfil atualizado.' });
      setTimeout(onClose, 700);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') || 'Não foi possível salvar.' });
    } finally {
      setBusy('');
    }
  };

  const changePhoto = async () => {
    setMsg(null);
    setBusy('photo');
    try {
      if (await lex.choosePhoto()) setMsg({ ok: true, text: 'Foto atualizada.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') || 'Não foi possível trocar a foto.' });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Meu perfil">
        <h2>Meu perfil</h2>

        <div className="profile-photo">
          <Avatar id="me" name={me.name} hasPhoto={me.hasPhoto} size={84} version={me.photoVersion} />
          <div>
            <button className="btn" onClick={() => void changePhoto()} disabled={!!busy}>
              {busy === 'photo' ? 'Enviando foto…' : '🖼️ Trocar foto…'}
            </button>
            <p className="hint">A foto é cortada em quadrado e vale para o Telegram todo.</p>
          </div>
        </div>

        <div className="field-row">
          <label>
            Nome
            <input ref={firstRef} value={first} maxLength={64} onChange={(e) => setFirst(e.target.value)} />
          </label>
          <label>
            Sobrenome
            <input value={last} maxLength={64} onChange={(e) => setLast(e.target.value)} />
          </label>
        </div>

        <label className="field">
          Status
          <select value={prefs.status} onChange={(e) => void lex.setStatus(e.target.value as MyStatus)}>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Mensagem pessoal
          <input value={pm} maxLength={BIO_MAX} placeholder="Ex.: Audiência às 14h ⚖️" onChange={(e) => setPm(e.target.value)} />
        </label>

        {lex.features.music && (
        <label className="check">
          <input type="checkbox" checked={prefs.shareMusic} onChange={(e) => void lex.setPrefs({ shareMusic: e.target.checked })} />
          🎵 Mostrar a música que estou ouvindo
          <span className="hint block">
            {lex.platform === 'darwin'
              ? 'Apple Music ou Spotify.'
              : lex.features.mobile
                ? 'O app de música que estiver tocando (o Android pede para liberar o "Acesso a notificações").'
                : 'O player de música que estiver tocando.'}{' '}
            Aparece no lugar da mensagem pessoal enquanto toca.
          </span>
        </label>
        )}
        {presence?.musicError && <p className="error">{presence.musicError}</p>}

        {!lex.features.mobile && (
        <label className="check">
          <input type="checkbox" checked={prefs.autoAway} onChange={(e) => void lex.setPrefs({ autoAway: e.target.checked })} />
          🕒 Ficar Ausente depois de 10 minutos sem usar o computador
        </label>
        )}

        <p className="hint">
          O Telegram só mostra “online” e “offline”. Status e música vão no começo da sua bio, e outros Lex Messenger mostram o
          bonequinho da cor certa.
        </p>

        {msg && <p className={msg.ok ? 'ok' : 'error'}>{msg.text}</p>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Fechar
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!!busy || !first.trim()}>
            {busy === 'name' ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
