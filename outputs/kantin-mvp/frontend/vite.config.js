import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Saat pengembangan, halaman dijalankan di port 5173 dan permintaan /api
// diteruskan ke server Flask di port 5000 (jalankan app.py terlebih dahulu).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
});
