import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',  // zagotovimo, da so vse poti relativne na to osnovno pot
  build: {
    outDir: 'dist',  // izhodna mapa
    emptyOutDir: true,  // praznimo mapo pred gradnjo
    sourcemap: false,  // onemogočimo sourcemap
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),  // glavni HTML vnos
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
        },
      },
    },
  },
  server: {
    port: 5173,  // lokalni strežnik na tem portu
    strictPort: true,  // ne bo poskusil uporabiti drugega porta
    host: true,  // omogočimo dostop iz vseh IP-jev, če razvijaš na več napravah
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),  // nastavitev aliasa za potke
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@mui/material', '@mui/icons-material'],
  },
});
