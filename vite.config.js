import { defineConfig } from 'vite';

export default defineConfig({
  base: './',                              // relative addresses: the built site works from any folder of a host
  build: { chunkSizeWarningLimit: 700 },   // Three.js alone is about 500 kB
});
