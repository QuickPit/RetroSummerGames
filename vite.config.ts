/// <reference types="vitest/config" />
import { configDefaults } from 'vitest/config';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative Pfade, damit das Spiel unter /<repo>/ auf GitHub Pages
  // und später im Docker-Container unter / gleichermaßen läuft.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  // Agenten-Worktrees unter .claude/ nicht mittesten
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
});
