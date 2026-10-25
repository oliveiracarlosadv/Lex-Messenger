// Tipos mínimos do opus-recorder (usado só no iPhone, para gravar áudio em Ogg/Opus).
declare module 'opus-recorder' {
  export default class Recorder {
    constructor(config?: Record<string, unknown>);
    start(): Promise<void>;
    stop(): Promise<void>;
    ondataavailable: (buffer: ArrayBuffer) => void;
  }
}
