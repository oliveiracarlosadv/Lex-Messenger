import { useEffect, useRef, useState } from 'react';
import type { CaptureOpts } from '../../shared/types';
import { lex } from '../lib/api';

type Mode = 'photo' | 'video' | 'round';
const ROUND_SIZE = 384;
const ROUND_MAX = 60;

/** Formato de gravação: MP4 (H.264) quando o sistema permite — é o que o Telegram toca em todo lugar. */
function videoMime(): { mime: string; ext: string; mp4: boolean } {
  for (const m of ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4']) {
    if (MediaRecorder.isTypeSupported(m)) return { mime: m, ext: 'mp4', mp4: true };
  }
  return { mime: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm', ext: 'webm', mp4: false };
}

interface Result {
  url: string;
  data: Uint8Array;
  opts: CaptureOpts;
}

/** Câmera dentro da conversa: foto, vídeo ou recado (vídeo redondo do Telegram). */
export function CameraDialog({ chatId, onClose, onError }: { chatId: string; onClose: () => void; onError: (t: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const roundCanvas = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef(0);
  const startedAt = useRef(0);
  const [mode, setMode] = useState<Mode>('photo');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [cams, setCams] = useState(1);
  const [recording, setRecording] = useState(false);
  const [, tick] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [sending, setSending] = useState(false);

  // Liga a câmera (e o microfone, para vídeo e recado).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!(await lex.askCamera())) {
        onError('Sem acesso à câmera. No Mac: Ajustes do Sistema > Privacidade e Segurança > Câmera.');
        return onClose();
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: mode !== 'photo' ? { echoCancellation: true, noiseSuppression: true } : false,
        });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) video.current.srcObject = s;
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCams(devices.filter((d) => d.kind === 'videoinput').length);
      } catch {
        onError('Não consegui abrir a câmera. Verifique a permissão de câmera do Lex Messenger.');
        onClose();
      }
    })();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, mode === 'photo']);

  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => {
      tick((n) => n + 1);
      if (mode === 'round' && (performance.now() - startedAt.current) / 1000 >= ROUND_MAX) stopRecording();
    }, 200);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, mode]);

  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );

  const takePhoto = async () => {
    const v = video.current!;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9));
    if (!blob) return;
    setResult({
      url: URL.createObjectURL(blob),
      data: new Uint8Array(await blob.arrayBuffer()),
      opts: { kind: 'photo', name: `foto-${Date.now()}.jpg`, width: c.width, height: c.height },
    });
  };

  const startRecording = () => {
    const s = stream.current;
    if (!s) return;
    let source = s;
    if (mode === 'round') {
      // Recado: recorta o centro da imagem num quadrado (o Telegram mostra redondo).
      const c = document.createElement('canvas');
      c.width = c.height = ROUND_SIZE;
      const ctx = c.getContext('2d')!;
      const draw = () => {
        const v = video.current!;
        const side = Math.min(v.videoWidth, v.videoHeight);
        if (side) ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, ROUND_SIZE, ROUND_SIZE);
        raf.current = requestAnimationFrame(draw);
      };
      draw();
      roundCanvas.current = c;
      source = new MediaStream([...c.captureStream(30).getVideoTracks(), ...s.getAudioTracks()]);
    }
    const { mime } = videoMime();
    const rec = new MediaRecorder(source, { mimeType: mime, videoBitsPerSecond: mode === 'round' ? 1_000_000 : 2_500_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      cancelAnimationFrame(raf.current);
      const { ext, mp4 } = videoMime();
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      const duration = (performance.now() - startedAt.current) / 1000;
      const v = video.current!;
      const round = mode === 'round' && mp4; // o Telegram só aceita recado redondo em MP4
      if (mode === 'round' && !mp4) onError('Este aparelho não grava MP4: o recado será enviado como vídeo comum.');
      setResult({
        url: URL.createObjectURL(blob),
        data: new Uint8Array(await blob.arrayBuffer()),
        opts: {
          kind: round ? 'round' : 'video',
          name: `${round ? 'recado' : 'video'}-${Date.now()}.${ext}`,
          duration,
          width: mode === 'round' ? ROUND_SIZE : v.videoWidth,
          height: mode === 'round' ? ROUND_SIZE : v.videoHeight,
        },
      });
    };
    rec.start(500);
    recorder.current = rec;
    startedAt.current = performance.now();
    setRecording(true);
  };

  const stopRecording = () => {
    setRecording(false);
    try {
      recorder.current?.stop();
    } catch {
      /* já parado */
    }
  };

  const shutter = () => {
    if (mode === 'photo') void takePhoto();
    else if (recording) stopRecording();
    else startRecording();
  };

  const send = async () => {
    if (!result) return;
    setSending(true);
    try {
      await lex.sendCaptured(chatId, result.data, result.opts);
      onClose();
    } catch {
      onError('Não foi possível enviar.');
      setSending(false);
    }
  };

  const secs = recording ? (performance.now() - startedAt.current) / 1000 : 0;
  const time = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
  const shape = mode === 'round' ? 'round' : '';

  return (
    <div className="camera-back" role="dialog" aria-label="Câmera">
      <div className="camera">
        <div className={`camera-view ${shape}`}>
          {result ? (
            result.opts.kind === 'photo' ? (
              <img src={result.url} alt="Foto tirada" />
            ) : (
              <video src={result.url} controls={result.opts.kind !== 'round'} autoPlay loop playsInline />
            )
          ) : (
            <video ref={video} autoPlay playsInline muted className={facing === 'user' ? 'mirror' : ''} />
          )}
          {recording && (
            <div className="camera-rec">
              <span className="rec-dot" /> {time}
              {mode === 'round' && ` / 1:00`}
            </div>
          )}
        </div>

        {result ? (
          <div className="camera-actions">
            <button className="btn" onClick={() => setResult(null)} disabled={sending}>
              ↺ Refazer
            </button>
            <button className="btn btn-primary" onClick={() => void send()} disabled={sending}>
              {sending ? 'Enviando…' : 'Enviar ➤'}
            </button>
          </div>
        ) : (
          <>
            {!recording && (
              <div className="camera-modes" role="tablist">
                {(
                  [
                    ['photo', '📷 Foto'],
                    ['video', '🎬 Vídeo'],
                    ['round', '⭕ Recado'],
                  ] as [Mode, string][]
                ).map(([m, label]) => (
                  <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="camera-actions">
              <button className="btn" onClick={onClose} disabled={recording}>
                Fechar
              </button>
              <button
                className={`shutter ${mode !== 'photo' ? 'video' : ''} ${recording ? 'on' : ''}`}
                onClick={shutter}
                aria-label={mode === 'photo' ? 'Tirar foto' : recording ? 'Parar de gravar' : 'Começar a gravar'}
              />
              <button
                className="btn"
                onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}
                disabled={cams < 2 || recording}
                title="Trocar de câmera"
              >
                🔄
              </button>
            </div>
            <p className="hint center">
              {mode === 'round' ? 'Recado: vídeo redondo de até 1 minuto, como um áudio com imagem.' : mode === 'video' ? 'Toque no botão vermelho para começar e para parar.' : 'Toque no botão para tirar a foto.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
