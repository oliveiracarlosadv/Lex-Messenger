import type { LexApi } from '../../shared/types';

declare global {
  interface Window {
    lex: LexApi;
  }
}

export const lex = window.lex;
