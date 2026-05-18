import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Enable code splitting
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/react-error-boundary')) {
            return 'vendor-ui';
          }
        },
      },
    },
    // Warn if any chunk exceeds 1000 KB
    chunkSizeWarningLimit: 1000,
    // Enable minification (esbuild is default and fastest)
    minify: 'esbuild',
    // Enable source maps for production debugging (lightweight)
    sourcemap: false,
    // CSS code splitting
    cssCodeSplit: true,
  },
})
