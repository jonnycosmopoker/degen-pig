/* Cloudflare Worker: serves the game page and routes the online parts.
   /api/lobby          GET   tables waiting for players
   /api/tables         POST  host a new table, returns its 6-letter code
   /ws/table/CODE      live connection to one table
   /api/me?uid=        a player's saved achievements and game history
   Everything else is the static site in /public. */
import { TableRoom, LobbyStore, newCode } from './room.js';

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const lobbyStub = env => env.LOBBY.get(env.LOBBY.idFromName('main'));
const accStub = env => env.ACCOUNTS.get(env.ACCOUNTS.idFromName('main'));

export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname;
    if (p === '/api/lobby') return lobbyStub(env).fetch('https://do/list');
    if (p === '/api/tables' && req.method === 'POST') {
      const b = await req.json().catch(() => null); if (!b) return J({ error: 'Bad request' }, 400);
      const code = newCode();
      const r = await env.TABLE.get(env.TABLE.idFromName(code)).fetch('https://do/init', { method: 'POST', body: JSON.stringify(Object.assign({}, b, { code })) });
      return r.ok ? J({ code }) : J({ error: 'Could not create the table' }, 500);
    }
    const m = p.match(/^\/ws\/table\/([A-Z0-9]{6})$/);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a websocket', { status: 426 });
      return env.TABLE.get(env.TABLE.idFromName(m[1])).fetch(req);
    }
    if (p === '/api/me') return accStub(env).fetch('https://do/get?uid=' + encodeURIComponent(url.searchParams.get('uid') || ''));
    return env.ASSETS.fetch(req);
  }
};

/* One Durable Object per table: holds the live game in memory while phones are connected. */
export class Table {
  constructor(state, env) {
    this.room = new TableRoom({
      lobby: {
        update: t => lobbyStub(env).fetch('https://do/update', { method: 'POST', body: JSON.stringify(t) }),
        remove: code => lobbyStub(env).fetch('https://do/remove', { method: 'POST', body: JSON.stringify({ code }) })
      },
      accounts: {
        get: async uid => { const r = await accStub(env).fetch('https://do/get?uid=' + encodeURIComponent(uid)); return r.ok ? r.json() : null },
        put: (uid, rec) => accStub(env).fetch('https://do/put', { method: 'POST', body: JSON.stringify({ uid, rec }) })
      }
    });
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/init') { const r = await this.room.init(await req.json()); return J(r, r.ok ? 200 : 409) }
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    server.accept();
    const sock = { send: s => server.send(s), close: (c, r) => server.close(c, r) };
    this.room.onOpen(sock);
    server.addEventListener('message', e => this.room.onMessage(sock, typeof e.data === 'string' ? e.data : ''));
    const gone = () => this.room.onClose(sock);
    server.addEventListener('close', gone); server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }
}

/* The lobby list, kept in storage so it survives the object going to sleep. */
export class Lobby {
  constructor(state) { this.storage = state.storage }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/update') { const t = await req.json(); t.seen = Date.now(); await this.storage.put('t:' + t.code, t); return J({ ok: true }) }
    if (url.pathname === '/remove') { const { code } = await req.json(); await this.storage.delete('t:' + code); return J({ ok: true }) }
    const all = await this.storage.list({ prefix: 't:' }), now = Date.now(), out = [];
    for (const [k, t] of all) { if (now - t.seen > 6 * 3600 * 1000) await this.storage.delete(k); else out.push(t) }
    out.sort((a, b) => b.at - a.at);
    return J({ tables: out.slice(0, 100) });
  }
}

/* Player records until sign-in accounts arrive: achievements, rivals and recent games, keyed by player id. */
export class Accounts {
  constructor(state) { this.storage = state.storage }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/put') { const { uid, rec } = await req.json(); if (uid) await this.storage.put('u:' + uid, rec); return J({ ok: true }) }
    const uid = url.searchParams.get('uid'); if (!uid) return J(null);
    return J((await this.storage.get('u:' + uid)) || null);
  }
}

export { LobbyStore };
