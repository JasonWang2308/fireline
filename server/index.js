// 火線交鋒 FIRELINE — game server
// Serves the client files over HTTP and runs the rooms over WebSocket on the same port.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Rooms } from './rooms.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end('bad request'); return; }
  if (url === '/healthz') { res.writeHead(200); res.end('ok'); return; }
  // the page uses relative paths so it also works from a sub-folder (e.g. GitHub Pages)
  if (url === '/' || url === '/index.html') { res.writeHead(302, { Location: '/client/' }); res.end(); return; }
  if (url === '/client' || url === '/client/') url = '/client/index.html';
  if (!url.startsWith('/client/') && !url.startsWith('/shared/')) { res.writeHead(404); res.end('not found'); return; }
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end('forbidden'); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
const rooms = new Rooms();
wss.on('connection', (ws, req) => rooms.connect(ws, req));

server.listen(PORT, () => {
  console.log(`火線交鋒 server running: http://localhost:${PORT}`);
});
