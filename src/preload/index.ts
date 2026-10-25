import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { LexApi, LexEvents } from '../shared/types';

declare const __APP_VERSION__: string;

const invoke = (ch: string, ...args: unknown[]) => ipcRenderer.invoke(ch, ...args);

const api: LexApi = {
  version: __APP_VERSION__,
  platform: process.platform,
  features: { music: process.platform === 'darwin' || process.platform === 'win32', mobile: false },
  on(event, cb) {
    const listener = (_e: unknown, data: LexEvents[typeof event]) => cb(data);
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  },
  authState: () => invoke('auth:state'),
  loginStart: (method) => invoke('login:start', method),
  loginAnswer: (value) => invoke('login:answer', value),
  loginCancel: () => invoke('login:cancel'),
  logout: () => invoke('logout'),
  me: () => invoke('me'),
  contacts: () => invoke('contacts'),
  contact: (id) => invoke('contact', id),
  avatar: (id) => invoke('avatar', id),
  history: (chatId, beforeId) => invoke('history', chatId, beforeId),
  sendText: (chatId, text) => invoke('send:text', chatId, text),
  sendNudge: (chatId) => invoke('send:nudge', chatId),
  sendFiles: (chatId, paths) => invoke('send:files', chatId, paths),
  sendImageData: (chatId, dataUrl) => invoke('send:image', chatId, dataUrl),
  pathForFile: (file) => webUtils.getPathForFile(file),
  typing: (chatId) => ipcRenderer.send('typing', chatId),
  markRead: (chatId) => ipcRenderer.send('mark-read', chatId),
  mediaPreview: (chatId, msgId) => invoke('media:preview', chatId, msgId),
  openMedia: (chatId, msgId) => invoke('media:open', chatId, msgId),
  revealMedia: (chatId, msgId) => invoke('media:reveal', chatId, msgId),
  openChat: (chatId) => ipcRenderer.send('open-chat', chatId),
  setStatus: (status) => invoke('status:set', status),
  setPersonalMessage: (text) => invoke('pm:set', text),
  setName: (first, last) => invoke('name:set', first, last),
  choosePhoto: () => invoke('photo:choose'),
  presence: () => invoke('presence'),
  refreshContact: (id) => ipcRenderer.send('contact:refresh', id),
  prefs: () => invoke('prefs'),
  setPrefs: (p) => invoke('prefs:set', p),
  shakeMe: () => ipcRenderer.send('shake-me'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
};

contextBridge.exposeInMainWorld('lex', api);
