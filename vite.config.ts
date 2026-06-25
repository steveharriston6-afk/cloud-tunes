import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function removeConsolePlugin() {
  return {
    name: 'remove-console',
    transform(code: string, id: string) {
      if (id.includes('node_modules')) return null;
      if (!/\.(js|ts|jsx|tsx)$/.test(id)) return null;
      
      const removed = code
        .replace(/console\.(log|debug|info|dir)\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\);?/gi, '')
        .replace(/\bdebugger\b;?/g, '');
        
      return {
        code: removed,
        map: null
      };
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    removeConsolePlugin()
  ],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            return 'vendor-others';
          }
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
