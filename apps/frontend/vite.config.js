import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const DB_FILE = path.resolve(__dirname, '.local-db.json');
const load = () => { try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return {}; } };
const save = (db) => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const readBody = (req) => new Promise((resolve) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
});
const matches = (item, q) =>
  Object.entries(q).every(([k, v]) => (v && typeof v === 'object' ? true : item[k] === v));

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'base44-api-mock',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url || !req.url.startsWith('/api/')) return next();
          res.setHeader('Content-Type', 'application/json');

          const url = new URL(req.url, 'http://localhost');
          const parts = url.pathname.split('/').filter(Boolean);
          const i = parts.indexOf('entities');

          // Entity routes: stateful, saved to .local-db.json
          if (i !== -1 && parts[i + 1]) {
            const entity = parts[i + 1];
            const sub = parts[i + 2];
            const db = load();
            db[entity] = db[entity] || [];
            let q = {};
            try { q = JSON.parse(url.searchParams.get('q') || '{}'); } catch {}

            if (req.method === 'POST' && !sub) {
              const body = await readBody(req);
              const now = new Date().toISOString();
              const item = { id: crypto.randomUUID(), created_date: now, updated_date: now, ...body };
              db[entity].unshift(item);
              save(db);
              return res.end(JSON.stringify(item));
            }
            if (req.method === 'GET' && sub === 'count') {
              return res.end(JSON.stringify({ count: db[entity].filter((r) => matches(r, q)).length }));
            }
            if (req.method === 'GET') {
              let items = db[entity].filter((r) => matches(r, q));
              const sort = url.searchParams.get('sort');
              if (sort) {
                const desc = sort.startsWith('-');
                const f = sort.replace(/^-/, '');
                items = [...items].sort((a, b) => (a[f] > b[f] ? 1 : -1) * (desc ? -1 : 1));
              }
              const limit = Number(url.searchParams.get('limit'));
              if (limit) items = items.slice(0, limit);
              return res.end(JSON.stringify(items));
            }
            if (req.method === 'PUT' && sub) {
              const body = await readBody(req);
              db[entity] = db[entity].map((r) => (r.id === sub ? { ...r, ...body, updated_date: new Date().toISOString() } : r));
              save(db);
              return res.end(JSON.stringify(db[entity].find((r) => r.id === sub) || {}));
            }
            if (req.method === 'DELETE' && sub) {
              db[entity] = db[entity].filter((r) => r.id !== sub);
              save(db);
              return res.end(JSON.stringify({ success: true }));
            }
          }

          // App settings / analytics mocks
          if (req.url.includes('analytics')) return res.end(JSON.stringify({ success: true }));
          if (req.url.includes('public-settings') || /\/apps\/[^/]+\/?$/.test(url.pathname)) {
            return res.end(JSON.stringify({ id: 'civiclens', name: 'CivicLens', status: 'active' }));
          }
          return res.end(JSON.stringify({ success: true }));
        });
      },
    },
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});