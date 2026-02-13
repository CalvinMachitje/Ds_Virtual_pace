// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// https://vite.dev/config/
export default defineConfig({
  // Server configuration
  server: {
    host: true,                    // Allows network access from phone/tablet on same Wi-Fi
    port: 5173,                    // Default Vite port (change if needed)
    open: true,                    // Auto-open browser on start (optional)

    // Proxy backend API calls to Flask during development (prevents CORS)
    proxy: {
      '/api': {
        target: 'http://localhost:5000',   // Your Flask dev server port
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  plugins: [
    react(),   // Fast React compiler using SWC
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
    sourcemap: true,             // Helpful for debugging production issues
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

  // Suppress harmless warnings
  esbuild: {
    logOverride: {
      'this-is-undefined-in-esm': 'silent',
    },
  },
})