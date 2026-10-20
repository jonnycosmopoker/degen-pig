/* Storage-backed logic for the lobby, the stats counters and player accounts.
   The Durable Objects in worker/index.js hand these their storage; the local dev server hands them MemStorage.
   Storage API used: get(key), put(key, value), delete(key), list({ prefix }) -> Map. */

export class MemStorage {
  constructor() { this.m = new Map() }
  async get(k) { return this.m.has(k) ? JSON.parse(this.m.get(k)) : undefined }
  async put(k, v) { this.m.set(k, JSON.stringify(v)) }
  async delete(k) { this.m.delete(k) }
  async list(o) { const out = new Map(), p = (o && o.prefix) || ''; for (const [k, v] of this.m) if (k.startsWith(p)) out.set(k, JSON.parse(v)); return out }
}

/* days are counted in Pacific time, since that's where the game is run from */
/* leaderboard periods, Pacific time: weeks start on Monday */
export function weekKey(t) { const d = new Date(dayKey(t) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
export function monthKey(t) { return dayKey(t).slice(0, 7) }
export function dayKey(t) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)) }

const STALE_MS = 3 * 60 * 1000, ONLINE_MS = 60 * 1000;   /* live tables check in every minute; one silent for 3 minutes is gone */

/* The lobby list, plus the live and daily numbers for the owner's stats page. */
export class LobbyLogic {
  constructor(storage) { this.s = storage; this.presence = new Map() }
  /* a table reports itself whenever something changes; uids never leave the server */
  async update(t) { t.seen = Date.now(); await this.s.put('t:' + t.code, t) }
  async remove(code) { await this.s.delete('t:' + code) }
  async tables() {
    const all = await this.s.list({ prefix: 't:' }), now = Date.now(), out = [];
    for (const [k, t] of all) { if (now - t.seen > STALE_MS) await this.s.delete(k); else out.push(t) }
    return out.sort((a, b) => b.at - a.at);
  }
  async list() {
    return (await this.tables()).filter(t => (t.status || 'waiting') === 'waiting').slice(0, 100)
      .map(t => ({ code: t.code, name: t.name, locked: t.locked, seats: t.seats, filled: t.filled, host: t.host, rules: t.rules, at: t.at }));
  }
  /* public games in progress that lobby players can watch */
  async live() {
    return (await this.tables()).filter(t => t.status === 'playing' && !t.locked).slice(0, 50)
      .map(t => ({ code: t.code, name: t.name, host: t.host, players: t.names || [], games: t.games || 0, rules: t.rules, at: t.at }));
  }
  seen(uid) { if (uid) this.presence.set(uid, Date.now()) }
  /* for the lobby screen: people looking for a game (on Online Play, or seated at a table that hasn't started) and people playing */
  async counts() {
    const now = Date.now(), tables = await this.tables(), playing = new Set(), waiting = new Set();
    tables.forEach(t => (t.uids || []).forEach(u => ((t.status || 'waiting') === 'waiting' ? waiting : playing).add(u)));
    for (const [u, t] of this.presence) if (now - t <= 20000 && !playing.has(u)) waiting.add(u);
    return { lobby: waiting.size, playing: playing.size, tables: tables.filter(t => t.status === 'playing').length };
  }
  async event(e) {
    const k = 'd:' + dayKey(Date.now()), d = (await this.s.get(k)) || { games: 0, seats: 0, tables: 0, signups: 0 };
    const tot = (await this.s.get('tot')) || { games: 0, tables: 0, signups: 0 };
    if (e.type === 'game') { d.games++; d.seats += e.humans || 0; tot.games++ }
    else if (e.type === 'table') { d.tables++; tot.tables++ }
    else if (e.type === 'signup') { d.signups++; tot.signups++ }
    await this.s.put(k, d); await this.s.put('tot', tot);
  }
  async admin() {
    const now = Date.now(), tables = await this.tables(), online = new Set();
    for (const [u, t] of this.presence) { if (now - t > ONLINE_MS) this.presence.delete(u); else online.add(u) }
    const inTables = new Set();
    tables.forEach(t => (t.uids || []).forEach(u => { inTables.add(u); online.add(u) }));
    const days = [];
    for (let i = 29; i >= 0; i--) { const k = dayKey(now - i * 86400000); days.push(Object.assign({ d: k, games: 0, seats: 0, tables: 0, signups: 0 }, (await this.s.get('d:' + k)) || {})) }
    return {
      now: { online: online.size, inTables: inTables.size, browsing: online.size - inTables.size, playing: tables.filter(t => t.status === 'playing').length, waiting: tables.filter(t => (t.status || 'waiting') === 'waiting').length },
      tables: tables.map(t => ({ name: t.name, code: t.code, status: t.status || 'waiting', seats: t.seats, filled: t.filled, humans: t.humans != null ? t.humans : t.filled, connected: (t.uids || []).length, games: t.games || 0, host: t.host, locked: t.locked, rules: t.rules, at: t.at })),
      totals: (await this.s.get('tot')) || { games: 0, tables: 0, signups: 0 },
      days
    };
  }
}

