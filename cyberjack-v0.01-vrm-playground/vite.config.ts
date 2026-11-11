import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  cacheDir: '.vite-vrm-cache',
  build: {copyPublicDir: false},
  server: {
    port: 5174,
    host: '127.0.0.1',
    strictPort: true,
    fs: {allow: ['.', '../cyberjack-v0.01']},
    open: false,
    proxy: {
      '/motion-lab': {target:'http://127.0.0.1:8782',changeOrigin:true,rewrite:path=>path.replace(/^\/motion-lab/,'')},
      '/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true
      }
    }
  }
});
