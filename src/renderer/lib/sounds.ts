// Sons próprios, gerados na hora (sem arquivos de áudio de terceiros).
import type { SoundName } from '../../shared/types';

let ctx: AudioContext | null = null;
const ac = () => (ctx ??= new AudioContext());

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.25) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function playSound(name: SoundName) {
  try {
    if (ac().state === 'suspended') void ac().resume();
    switch (name) {
      case 'message': // "plim-plom"
        tone(1046.5, 0, 0.35, 'sine', 0.22);
        tone(1568, 0.11, 0.5, 'sine', 0.18);
        tone(2093, 0.11, 0.3, 'sine', 0.05);
        break;
      case 'online': // escadinha subindo
        tone(659.3, 0, 0.25, 'triangle', 0.2);
        tone(880, 0.1, 0.25, 'triangle', 0.2);
        tone(1318.5, 0.2, 0.45, 'triangle', 0.2);
        break;
      case 'nudge': // chocalho
        for (let i = 0; i < 9; i++) tone(i % 2 ? 180 : 140, i * 0.055, 0.07, 'square', 0.12);
        tone(523.3, 0.5, 0.3, 'triangle', 0.18);
        break;
      case 'sent':
        tone(1400, 0, 0.08, 'sine', 0.08);
        break;
    }
  } catch {
    /* sem áudio */
  }
}