/* Player records keyed by player id: achievements, rivals, table history, plus name/email and when they were last seen. */
export class AccountsLogic {
  constructor(storage) { this.s = storage }
  async get(uid) { return uid ? ((await this.s.get('u:' + uid)) || null) : null }
  async put(uid, rec) { if (uid) await this.s.put('u:' + uid, rec) }
  async del(uid) { if (uid) await this.s.delete('u:' + uid) }
  /* first sign-in on a phone that played before accounts existed: move that phone's record onto the account if the account is new */
  async claim(uid, legacy) {
    if (!uid || !legacy) return false;
    const old = await this.s.get('u:' + legacy), cur = await this.s.get('u:' + uid);
    if (old && (!cur || !(cur.history && cur.history.length) && !Object.keys(cur.v || {}).length)) {
      await this.s.put('u:' + uid, Object.assign({}, old, { created: (cur && cur.created) || Date.now(), email: cur && cur.email, gname: cur && cur.gname }));
      await this.s.delete('u:' + legacy); return true;
    }
    return false;
  }
  /* called when a signed-in player opens Online Play: creates the record on first visit (a new sign-up) and notes the visit */
  async touch(uid, email, gname) {
    let rec = await this.s.get('u:' + uid), created = false;
    if (!rec) { rec = { v: {}, opp: {}, history: [], created: Date.now() }; created = true }
    rec.email = email || rec.email || ''; rec.gname = gname || rec.gname || ''; rec.last = Date.now();
    await this.s.put('u:' + uid, rec);
    return { rec, created };
  }
  /* add one finished game's results to this week's, this month's and the all-time boards */
  async lbAdd(rows) {
    const now = Date.now();
    for (const k of ['lb:w:' + weekKey(now), 'lb:m:' + monthKey(now), 'lb:all']) {
      const b = (await this.s.get(k)) || {};
      rows.forEach(r => { const e = b[r.uid] || (b[r.uid] = { name: r.name, games: 0, wins: 0, points: 0, lost: 0 }); e.name = r.name; e.games++; if (r.won) e.wins++; e.points += r.points; e.lost += r.lost });
      await this.s.put(k, b);
    }
    return true;
  }
  async board(period, uid) {
    const now = Date.now(), key = period === 'week' ? 'lb:w:' + weekKey(now) : period === 'month' ? 'lb:m:' + monthKey(now) : 'lb:all';
    const b = (await this.s.get(key)) || {}, all = Object.keys(b).map(u => Object.assign({ me: u === uid }, b[u]));
    const top = (stat, tie) => {
      const sorted = all.filter(e => e[stat] > 0).sort((x, y) => y[stat] - x[stat] || y[tie] - x[tie] || x.name.localeCompare(y.name));
      const out = sorted.slice(0, 10).map((e, i) => ({ rank: i + 1, name: e.name, value: e[stat], games: e.games, me: e.me }));
      const mi = sorted.findIndex(e => e.me);
      if (mi >= 10) out.push({ rank: mi + 1, name: sorted[mi].name, value: sorted[mi][stat], games: sorted[mi].games, me: true });
      return out;
    };
    return { period, since: period === 'week' ? weekKey(now) : period === 'month' ? monthKey(now) : null, players: all.length,
      wins: top('wins', 'points'), points: top('points', 'wins'), lost: top('lost', 'games') };
  }
  async top() {
    const all = await this.s.list({ prefix: 'u:sb:' }), out = [];
    for (const [k, r] of all) {
      const H = (r.history || []).filter(h => h && h.sid);
      out.push({ name: r.name || r.gname || '', email: r.email || '', games: (r.v && r.v.degen) || 0, wins: (r.v && r.v.shark) || 0, points: (r.v && r.v.piggybank) || 0, tables: H.length, created: r.created || null, last: r.last || (H[0] && H[0].end) || null });
    }
    out.sort((a, b) => b.games - a.games || (b.last || 0) - (a.last || 0));
    return { players: out.length, top: out.slice(0, 50) };
  }
}
