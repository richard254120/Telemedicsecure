import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: false
  },
  build: {
    // The production bundle used to be one 1.39 MB file (337 kB gzip) that every
    // station downloaded, including recharts, the forensics workbench and the
    // WebRTC call room. Route-level `lazy()` in App.tsx now emits a chunk per
    // station; these manual chunks keep the *shared* vendors stable so that
    // shipping a new dashboard build does not invalidate the framework cache.
    rollupOptions: {
      output: {
        // Object form only: listing an id that no module imports would throw, so
        // each group below is a dependency the client genuinely uses.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          icons: ['lucide-react'],
          realtime: ['socket.io-client'],
          charts: ['recharts'],
        },
      },
    },
  },
})
