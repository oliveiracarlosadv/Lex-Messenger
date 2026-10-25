import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

// Política de segurança só no app final (no modo de desenvolvimento o Vite precisa de scripts embutidos).
const csp: Plugin = {
  name: 'lex-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'" />`,
    ),
};

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react(), tailwindcss(), csp],
  build: { outDir: '../../dist', emptyOutDir: true },
  server: { port: 5173, strictPort: true },
});
