// Gravação de mensagens de voz.
// O navegador grava em WebM/Opus; o Telegram espera Ogg/Opus. Aqui o áudio é só "trocado de caixa"
// (os pacotes Opus são os mesmos), sem recompressão e sem perda.

export interface VoiceResult {
  ogg: Uint8Array;
  duration: number;
  /** 100 valores de 0 a 31: a "onda" que o Telegram mostra. */
  waveform: number[];
}

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levels: number[] = [];
  private timer = 0;
  private startedAt = 0;
  /** Nível atual (0 a 1), para a animação durante a gravação. */
  level = 0;

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.ctx.createMediaStreamSource(this.stream).connect(this.analyser);
    const buf = new Float32Array(this.analyser.fftSize);
    this.timer = window.setInterval(() => {
      this.analyser!.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      this.level = Math.min(1, rms * 4);
      this.levels.push(rms);
    }, 50);
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
    this.recorder = new MediaRecorder(this.stream, { mimeType: mime, audioBitsPerSecond: 32000 });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start(250);
    this.startedAt = performance.now();
  }

  get elapsed() {
    return this.startedAt ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  private cleanup() {
    window.clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
  }

  cancel() {
    try {
      this.recorder?.stop();
    } catch {
      /* já parado */
    }
    this.cleanup();
  }

  async stop(): Promise<VoiceResult | null> {
    const rec = this.recorder;
    if (!rec) return null;
    const done = new Promise<void>((r) => (rec.onstop = () => r()));
    rec.stop();
    await done;
    this.cleanup();
    const duration = Math.max(1, Math.round(this.elapsed));
    const webm = new Uint8Array(await new Blob(this.chunks).arrayBuffer());
    const ogg = webmOpusToOgg(webm);
    return { ogg, duration, waveform: makeWaveform(this.levels) };
  }
}

/** Reduz os níveis gravados a 100 valores de 0 a 31. */
export function makeWaveform(levels: number[]): number[] {
  if (!levels.length) return new Array(100).fill(0);
  const out: number[] = [];
  for (let i = 0; i < 100; i++) {
    const a = Math.floor((i * levels.length) / 100);
    const b = Math.max(a + 1, Math.floor(((i + 1) * levels.length) / 100));
    let peak = 0;
    for (let j = a; j < b && j < levels.length; j++) peak = Math.max(peak, levels[j]);
    out.push(peak);
  }
  const max = Math.max(...out) || 1;
  return out.map((v) => Math.round((v / max) * 31));
}

// ---------- WebM (Matroska) → Ogg ----------

const MASTER = new Set([0x18538067, 0x1f43b675, 0x1654ae6b, 0xae, 0xa0, 0xe1]); // Segment, Cluster, Tracks, TrackEntry, BlockGroup, Audio
const ID_CODEC_PRIVATE = 0x63a2;
const ID_SIMPLE_BLOCK = 0xa3;
const ID_BLOCK = 0xa1;
const ID_CHANNELS = 0x9f;

function readVint(b: Uint8Array, pos: number, keepMarker: boolean): { value: number; len: number; unknown: boolean } {
  const first = b[pos];
  let len = 1;
  while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
  let value = keepMarker ? first : first & (0xff >> len);
  let allOnes = value === (0xff >> len);
  for (let i = 1; i < len; i++) {
    value = value * 256 + b[pos + i];
    if (b[pos + i] !== 0xff) allOnes = false;
  }
  return { value, len, unknown: !keepMarker && allOnes };
}

export function webmOpusToOgg(b: Uint8Array): Uint8Array {
  const packets: Uint8Array[] = [];
  let head: Uint8Array | null = null;
  let channels = 1;
  let pos = 0;
  while (pos < b.length - 2) {
    const id = readVint(b, pos, true);
    const size = readVint(b, pos + id.len, false);
    const dataStart = pos + id.len + size.len;
    if (MASTER.has(id.value)) {
      pos = dataStart; // entra no elemento (mesmo com tamanho desconhecido)
      continue;
    }
    const end = size.unknown ? b.length : Math.min(b.length, dataStart + size.value);
    if (id.value === ID_CODEC_PRIVATE) head = b.slice(dataStart, end);
    else if (id.value === ID_CHANNELS) channels = b[dataStart] || 1;
    else if (id.value === ID_SIMPLE_BLOCK || id.value === ID_BLOCK) {
      const track = readVint(b, dataStart, false);
      const frameStart = dataStart + track.len + 3; // trilha + tempo (2 bytes) + opções (1 byte)
      if (frameStart < end) packets.push(b.slice(frameStart, end));
    }
    pos = end;
  }
  if (!head || String.fromCharCode(...head.slice(0, 8)) !== 'OpusHead') head = opusHead(channels);
  return oggFromOpus(head, packets);
}

function opusHead(channels: number): Uint8Array {
  const h = new Uint8Array(19);
  h.set([...'OpusHead'].map((c) => c.charCodeAt(0)));
  const v = new DataView(h.buffer);
  h[8] = 1;
  h[9] = channels;
  v.setUint16(10, 312, true);
  v.setUint32(12, 48000, true);
  return h;
}

/** Quantas amostras (a 48 kHz) um pacote Opus representa, lendo o primeiro byte dele. */
function opusSamples(p: Uint8Array): number {
  if (!p.length) return 0;
  const toc = p[0];
  const config = toc >> 3;
  let ms: number;
  if (config < 12) ms = [10, 20, 40, 60][config % 4];
  else if (config < 16) ms = [10, 20][config % 2];
  else ms = [2.5, 5, 10, 20][config % 4];
  const code = toc & 3;
  const frames = code === 0 ? 1 : code === 3 ? p[1] & 0x3f : 2;
  return ms * 48 * frames;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    t[i] = r >>> 0;
  }
  return t;
})();

function oggPage(serial: number, seq: number, granule: bigint, type: number, packet: Uint8Array): Uint8Array {
  const segs: number[] = [];
  let n = packet.length;
  while (n >= 255) {
    segs.push(255);
    n -= 255;
  }
  segs.push(n);
  const page = new Uint8Array(27 + segs.length + packet.length);
  const v = new DataView(page.buffer);
  page.set([0x4f, 0x67, 0x67, 0x53]); // "OggS"
  page[5] = type;
  v.setBigInt64(6, granule, true);
  v.setUint32(14, serial, true);
  v.setUint32(18, seq, true);
  page[26] = segs.length;
  page.set(segs, 27);
  page.set(packet, 27 + segs.length);
  let crc = 0;
  for (const byte of page) crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ byte) & 0xff]) >>> 0;
  v.setUint32(22, crc, true);
  return page;
}

function oggFromOpus(head: Uint8Array, packets: Uint8Array[]): Uint8Array {
  const serial = (Math.random() * 0xffffffff) >>> 0;
  const vendor = new TextEncoder().encode('Lex Messenger');
  const tags = new Uint8Array(8 + 4 + vendor.length + 4);
  tags.set([...'OpusTags'].map((c) => c.charCodeAt(0)));
  new DataView(tags.buffer).setUint32(8, vendor.length, true);
  tags.set(vendor, 12);
  const pages: Uint8Array[] = [oggPage(serial, 0, 0n, 0x02, head), oggPage(serial, 1, 0n, 0, tags)];
  let granule = 0n;
  packets.forEach((p, i) => {
    granule += BigInt(opusSamples(p));
    pages.push(oggPage(serial, i + 2, granule, i === packets.length - 1 ? 0x04 : 0, p));
  });
  const out = new Uint8Array(pages.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of pages) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
