/* Cloudflare Worker: serves the game page and routes the online parts.
   /api/lobby          GET   tables waiting for players
   /api/tables         POST  host a new table, returns its 6-letter code
   /ws/table/CODE      live connection to one table
   /api/me?uid=        a player's saved achievements and game history
   Everything else is the static site in /public. */
import { TableRoom, LobbyStore, newCode } from './room.js';

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const lobbyStub = env => env.LOBBY.get(env.LOBBY.idFromName('main'));

/* Sign-in: the phone sends its Supabase access token; we ask Supabase who it belongs to (cached for 5 minutes). */
const VCACHE = new Map();
async function verifyToken(env, token) {
  if (!token || typeof token !== 'string' || token.length > 4000) return null;
  const hit = VCACHE.get(token); if (hit && hit.until > Date.now()) return hit.u;
  const r = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: env.SUPABASE_KEY, Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const j = await r.json(), md = j.user_metadata || {};
  const u = { id: 'sb:' + j.id, sbid: j.id, email: j.email || '', name: md.full_name || md.name || '' };
  if (VCACHE.size > 5000) VCACHE.clear();
  VCACHE.set(token, { u, until: Date.now() + 300000 }); return u;
}
const bearer = req => (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
const accStub = env => env.ACCOUNTS.get(env.ACCOUNTS.idFromName('main'));

export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname;
    if (p === '/api/lobby') return lobbyStub(env).fetch('https://do/list');
    if (p.startsWith('/api/') && p !== '/api/lobby') {
      var user = await verifyToken(env, bearer(req)).catch(() => null);
      if (!user) return J({ error: 'Please sign in.' }, 401);
    }
    if (p === '/api/me') {
      const r = await accStub(env).fetch('https://do/get?uid=' + encodeURIComponent(user.id));
      return J({ user: { id: user.id, email: user.email, name: user.name }, rec: await r.json() });
    }
    if (p === '/api/claim' && req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      return accStub(env).fetch('https://do/claim', { method: 'POST', body: JSON.stringify({ uid: user.id, legacy: String(b.legacy || '').slice(0, 64) }) });
    }
    if (p === '/api/delete' && req.method === 'POST') {
      await accStub(env).fetch('https://do/del', { method: 'POST', body: JSON.stringify({ uid: user.id }) });
      /* removing the sign-in itself needs the Supabase secret key, set as a Cloudflare secret named SUPABASE_SECRET */
      if (env.SUPABASE_SECRET) await fetch(env.SUPABASE_URL + '/auth/v1/admin/users/' + user.sbid, { method: 'DELETE', headers: { apikey: env.SUPABASE_SECRET, Authorization: 'Bearer ' + env.SUPABASE_SECRET } }).catch(() => { });
      return J({ ok: true, signinRemoved: !!env.SUPABASE_SECRET });
    }
    if (p === '/api/tables' && req.method === 'POST') {
      const b = await req.json().catch(() => null); if (!b) return J({ error: 'Bad request' }, 400);
      b.hostUid = user.id;
      const code = newCode();
      const r = await env.TABLE.get(env.TABLE.idFromName(code)).fetch('https://do/init', { method: 'POST', body: JSON.stringify(Object.assign({}, b, { code })) });
      return r.ok ? J({ code }) : J({ error: 'Could not create the table' }, 500);
    }
    const m = p.match(/^\/ws\/table\/([A-Z0-9]{6})$/);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a websocket', { status: 426 });
      return env.TABLE.get(env.TABLE.idFromName(m[1])).fetch(req);
    }
    return env.ASSETS.fetch(req);
  }
};

/* One Durable Object per table: holds the live game in memory while phones are connected. */
export class Table {
  constructor(state, env) {
    this.room = new TableRoom({
      verify: token => verifyToken(env, token),
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
    if (url.pathname === '/del') { const { uid } = await req.json(); if (uid) await this.storage.delete('u:' + uid); return J({ ok: true }) }
    /* first sign-in on a phone that played before accounts existed: move that phone's record onto the account if the account is new */
    if (url.pathname === '/claim') {
      const { uid, legacy } = await req.json(); if (!uid || !legacy) return J({ ok: false });
      const old = await this.storage.get('u:' + legacy), cur = await this.storage.get('u:' + uid);
      if (old && (!cur || !(cur.history && cur.history.length) && !Object.keys(cur.v || {}).length)) { await this.storage.put('u:' + uid, old); await this.storage.delete('u:' + legacy); return J({ ok: true, moved: true }) }
      return J({ ok: true, moved: false });
    }
    const uid = url.searchParams.get('uid'); if (!uid) return J(null);
    return J((await this.storage.get('u:' + uid)) || null);
  }
}

export { LobbyStore };
