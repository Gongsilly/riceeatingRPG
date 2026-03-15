import { defineConfig } from 'vite';
import { readFileSync  } from 'fs';
import { resolve       } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
  },
  plugins: [
    {
      // 로컬 개발 시 /api/* 요청을 JSON 파일로 서빙 (Cloudflare D1 목업)
      name: 'mock-d1-api',
      configureServer(server) {
        server.middlewares.use('/api/monsters', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(readFileSync(resolve(__dirname, 'src/assets/data/monsters.json')));
        });
        server.middlewares.use('/api/items', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(readFileSync(resolve(__dirname, 'src/assets/data/items.json')));
        });
      },
    },
  ],
});
