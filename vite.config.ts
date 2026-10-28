import { defineConfig } from 'vite';

export default defineConfig({
  // Relative Pfade, damit das Spiel unter /<repo>/ auf GitHub Pages
  // und später im Docker-Container unter / gleichermaßen läuft.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
});
