/* Cloudflare Worker: serves the game page and routes the online parts.
   /api/...            see worker/api.js (lobby, sign-in records, hosting, the owner's stats)
   /ws/table/CODE      live connection to one table
   Everything else is the static site in /public (the stats page is /admin.html). */
import { TableRoom, newCode } from './room.js';
import { LobbyLogic, AccountsLogic } from './store.js';
import { handleApi } from './api.js';

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

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

/* call a method on the single Lobby or Accounts object */
function rpc(ns) {
  const stub = ns.get(ns.idFromName('main'));
  return new Proxy({}, { get: (_, m) => (...args) => stub.fetch('https://do/rpc', { method: 'POST', body: JSON.stringify({ m, args }) }).then(r => r.json()).then(x => x.r) });
}
function deps(env) {
  return {
    verify: t => verifyToken(env, t),
    lobby: rpc(env.LOBBY),
    accounts: rpc(env.ACCOUNTS),
    admins: String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean),
    createTable: async b => {
      const code = newCode();
      const r = await env.TABLE.get(env.TABLE.idFromName(code)).fetch('https://do/init', { method: 'POST', body: JSON.stringify(Object.assign({}, b, { code })) });
      return r.ok ? code : null;
    },
    /* removing the sign-in itself needs the Supabase secret key, set as a Cloudflare secret named SUPABASE_SECRET */
    deleteSignin: async u => {
      if (!env.SUPABASE_SECRET) return false;
      const r = await fetch(env.SUPABASE_URL + '/auth/v1/admin/users/' + u.sbid, { method: 'DELETE', headers: { apikey: env.SUPABASE_SECRET, Authorization: 'Bearer ' + env.SUPABASE_SECRET } });
      return r.ok;
    }
  };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname;
    if (p.startsWith('/api/')) {
      const body = req.method === 'POST' ? await req.json().catch(() => null) : null;
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const [status, out] = await handleApi(deps(env), req.method, p, token, body);
      return J(out, status);
    }
    const m = p.match(/^\/ws\/table\/([A-Z0-9]{6})$/);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a websocket', { status: 426 });
      return env.TABLE.get(env.TABLE.idFromName(m[1])).fetch(req);
    }
    if (p === '/admin') return Response.redirect(url.origin + '/admin.html', 302);
    return env.ASSETS.fetch(req);
  }
};

/* One Durable Object per table: holds the live game in memory while phones are connected. */
export class Table {
  constructor(state, env) {
    const lobby = rpc(env.LOBBY), accounts = rpc(env.ACCOUNTS), st = state.storage;
    const storage = { get: k => st.get(k), put: (k, v) => st.put(k, v), delete: k => st.delete(k) };
    this.room = new TableRoom({ verify: token => verifyToken(env, token), lobby, accounts, storage });
    /* after an update restarts this table, load the saved game before anyone reconnects */
    state.blockConcurrencyWhile(async () => { const saved = await st.get('room'); if (saved) await this.room.restore(saved) });
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

/* The lobby list and the stats counters. */
const LOBBY_METHODS = ['update', 'remove', 'list', 'live', 'seen', 'event', 'admin', 'counts'];
export class Lobby {
  constructor(state) { this.L = new LobbyLogic(state.storage) }
  async fetch(req) {
    const { m, args } = await req.json();
    if (!LOBBY_METHODS.includes(m)) return J({ error: 'unknown' }, 400);
    return J({ r: await this.L[m](...(args || [])) });
  }
}

/* Player records: achievements, rivals and table history, keyed by player id. */
const ACC_METHODS = ['get', 'put', 'del', 'claim', 'touch', 'top'];
export class Accounts {
  constructor(state) { this.A = new AccountsLogic(state.storage) }
  async fetch(req) {
    const { m, args } = await req.json();
    if (!ACC_METHODS.includes(m)) return J({ error: 'unknown' }, 400);
    const r = await this.A[m](...(args || []));
    return J({ r: r === undefined ? null : r });
  }
}
