import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// La ventana de ajustes se abre con file:// dentro de pywebview: rutas relativas
// y sin el atributo crossorigin (WebKit lo rechaza en file://).
const sinCrossorigin = (): Plugin => ({
  name: 'sin-crossorigin',
  transformIndexHtml: html => html.replace(/\s+crossorigin(="[^"]*")?/g, ''),
});

export default defineConfig({
  base: './',
  plugins: [react(), sinCrossorigin()],
  build: { outDir: 'dist', emptyOutDir: true, modulePreload: false, assetsInlineLimit: 0, target: 'safari15' },
});
