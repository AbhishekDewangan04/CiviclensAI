import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'base44-api-mock',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/api/')) {
            res.setHeader('Content-Type', 'application/json');
            
            // App state / public settings mock
            if (req.url.includes('public-settings') || req.url.includes('app')) {
              return res.end(JSON.stringify({ id: 'civiclens', name: 'CiviCLens', status: 'active' }));
            }
            
            // Count queries mock
            if (req.url.includes('/count')) {
              return res.end(JSON.stringify({ count: 12 }));
            }
            
            // Analytics batch track mock
            if (req.url.includes('analytics/track')) {
              return res.end(JSON.stringify({ success: true }));
            }
            
            // Fallback mock array for entity lists (Reports, etc.)
            return res.end(JSON.stringify([]));
          }
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});