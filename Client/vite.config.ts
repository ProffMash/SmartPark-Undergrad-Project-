import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Load .env from the repository root so the client and server share a single .env
  envDir: '../',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
