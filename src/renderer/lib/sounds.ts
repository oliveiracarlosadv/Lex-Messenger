// Sons próprios, gerados na hora (sem arquivos de áudio de terceiros).
// Timbre de "sininho" de vidro, no espírito dos mensageiros dos anos 2000.
import type { SoundName } from '../../shared/types';

let ctx: AudioContext | null = null;
let out: AudioNode | null = null;

/** Saída com um eco curto, para o som parecer mais "cheio". */
function output(): { c: AudioContext; dest: AudioNode } {
  if (!ctx) {
    ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.11;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    master.connect(ctx.destination);
    master.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(ctx.destination);
    out = master;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { c: ctx, dest: out! };
}

/** Sininho: síntese FM com brilho que some rápido e corpo que dura mais. */
function bell(freq: number, start: number, dur = 0.7, vol = 0.3) {
  const { c, dest } = output();
  const t = c.currentTime + start;

  const carrier = c.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.value = freq;

  const mod = c.createOscillator();
  mod.type = 'sine';
  mod.frequency.value = freq * 2;
  const modGain = c.createGain();
  modGain.gain.setValueAtTime(freq * 1.6, t);
  modGain.gain.exponentialRampToValueAtTime(freq * 0.05, t + dur * 0.5);
  mod.connect(modGain).connect(carrier.frequency);

  const shimmer = c.createOscillator();
  shimmer.type = 'sine';
  shimmer.frequency.value = freq * 3.01;
  const shimmerGain = c.createGain();
  shimmerGain.gain.setValueAtTime(0.0001, t);
  shimmerGain.gain.exponentialRampToValueAtTime(vol * 0.18, t + 0.008);
  shimmerGain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.35);

  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  env.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.12);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  carrier.connect(env).connect(dest);
  shimmer.connect(shimmerGain).connect(dest);
  for (const o of [carrier, mod, shimmer]) {
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

function buzz(freq: number, start: number, dur: number, vol: number) {
  const { c, dest } = output();
  const t = c.currentTime + start;
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.value = freq;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(filter).connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function playSound(name: SoundName) {
  try {
    switch (name) {
      case 'message': // "plim-PLIM", subindo
        bell(987.8, 0, 0.55, 0.26); // si
        bell(1318.5, 0.13, 0.8, 0.3); // mi
        break;
      case 'online': // escadinha suave subindo: "tu-ru-RIM"
        bell(659.3, 0, 0.45, 0.18);
        bell(880, 0.12, 0.45, 0.18);
        bell(1174.7, 0.24, 0.9, 0.22);
        break;
      case 'nudge': // chocalho + sininho
        for (let i = 0; i < 10; i++) buzz(i % 2 ? 150 : 115, i * 0.05, 0.06, 0.12);
        bell(784, 0.55, 0.6, 0.22);
        bell(1046.5, 0.65, 0.8, 0.22);
        break;
      case 'sent': // "tic" baixinho
        bell(1760, 0, 0.12, 0.06);
        break;
    }
  } catch {
    /* sem áudio */
  }
}
