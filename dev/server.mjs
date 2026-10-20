/* Local stand-in for Cloudflare, for testing without any installs:
   node dev/server.mjs [port]
   Serves /public, the same /api routes, and real websockets driving the same TableRoom code. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TableRoom, LobbyStore, newCode } from '../worker/room.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const port = +(process.argv[2] || 8787);
const lobbyStore = new LobbyStore(), accounts = new Map(), tables = new Map();
const lobby = { update: async t => lobbyStore.update(t), remove: async c => lobbyStore.remove(c) };
const accountsApi = { get: async uid => accounts.has(uid) ? JSON.parse(accounts.get(uid)) : null, put: async (uid, rec) => { accounts.set(uid, JSON.stringify(rec)) } };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
/* local sign-in stand-in: a token "dev-ace" is the user "ace" */
const devVerify = async t => (typeof t === 'string' && /^dev-[a-z0-9]{1,20}$/.test(t)) ? { id: 'sb:' + t.slice(4), sbid: t.slice(4), email: t.slice(4) + '@example.com', name: t.slice(4)[0].toUpperCase() + t.slice(5) + ' Tester' } : null;
const json = (res, o, s = 200) => { res.writeHead(s, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)) };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  if (p === '/api/lobby') return json(res, { tables: lobbyStore.list() });
  let body = ''; for await (const ch of req) body += ch;
  let user = null;
  if (p.startsWith('/api/')) { user = await devVerify((req.headers.authorization || '').replace(/^Bearer\s+/i, '')); if (!user) return json(res, { error: 'Please sign in.' }, 401) }
  if (p === '/api/me') return json(res, { user: { id: user.id, email: user.email, name: user.name }, rec: accounts.has(user.id) ? JSON.parse(accounts.get(user.id)) : null });
  if (p === '/api/delete' && req.method === 'POST') { accounts.delete(user.id); return json(res, { ok: true, signinRemoved: false }) }
  if (p === '/api/claim' && req.method === 'POST') { const b = JSON.parse(body || '{}'); if (b.legacy && accounts.has(b.legacy) && !accounts.has(user.id)) { accounts.set(user.id, accounts.get(b.legacy)); accounts.delete(b.legacy) } return json(res, { ok: true }) }
  if (p === '/api/tables' && req.method === 'POST') {
    let b; try { b = JSON.parse(body) } catch (e) { return json(res, { error: 'Bad request' }, 400) }
    b.hostUid = user.id;
    const code = newCode(), room = new TableRoom({ lobby, accounts: accountsApi, verify: devVerify, speed: +(process.env.DP_SPEED || 1) });
    tables.set(code, room); await room.init(Object.assign({}, b, { code }));
    return json(res, { code });
  }
  let f = path.normalize(path.join(root, p === '/' ? 'index.html' : decodeURIComponent(p)));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found') }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

/* a minimal websocket server: text frames, ping and close */
server.on('upgrade', (req, socket) => {
  const m = new URL(req.url, 'http://x').pathname.match(/^\/ws\/table\/([A-Z0-9]{6})$/);
  if (!m) { socket.destroy(); return }
  const room = tables.get(m[1]) || new TableRoom({ lobby, accounts: accountsApi, verify: devVerify });
  const key = req.headers['sec-websocket-key'];
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  let closed = false, buf = Buffer.alloc(0), frags = [];
  const frame = (op, data) => {
    const len = data.length; let head;
    if (len < 126) head = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2) }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2) }
    return Buffer.concat([head, data]);
  };
  const sock = {
    send: s => { if (!closed) socket.write(frame(1, Buffer.from(s))) },
    close: (code = 1000) => { if (closed) return; const b = Buffer.alloc(2); b.writeUInt16BE(code); socket.write(frame(8, b)); socket.end(); finish() }
  };
  const finish = () => { if (closed) return; closed = true; room.onClose(sock) };
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
