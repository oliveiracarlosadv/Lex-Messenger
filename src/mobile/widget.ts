// Widget "Online agora" (tela inicial do Android e do iPhone): grava a lista de quem está online
// para o widget mostrar. Com o app fechado, o widget fica com a última lista.
import { registerPlugin } from '@capacitor/core';
import type { TelegramService } from '../core/telegram';
import { STATUS } from '../shared/status';
import type { Contact } from '../shared/types';
import { LexNative } from './native';
import { isAndroid, isIOSApp } from './platform';

/** Plugin do app do iPhone (ios/App/App/LexWidgetPlugin.swift). */
const LexWidget = registerPlugin<{ update(o: { data: string }): Promise<void> }>('LexWidget', {
  web: { update: async () => {} },
  android: { update: async () => {} },
});

const MAX = 12;

export interface WidgetPerson {
  id: string;
  name: string;
  status: string;
  color: 'online' | 'away' | 'busy';
  photo?: string;
}

export function widgetPeople(contacts: Contact[]): Contact[] {
  return contacts
    .filter((c) => c.kind === 'user' && !c.blocked && (c.presence === 'online' || c.presence === 'away'))
    .sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || (a.presence === b.presence ? 0 : a.presence === 'online' ? -1 : 1) || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, MAX);
}

export class WidgetFeed {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private last = '';

  constructor(private tg: TelegramService) {}

  get enabled() {
    return isAndroid || isIOSApp;
  }

  /** Algo mudou na lista: atualiza o widget daqui a pouco (junta várias mudanças seguidas). */
  schedule() {
    if (!this.enabled || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.push();
    }, 3000);
  }

  async clear() {
    if (!this.enabled) return;
    this.last = '';
    await this.write({ updatedAt: Date.now(), people: [] });
  }

  private async push() {
    const chosen = widgetPeople(this.tg.listContacts());
    const people: WidgetPerson[] = await Promise.all(
      chosen.map(async (c) => {
        const s = c.status && c.status !== 'online' && c.status !== 'invisible' ? STATUS[c.status] : null;
        const color: WidgetPerson['color'] = s ? (s.color === 'busy' ? 'busy' : 'away') : c.presence === 'away' ? 'away' : 'online';
        const status = s ? s.label : c.presence === 'away' ? 'Ausente' : 'Online';
        const url = c.hasPhoto ? await this.tg.avatar(c.id).catch(() => null) : null;
        return { id: c.id, name: c.name, status, color, photo: url?.split(',')[1] };
      }),
    );
    const key = JSON.stringify(people.map((p) => [p.id, p.status, !!p.photo]));
    if (key === this.last) return;
    this.last = key;
    await this.write({ updatedAt: Date.now(), people });
  }

  private async write(payload: { updatedAt: number; people: WidgetPerson[] }) {
    const data = JSON.stringify(payload);
    if (isAndroid) await LexNative.updateWidget({ data }).catch(() => {});
    else if (isIOSApp) await LexWidget.update({ data }).catch(() => {});
  }
}
