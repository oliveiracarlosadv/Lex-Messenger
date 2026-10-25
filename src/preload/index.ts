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
  sendFiles: (chatId, paths, images) => invoke('send:files', chatId, paths, images),
  sendImageData: (chatId, dataUrl) => invoke('send:image', chatId, dataUrl),
  sendVoice: (chatId, ogg, duration, waveform) => invoke('send:voice', chatId, ogg, duration, waveform),
  mediaData: (chatId, msgId) => invoke('media:data', chatId, msgId),
  askMicrophone: () => invoke('mic:ask'),
  askCamera: () => invoke('camera:ask'),
  sendCaptured: (chatId, data, opts) => invoke('send:captured', chatId, data, opts),
  sendReply: (chatId, text, replyTo) => invoke('send:reply', chatId, text, replyTo),
  editMessage: (chatId, id, text) => invoke('msg:edit', chatId, id, text),
  deleteMessages: (chatId, ids, all) => invoke('msg:delete', chatId, ids, all),
  forwardMessages: (from, ids, to) => invoke('msg:forward', from, ids, to),
  react: (chatId, id, emoji) => invoke('msg:react', chatId, id, emoji),
  transcribe: (chatId, id) => invoke('msg:transcribe', chatId, id),
  setMuted: (chatId, muted) => invoke('chat:mute', chatId, muted),
  settings: () => invoke('settings:get'),
  setPrivacy: (key, value) => invoke('settings:privacy', key, value),
  endSession: (hash) => invoke('settings:end-session', hash),
  unblock: (id) => invoke('settings:block', id, false),
  block: (id) => invoke('settings:block', id, true),
  clearCache: () => invoke('settings:clear-cache'),
  openSettings: () => ipcRenderer.send('settings:open'),
  createGroup: (title, members) => invoke('group:create', title, members),
  setSelfDestruct: (chatId, s) => invoke('ttl:set', chatId, s),
  setFavorite: (chatId, fav) => invoke('fav:set', chatId, fav),
  stickerPanel: () => invoke('stk:panel'),
  stickerPack: (id) => invoke('stk:pack', id),
  searchGifs: (chatId, q) => invoke('stk:gifs', chatId, q),
  pickThumb: (key) => invoke('stk:thumb', key),
  sendPick: (chatId, key) => invoke('stk:send', chatId, key),
  getSelfDestruct: (chatId) => invoke('ttl:get', chatId),
  copyText: (text) => ipcRenderer.send('copy', text),
  pathForFile: (file) => webUtils.getPathForFile(file),
  typing: (chatId) => ipcRenderer.send('typing', chatId),
  markRead: (chatId) => ipcRenderer.send('mark-read', chatId),
  mediaPreview: (chatId, msgId) => invoke('media:preview', chatId, msgId),
  openMedia: (chatId, msgId) => invoke('media:open', chatId, msgId),
  saveMedia: (chatId, msgId) => invoke('media:save', chatId, msgId),
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
