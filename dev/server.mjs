/* Local stand-in for Cloudflare, for testing without any installs:
   node dev/server.mjs [port]
   Serves /public, the same /api routes (worker/api.js), and real websockets driving the same TableRoom code.
   Sign-in is faked: the token "dev-ace" is the user "ace" (email ace@example.com). ADMIN_EMAILS works as on Cloudflare. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TableRoom, newCode } from '../worker/room.js';
import { LobbyLogic, AccountsLogic, MemStorage } from '../worker/store.js';
import { handleApi } from '../worker/api.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const port = +(process.argv[2] || 8787), speed = +(process.env.DP_SPEED || 1);
const lobby = new LobbyLogic(new MemStorage()), accounts = new AccountsLogic(new MemStorage()), tables = new Map(), stores = new Map(), socks = new Set();
const verify = async t => (typeof t === 'string' && /^dev-[a-z0-9]{1,20}$/.test(t)) ? { id: 'sb:' + t.slice(4), sbid: t.slice(4), email: t.slice(4) + '@example.com', name: t.slice(4)[0].toUpperCase() + t.slice(5) + ' Tester' } : null;
const store = code => { if (!stores.has(code)) stores.set(code, new MemStorage()); return stores.get(code) };
const newRoom = code => new TableRoom({ lobby, accounts, verify, speed, storage: store(code) });
const deps = {
  verify, lobby, accounts, admins: String(process.env.ADMIN_EMAILS || 'ace@example.com').toLowerCase().split(','),
  createTable: async b => { const code = newCode(), room = newRoom(code); tables.set(code, room); await room.init(Object.assign({}, b, { code })); return code }
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  if (p.startsWith('/api/')) {
    let raw = ''; for await (const ch of req) raw += ch;
    let body = null; if (req.method === 'POST') { try { body = JSON.parse(raw) } catch (e) { body = null } }
    const [status, out] = await handleApi(deps, req.method, p, (req.headers.authorization || '').replace(/^Bearer\s+/i, ''), body);
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify(out));
  }
  if (p === '/admin') { res.writeHead(302, { location: '/admin.html' }); return res.end() }
  /* test hook: act like an update restarted every table (drop all connections, rebuild each table from its saved state) */
  if (p === '/dev/restart' && process.env.DP_DEV) {
    for (const [, r] of tables) r.dispose();
    for (const s of socks) s.destroy(); socks.clear();
    for (const [code] of tables) { const r = newRoom(code); const saved = await store(code).get('room'); if (saved) await r.restore(saved); tables.set(code, r) }
    res.writeHead(200); return res.end('restarted');
  }
  const f = path.normalize(path.join(root, p === '/' ? 'index.html' : decodeURIComponent(p)));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found') }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

/* a minimal websocket server: text frames, ping and close */
server.on('upgrade', (req, socket) => {
  const m = new URL(req.url, 'http://x').pathname.match(/^\/ws\/table\/([A-Z0-9]{6})$/);
  if (!m) { socket.destroy(); return }
  const room = tables.get(m[1]) || newRoom(m[1]);
  socks.add(socket); socket.on('close', () => socks.delete(socket));
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  let closed = false, buf = Buffer.alloc(0), frags = [];
  const frame = (op, data) => {
    const len = data.length; let head;
    if (len < 126) head = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2) }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2) }
    return Buffer.concat([head, data]);
  };
  const finish = () => { if (closed) return; closed = true; room.onClose(sock) };
  const sock = {
    send: s => { if (!closed) socket.write(frame(1, Buffer.from(s))) },
    close: (code = 1000) => { if (closed) return; const b = Buffer.alloc(2); b.writeUInt16BE(code); socket.write(frame(8, b)); socket.end(); finish() }
  };
  room.onOpen(sock);
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const fin = buf[0] & 0x80, op = buf[0] & 15, masked = buf[1] & 0x80; let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4 }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10 }
      const mk = masked ? buf.slice(off, off + 4) : null; if (masked) off += 4;
      if (buf.length < off + len) return;
      const data = Buffer.from(buf.slice(off, off + len)); if (mk) for (let i = 0; i < data.length; i++) data[i] ^= mk[i & 3];
      buf = buf.slice(off + len);
      if (op === 8) { sock.close(1000); return }
      if (op === 9) { socket.write(frame(10, data)); continue }
      if (op === 1 || op === 0) { frags.push(data); if (fin) { const text = Buffer.concat(frags).toString(); frags = []; room.onMessage(sock, text) } }
    }
  });
  socket.on('close', finish); socket.on('error', finish);
});

server.listen(port, () => console.log('Degen Pig dev server on http://localhost:' + port));
