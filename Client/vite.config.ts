// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// https://vite.dev/config/
export default defineConfig({
  // Load .env from monorepo root (one level up)
  envDir: path.resolve(__dirname, '..'),   // gig-connect/

  // Only load variables starting with VITE_
  envPrefix: ['VITE_'],

  server: {
    host: true,
    port: 5173,
    open: true,

    proxy: {
      // Proxy all /api requests to Flask backend on port 5000
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        // Do NOT remove /api prefix — Flask expects it
        rewrite: (path) => path,   // ← key fix: keep /api intact
      },

      // Proxy WebSocket (Socket.IO) if you use it
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },

  plugins: [
    react(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@context': path.resolve(__dirname, './src/context'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', '@supabase/supabase-js'],
          ui: [
            '@radix-ui/*',
            'class-variance-authority',
            'tailwind-merge',
            'lucide-react',
          ],
        },
      },
    },
  },

  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
    },
  },

  // Suppress some noisy warnings
  esbuild: {
    logOverride: {
      'this-is-undefined-in-esm': 'silent',
    },
  },
})