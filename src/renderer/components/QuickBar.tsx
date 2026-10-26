import { useEffect, useRef, useState } from 'react';
import type { MyStatus, Prefs } from '../../shared/types';
import { lex } from '../lib/api';

const PRESETS: [number, string][] = [
  [30, '30 min'],
  [60, '1 hora'],
  [120, '2 horas'],
  [480, '8 horas'],
  [1440, '1 dia'],
  [4320, '3 dias'],
];
const UNITS: [number, string][] = [
  [1, 'minutos'],
  [60, 'horas'],
  [1440, 'dias'],
];

const untilText = (until: number) => {
  if (until === -1) return 'até você ligar de novo';
  const d = new Date(until);
  const today = new Date().toDateString() === d.toDateString();
  return `até ${today ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às '}${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

/** Online / Invisível / Desligado (com prazo) e Silencioso, sempre à mão no topo da lista. */
export function QuickBar({ prefs }: { prefs: Prefs }) {
  const [offline, setOfflineState] = useState(prefs.offlineUntil === -1 || prefs.offlineUntil > Date.now() ? prefs.offlineUntil : 0);
  const [sheet, setSheetState] = useState(false);
  // O mesmo toque que abre o painel não pode fechá-lo (no iPhone o toque "vaza" para o fundo que aparece por baixo).
  const openedAt = useRef(0);
  const setSheet = (open: boolean) => {
    if (!open && performance.now() - openedAt.current < 450) return;
    if (open) openedAt.current = performance.now();
    setSheetState(open);
  };
  const [amount, setAmount] = useState('2');
  const [unit, setUnit] = useState(60);

  useEffect(() => lex.on('connection:changed', (c) => setOfflineState(c.connected ? 0 : c.offlineUntil)), []);

  const mode = offline ? 'off' : prefs.status === 'invisible' ? 'invisible' : 'online';

  const goOnline = async (status: MyStatus) => {
    if (offline) {
      setOfflineState(0);
      await lex.setOffline(null);
    }
    if (status === 'invisible' || prefs.status === 'invisible') await lex.setStatus(status);
  };

  const off = async (minutes: number) => {
    setSheetState(false);
    setOfflineState(minutes > 0 ? Date.now() + minutes * 60_000 : -1);
    await lex.setOffline(minutes);
  };

  return (
    <>
      <div className="quick-bar">
        <div className="seg" role="radiogroup" aria-label="Conexão">
          <button role="radio" aria-checked={mode === 'online'} className={mode === 'online' ? 'on online' : ''} onClick={() => void goOnline('online')}>
            🟢 Online
          </button>
          <button
            role="radio"
            aria-checked={mode === 'invisible'}
            className={mode === 'invisible' ? 'on invis' : ''}
            onClick={() => void goOnline('invisible')}
            title="Aparece offline para os outros, mas continua recebendo mensagens"
          >
            👻 Invisível
          </button>
          <button role="radio" aria-checked={mode === 'off'} className={mode === 'off' ? 'on off' : ''} onClick={() => setSheet(true)} title="Desliga o app por um tempo">
            ⏻ Desligado
          </button>
        </div>
        <button
          className={`silent-btn ${prefs.silent ? 'on' : ''}`}
          onClick={() => void lex.setPrefs({ silent: !prefs.silent })}
          aria-pressed={prefs.silent}
          title={prefs.silent ? 'Silencioso ligado: sem sons nem avisos. Toque para desligar.' : 'Silenciar o app (sem sons nem avisos)'}
        >
          {prefs.silent ? '🔕' : '🔔'}
        </button>
      </div>

      {offline !== 0 && (
        <div className="offline-banner" role="status">
          ⏻ <b>Desligado</b> {untilText(offline)} — você aparece offline e não recebe mensagens.
          <button className="btn" onClick={() => void goOnline(prefs.status === 'invisible' ? 'invisible' : 'online')}>
            Ligar agora
          </button>
        </div>
      )}
      {prefs.silent && !offline && <div className="silent-banner">🔕 Silencioso: as mensagens chegam, mas sem som nem aviso.</div>}

      {sheet && (
        <>
          <div className="sheet-back always" onClick={() => setSheet(false)} />
          <div className="off-sheet" role="dialog" aria-label="Desligar por quanto tempo">
            <span className="ttl-title">⏻ Desligar o Lex por quanto tempo?</span>
            <div className="ttl-chips">
              {PRESETS.map(([m, label]) => {
                const [n, ...u] = label.split(' ');
                return (
                  <button key={m} onClick={() => void off(m)}>
                    <b>{n}</b>
                    <span>{u.join(' ')}</span>
                  </button>
                );
              })}
            </div>
            <div className="off-custom">
              <span>Outro:</span>
              <input type="number" min={1} max={999} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Quantidade" />
              <select value={unit} onChange={(e) => setUnit(Number(e.target.value))} aria-label="Unidade">
                {UNITS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" disabled={!(Number(amount) > 0)} onClick={() => void off(Math.round(Number(amount) * unit))}>
                Desligar
              </button>
            </div>
            <button className="btn wide" onClick={() => void off(0)}>
              Até eu ligar de novo
            </button>
            <span className="hint">Desligado, você aparece offline e não recebe mensagens nem avisos. No fim do prazo, o Lex liga sozinho e busca tudo o que chegou.</span>
          </div>
        </>
      )}
    </>
  );
}
