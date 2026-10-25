// Junta status, "Ausente" automático, música e mensagem pessoal, e mantém a bio do Telegram em dia.
import { powerMonitor } from 'electron';
import { composeBio, parseBio, type MyStatus } from '../shared/status';
import type { Me, PresenceInfo, Prefs } from '../shared/types';
import { formatTrack, MusicPermissionError, nowPlaying } from './music';
import type { TelegramService } from './telegram';

const IDLE_SECONDS = 10 * 60;
const MUSIC_POLL_MS = 15 * 1000;
/** Intervalo mínimo entre gravações da bio, para não esbarrar no limite do Telegram. */
const BIO_MIN_INTERVAL_MS = 20 * 1000;

export class PresenceManager {
  private idle = false;
  private music: string | null = null;
  private musicError: string | undefined;
  private timers: NodeJS.Timeout[] = [];
  private bioTimer: NodeJS.Timeout | null = null;
  private lastBioAt = 0;
  private active = false;

  constructor(
    private tg: TelegramService,
    private getPrefs: () => Prefs,
    private savePrefs: (p: Partial<Prefs>) => void,
    private emit: (info: PresenceInfo) => void,
  ) {}

  private listening = false;

  get effective(): MyStatus {
    const { status, autoAway } = this.getPrefs();
    return status === 'online' && autoAway && this.idle ? 'away' : status;
  }

  info(): PresenceInfo {
    const p = this.getPrefs();
    return { status: p.status, effective: this.effective, autoAway: this.idle && p.autoAway, music: this.music, musicError: this.musicError };
  }

  /** Chamado depois do login. */
  start(me: Me) {
    this.stop();
    this.active = true;
    if (!this.listening) {
      // powerMonitor só pode ser usado depois que o app terminou de abrir.
      this.listening = true;
      powerMonitor.on('lock-screen', () => this.setIdle(true));
      powerMonitor.on('unlock-screen', () => this.setIdle(false));
    }
    // A bio pode ter sido mudada pelo celular: ela manda na mensagem pessoal (a não ser que mostre música).
    const parsed = parseBio(me.about);
    if (!parsed.music) this.savePrefs({ personalMessage: parsed.text });
    this.timers.push(setInterval(() => this.checkIdle(), 30 * 1000));
    this.timers.push(setInterval(() => void this.pollMusic(), MUSIC_POLL_MS));
    void this.pollMusic();
    void this.apply();
  }

  /** Ao sair do app: tira status e música da bio, deixando só a mensagem pessoal. */
  async shutdown() {
    if (!this.active) return;
    this.stop();
    await this.tg.setBio(composeBio('online', this.getPrefs().personalMessage, null)).catch(() => {});
  }

  stop() {
    this.active = false;
    this.timers.forEach(clearInterval);
    this.timers = [];
    if (this.bioTimer) clearTimeout(this.bioTimer);
    this.bioTimer = null;
  }

  private checkIdle() {
    this.setIdle(powerMonitor.getSystemIdleTime() >= IDLE_SECONDS);
  }

  private setIdle(idle: boolean) {
    if (idle === this.idle) return;
    this.idle = idle;
    if (this.getPrefs().autoAway && this.getPrefs().status === 'online') void this.apply();
  }

  private async pollMusic() {
    const p = this.getPrefs();
    let music: string | null = null;
    let error: string | undefined;
    if (p.shareMusic && p.status !== 'invisible') {
      try {
        const t = await nowPlaying();
        music = t ? formatTrack(t) : null;
      } catch (e) {
        if (e instanceof MusicPermissionError)
          error = 'Permita o Lex Messenger em Ajustes do Sistema > Privacidade e Segurança > Automação.';
      }
    }
    if (music === this.music && error === this.musicError) return;
    this.music = music;
    this.musicError = error;
    void this.apply();
  }

  /** Atualiza tudo depois de uma mudança de preferência. */
  async refresh() {
    await this.pollMusic();
    await this.apply();
  }

  private async apply() {
    if (!this.active) return;
    this.emit(this.info());
    await this.tg.setAppearOffline(this.effective === 'invisible');
    this.scheduleBio();
  }

  private scheduleBio() {
    if (this.bioTimer) return;
    const wait = Math.max(0, this.lastBioAt + BIO_MIN_INTERVAL_MS - Date.now());
    this.bioTimer = setTimeout(async () => {
      this.bioTimer = null;
      if (!this.active) return;
      const bio = composeBio(this.effective, this.getPrefs().personalMessage, this.music);
      try {
        await this.tg.setBio(bio);
        this.lastBioAt = Date.now();
      } catch (e) {
        // Só tenta de novo se o Telegram pediu para esperar; outros erros não se repetem em ciclo.
        const secs = (e as { seconds?: number }).seconds;
        if (secs) {
          this.lastBioAt = Date.now() + secs * 1000;
          this.scheduleBio();
        } else console.error('Falha ao gravar a bio:', e);
      }
    }, wait);
  }
}
