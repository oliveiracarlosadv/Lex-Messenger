import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../shared/types';
import { lex } from '../lib/api';

// Tocador de mensagens de voz. "Ouvir em sequência" (mãos livres) toca o próximo áudio sozinho.

const players = new Map<string, { id: number; play: () => void }>();
let current: HTMLAudioElement | null = null;

export function getSequential() {
  try {
    return localStorage.getItem('lex-voice-seq') !== '0';
  } catch {
    return true;
  }
}
export function setSequential(on: boolean) {
  try {
    localStorage.setItem('lex-voice-seq', on ? '1' : '0');
  } catch {
    /* ignora */
  }
}

const SPEEDS = [1, 1.5, 2];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function VoicePlayer({ m, chatId }: { m: ChatMessage; chatId: string }) {
  const media = m.media!;
  const key = `${chatId}:${m.id}`;
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle');
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [transcript, setTranscript] = useState<{ text: string; pending: boolean; error?: boolean } | null>(null);

  useEffect(
    () =>
      lex.on('transcription', (t) => {
        if (t.chatId === chatId && t.id === m.id) setTranscript({ text: t.text, pending: t.pending });
      }),
    [chatId, m.id],
  );

  const transcribe = async () => {
    setTranscript({ text: '', pending: true });
    try {
      setTranscript(await lex.transcribe(chatId, m.id));
    } catch (e) {
      const msg = (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      setTranscript({ text: msg || 'Não foi possível transcrever.', pending: false, error: true });
    }
  };
  const duration = media.duration || audio.current?.duration || 0;
  const wave = media.waveform?.length ? media.waveform : new Array(48).fill(6);
  const bars = 48;
  const sampled = Array.from({ length: bars }, (_, i) => wave[Math.floor((i * wave.length) / bars)] ?? 0);

  const play = async () => {
    if (!audio.current) {
      setState('loading');
      const url = await lex.mediaData(chatId, m.id).catch(() => null);
      if (!url) return setState('error');
      const a = new Audio(url);
      a.playbackRate = speed;
      a.ontimeupdate = () => setPos(a.currentTime);
      a.onpause = () => setState((s) => (s === 'playing' ? 'paused' : s));
      a.onended = () => {
        setState('idle');
        setPos(0);
        if (getSequential()) playNext(chatId, m.id);
      };
      audio.current = a;
    }
    if (current && current !== audio.current) current.pause();
    current = audio.current;
    await audio.current.play().catch(() => setState('error'));
    setState('playing');
  };

  useEffect(() => {
    players.set(key, { id: m.id, play: () => void play() });
    return () => {
      players.delete(key);
      audio.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const toggle = () => {
    if (state === 'playing') audio.current?.pause();
    else void play();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audio.current || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    audio.current.currentTime = ((e.clientX - r.left) / r.width) * duration;
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  const progress = duration ? pos / duration : 0;
  return (
    <div className="voice-wrap">
    <div className={`voice ${m.out ? 'out' : ''}`}>
      <button className="voice-play" onClick={toggle} aria-label={state === 'playing' ? 'Pausar áudio' : 'Tocar áudio'}>
        {state === 'loading' ? '…' : state === 'playing' ? '❚❚' : '▶'}
      </button>
      <div className="voice-wave" onClick={seek} role="slider" aria-label="Posição do áudio" aria-valuenow={Math.round(pos)}>
        {sampled.map((v, i) => (
          <span key={i} className={i / bars < progress ? 'on' : ''} style={{ height: `${18 + (v / 31) * 82}%` }} />
        ))}
      </div>
      <span className="voice-time">{state === 'idle' ? fmt(duration) : fmt(pos)}</span>
      <button className="voice-speed" onClick={cycleSpeed} title="Velocidade">
        {String(speed).replace('.', ',')}x
      </button>
      {state === 'error' && <span className="voice-error">não foi possível tocar</span>}
      {media.kind === 'voice' && !transcript && (
        <button className="voice-speed" onClick={() => void transcribe()} title="Transcrever o áudio em texto (Telegram Premium)">
          Aa
        </button>
      )}
    </div>
    {transcript && (
      <div className={`transcript ${transcript.error ? 'error' : ''}`}>
        {transcript.pending && !transcript.text ? 'Transcrevendo…' : transcript.text}
        {transcript.pending && transcript.text && ' …'}
      </div>
    )}
    </div>
  );
}

/** Mãos livres: ao terminar um áudio, toca o próximo áudio da mesma conversa. */
function playNext(chatId: string, afterId: number) {
  const next = [...players.entries()]
    .filter(([k, p]) => k.startsWith(`${chatId}:`) && p.id > afterId)
    .sort((a, b) => a[1].id - b[1].id)[0];
  next?.[1].play();
}
