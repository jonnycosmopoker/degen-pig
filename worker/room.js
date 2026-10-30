/* One online table: seats, the waiting room, the game itself, timers, computer stand-ins and the lobby listing.
   Platform-neutral: the Cloudflare Durable Object (worker/index.js) and the local test server (dev/server.mjs)
   both hand it sockets with send() and close(), plus a lobby and an account store. */
import { Engine, DEF_RULES, STYLE_NAMES } from '../shared/engine.js';

const ROLL_MS = 1700;        /* how long phones spend throwing the dice */
const BURN_MS = 2300;        /* extra time for the snake-eyes fire */
const BOT_MS = 950;          /* pause before a computer acts */
const BUST_PASS_MS = 2600;   /* a bust passes the dice on by itself after this */
const WAIT_GRACE_MS = 30000; /* a dropped phone keeps its waiting-room seat this long */
const GAME_GRACE_MS = 30000; /* mid-game, a dropped player gets this long to reconnect before a computer covers their seat */
const EMPTY_END_MS = 300000; /* a game with nobody connected closes after this */
const RESUME_MS = 25000;     /* after a server restart, players get this long to reconnect before a computer covers their seat */
const BEAT_MS = 60000;       /* tables check in with the lobby this often, so dead ones drop off the list */

const CHAT_KEEP = 60, CHAT_LEN = 200;
/* player ids stay on the server: each phone just learns which messages are its own */
const chatOut = (m, uid) => ({ id: m.id, name: m.name, seat: m.seat, text: m.text, at: m.at, me: m.uid === uid });
function clean(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n) }
export async function hashPw(code, pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('degenpig:' + code + ':' + pw));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
/* Track $ amounts: dollars and cents, 0 to 100,000; off when nothing is set */
function cleanMoney(m) {
  if (!m || typeof m !== 'object') return null;
  const v = x => { const n = Math.round(Number(x) * 100) / 100; return isFinite(n) && n > 0 ? Math.min(n, 100000) : 0 };
  const out = { game: v(m.game), point: v(m.point), golden: v(m.golden) };
  return out.game || out.point || out.golden ? out : null;
}
export function cleanRules(r) {
  r = r || {}; const t = [80, 100, 150, 200].includes(r.target) ? r.target : 100;
  return { target: t, golden: !!r.golden, noDbl: !!r.noDbl, reroll: !!r.reroll, verify: !!r.verify, power: !!r.power, triple: !!r.triple, money: cleanMoney(r.money), timer: [0, 15, 30, 60].includes(r.timer) ? r.timer : DEF_RULES.timer };
}

export class TableRoom {
  constructor(deps) {
    this.k = deps.speed || 1; this.verify = deps.verify; this.lobby = deps.lobby; this.storage = deps.storage || null; this.beat = null; this.accounts = deps.accounts; this.now = deps.now || (() => Date.now());
    this.meta = null; this.seats = []; this.conns = new Map(); this.G = null; this.E = null;
    this.timer = null; this.busyUntil = 0; this.deadline = 0; this.graces = new Map(); this.emptyTimer = null; this.votes = new Set();
    this.chat = []; this.chatSeq = 0;
  }

  /* ---- setup (called once when the table is created) ---- */
  async init(o) {
    if (this.meta) return { ok: false, error: 'exists' };
    this.meta = {
      code: o.code, name: clean(o.name, 24) || 'Degen Pig table', public: !o.private, pw: o.private ? await hashPw(o.code, o.password || '') : null,
      seats: Math.max(2, Math.min(6, o.seats | 0 || 4)), rules: cleanRules(o.rules), hostUid: clean(o.hostUid, 64), hostName: clean(o.hostName, 12) || 'Host',
      status: 'waiting', createdAt: this.now()
    };
    this.pushLobby(); this.lobby.event({ type: 'table' }).catch(() => { });
    this.startBeat(); this.persist();
    return { ok: true };
  }
  /* the local test server's stand-in for the old copy of a table disappearing when an update restarts it */
  dispose() { this.dead = true; [this.timer, this.resumeT, this.emptyTimer].forEach(t => t && clearTimeout(t)); if (this.beat) clearInterval(this.beat); this.graces.forEach(t => clearTimeout(t)) }
  startBeat() { if (!this.beat) this.beat = setInterval(() => { if (this.meta && this.meta.status !== 'ended') this.pushLobby() }, BEAT_MS) }

  /* ---- save and resume: the whole table is saved after every change, so a server restart (an update) picks up where it left off ---- */
  persist() {
    if (!this.storage || !this.meta || this.dead) return;
    let data;
    if (this.meta.status === 'ended') data = { meta: this.meta };
    else data = {
      meta: this.meta,
      seats: this.seats.map(s => ({ uid: s.uid, name: s.name, cpu: s.cpu || null, host: !!s.host })),
      G: this.G ? Object.assign({}, this.G, { players: this.G.players.map(p => { const q = Object.assign({}, p); delete q.acc; return q }) }) : null,
      votes: [...this.votes], busyLeft: Math.max(0, this.busyUntil - this.now()), chat: this.chat
    };
    this.storage.put('room', data).catch(() => { });
  }
  async restore(d) {
    if (!d || !d.meta) return;
    this.meta = d.meta;
    if (this.meta.status === 'ended') return;
    this.seats = (d.seats || []).map(s => Object.assign({}, s, { away: false, acc: s.cpu ? null : { v: {}, opp: {}, history: [] } }));
    await Promise.all(this.seats.filter(s => s.uid).map(s => this.loadAcc(s)));
    this.votes = new Set(d.votes || []); this.busyUntil = this.now() + (d.busyLeft || 0);
    this.chat = Array.isArray(d.chat) ? d.chat.slice(-CHAT_KEEP) : []; this.chatSeq = this.chat.length ? this.chat[this.chat.length - 1].id : 0;
    if (d.G) {
      this.G = d.G; this.E = Engine(this.G);
      this.G.players.forEach((p, i) => { const s = this.seats[i]; p.acc = s && !s.cpu ? s.acc : null; p.away = false });
    }
    this.startBeat(); this.pushLobby();
    /* nobody is connected yet: give everyone a moment to come back before a computer covers for them */
    const humans = this.seats.filter(s => s.uid);
    if (this.meta.status === 'waiting') {
      humans.forEach(s => { s.away = true; this.graces.set(s.uid, setTimeout(() => { this.graces.delete(s.uid); if (s.away && this.meta.status === 'waiting') this.dropSeat(s, 'left') }, WAIT_GRACE_MS)) });
    } else {
      this.resumeT = setTimeout(() => {
        this.resumeT = null; let changed = false;
        this.seats.forEach((s, i) => { if (s.uid && ![...this.conns.values()].some(c => c.uid === s.uid && !c.watch)) { s.away = true; if (this.G && this.G.players[i]) this.G.players[i].away = true; changed = true } });
        if (changed) { this.broadcast(); this.tick(); this.checkEmpty() }
      }, RESUME_MS);
      this.tick();
    }
  }

  /* ---- sockets ---- */
  onOpen(sock) { this.conns.set(sock, { uid: null }) }
  watchers() { let n = 0; for (const c of this.conns.values()) if (c.watch) n++; return n }
  onClose(sock) {
    if (this.dead) return;
    const c = this.conns.get(sock); this.conns.delete(sock); if (!c || !c.uid || !this.meta) return;
    if (c.watch) { if (this.meta.status === 'playing') this.broadcast(); return }
    if ([...this.conns.values()].some(x => x.uid === c.uid)) return;   /* still connected on another socket */
    const seat = this.seats.find(s => s.uid === c.uid); if (!seat) return;
    if (this.meta.status === 'waiting') {
      seat.away = true; this.broadcast();
      this.graces.set(c.uid, setTimeout(() => { this.graces.delete(c.uid); if (seat.away && this.meta.status === 'waiting') this.dropSeat(seat, 'left') }, WAIT_GRACE_MS));
    } else if (this.meta.status === 'playing') {
      /* hold the seat for 30 seconds; the game only waits if it's their turn */
      const i = this.seats.indexOf(seat), P = this.G && this.G.players[i];
      seat.rc = true; seat.rcUntil = this.now() + GAME_GRACE_MS * this.k; if (P) P.rc = true; this.pushLobby();
      const theirTurn = this.G && (this.G.phase === 'play' || this.G.phase === 'final') && this.G.cur === i;
      this.broadcast({ note: seat.name + ' disconnected. Waiting 30 seconds for them to reconnect' + (theirTurn ? ', so the game is paused.' : ' before a computer covers for them.') });
      this.tick();
      this.graces.set(c.uid, setTimeout(() => this.graceOver(seat), GAME_GRACE_MS * this.k));
      this.checkEmpty();
    }
  }
  /* 30 seconds passed without them coming back: a computer takes their seat until they return */
  graceOver(seat) {
    this.graces.delete(seat.uid);
    if (!seat.rc || this.meta.status !== 'playing') return;
    const i = this.seats.indexOf(seat), P = this.G && this.G.players[i];
    seat.rc = false; seat.away = true; if (P) { P.rc = false; P.away = true }
    this.pushLobby();
    this.broadcast({ note: seat.name + ' didn\u2019t make it back. A computer is playing for them until they return.' });
    this.tick();
    const S = this.G; if (S && S.phase === 'over') { const need = this.seats.filter(s => s.uid && !s.away && !s.rc).map(s => s.uid); if (need.length && need.every(u => this.votes.has(u))) { this.votes.clear(); S.fx = null; this.E.beginOrder(); this.after({ again: true }) } }
  }
  async onMessage(sock, raw) {
    let m; try { m = JSON.parse(raw) } catch (e) { return }
    if (!m || typeof m.t !== 'string') return;
    const c = this.conns.get(sock); if (!c) return;
    if (!this.meta) { this.send(sock, { t: 'error', fatal: true, msg: 'That table is no longer open.' }); return }
    if (this.meta.status === 'ended') { this.send(sock, { t: 'ended', reason: this.meta.endReason || 'This table has closed.' }); return }
    if (m.t === 'hello') return this.hello(sock, c, m);
    if (m.t === 'chat') return this.chatMsg(c, m);
    if (!c.uid || c.watch) return;
    const seatIdx = this.seats.findIndex(s => s.uid === c.uid); if (seatIdx < 0) return;
    switch (m.t) {
      case 'start': return this.hostStart(c.uid);
      case 'leave': return this.leave(seatIdx);
      case 'again': return this.voteAgain(c.uid);
      case 'roll': case 'lock': case 'reroll': case 'take': case 'pass': return this.act(seatIdx, m);
    }
  }
  send(sock, obj) { try { sock.send(JSON.stringify(obj)) } catch (e) { } }

  /* ---- table chat: players and watchers; the last few dozen messages are kept with the table ---- */
  chatMsg(c, m) {
    if (!c.uid) return;
    const text = String(m.text == null ? '' : m.text).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, CHAT_LEN); if (!text) return;
    const now = this.now(); c.chatT = (c.chatT || []).filter(t => now - t < 10000);
    if (c.chatT.length >= 6) return;          /* at most 6 messages in 10 seconds */
    c.chatT.push(now);
    const seat = c.watch ? -1 : this.seats.findIndex(s => s.uid === c.uid);
    const name = seat >= 0 ? this.seats[seat].name : (c.name || 'Watcher');
    const msg = { id: ++this.chatSeq, uid: c.uid, name, seat, text, at: now };
    this.chat.push(msg); if (this.chat.length > CHAT_KEEP) this.chat.splice(0, this.chat.length - CHAT_KEEP);
    for (const [sock, x] of this.conns) if (x.uid) this.send(sock, { t: 'chat', m: chatOut(msg, x.uid) });
    this.persist();
  }

  /* ---- joining ---- */
  async hello(sock, c, m) {
    /* who is this? the sign-in token is checked with Supabase; the id comes from there, never from the phone */
    const user = await this.verify(m.token).catch(() => null);
    if (!user || !user.id) return this.send(sock, { t: 'error', fatal: true, code: 'auth', msg: 'Please sign in again to join tables.' });
    const uid = user.id, name = clean(m.name, 12) || clean(user.name, 12).split(' ')[0] || 'Player';
    let seat = this.seats.find(s => s.uid === uid);
    /* spectators: watch a public game in progress; they see everything but can't act */
    if (m.watch && !seat) {
      if (this.meta.pw && uid !== this.meta.hostUid && (await hashPw(this.meta.code, String(m.pw || ''))) !== this.meta.pw) return this.send(sock, { t: 'error', fatal: true, code: 'password', msg: 'Wrong password for this table.' });
      if (this.meta.status !== 'playing' || !this.G) return this.send(sock, { t: 'error', fatal: true, msg: 'That game hasn\u2019t started yet. Join it from Open tables instead.' });
      if (this.watchers() >= 50) return this.send(sock, { t: 'error', fatal: true, msg: 'Too many people are already watching this game.' });
      c.uid = uid; c.watch = true; c.name = name; this.send(sock, { t: 'chatlog', list: this.chat.map(x => chatOut(x, uid)) }); this.broadcast(); return;
    }
    if (!seat) {
      if (this.meta.status !== 'waiting') return this.send(sock, { t: 'error', fatal: true, msg: 'This game has already started.' });
      if (this.meta.pw && uid !== this.meta.hostUid && (await hashPw(this.meta.code, String(m.pw || ''))) !== this.meta.pw) return this.send(sock, { t: 'error', fatal: true, code: 'password', msg: 'Wrong password for this table.' });
      if (this.seats.length >= this.meta.seats) return this.send(sock, { t: 'error', fatal: true, msg: 'This table is full.' });
      if (this.seats.some(s => s.name.toLowerCase() === name.toLowerCase())) { let k = 2; while (this.seats.some(s => s.name.toLowerCase() === (name + k).toLowerCase())) k++; seat = { name: name.slice(0, 10) + k } } else seat = { name };
      seat.uid = uid; seat.cpu = null; seat.away = false; seat.host = uid === this.meta.hostUid;
      if (seat.host) this.seats.unshift(seat); else this.seats.push(seat);
      seat.acc = { v: {}, opp: {}, history: [] }; this.loadAcc(seat);
    }
    c.uid = uid; seat.away = false; seat.rc = false; this.send(sock, { t: 'chatlog', list: this.chat.map(x => chatOut(x, uid)) });
    const g = this.graces.get(uid); if (g) { clearTimeout(g); this.graces.delete(uid) }
    if (this.emptyTimer) { clearTimeout(this.emptyTimer); this.emptyTimer = null }
    if (this.G) { const i = this.seats.indexOf(seat); if (this.G.players[i]) { this.G.players[i].away = false; this.G.players[i].rc = false } }
    this.pushLobby();
    if (this.meta.status === 'waiting' && this.seats.length >= this.meta.seats && this.seats.every(s => !s.away)) return this.startGame();
    this.broadcast(this.G ? { note: seat.name + ' is back.' } : null);
    if (this.G) this.tick();
  }
  async loadAcc(seat) {
    /* fill the seat's record in place, so a game that already started keeps writing to the same object */
    try { const r = await this.accounts.get(seat.uid); if (r && typeof r === 'object') Object.assign(seat.acc, r) } catch (e) { }
    if (!seat.acc.v) seat.acc.v = {}; if (!seat.acc.opp) seat.acc.opp = {}; if (!Array.isArray(seat.acc.history)) seat.acc.history = [];
    seat.acc.name = seat.name;
  }
  dropSeat(seat, why) {
    if (seat.host) return this.end(seat.name + ' closed the table.');
    this.seats.splice(this.seats.indexOf(seat), 1); this.pushLobby(); this.broadcast();
  }
  hostStart(uid) {
    if (this.meta.status !== 'waiting' || uid !== this.meta.hostUid) return;
    const styles = ['b', 'c', 'g'], used = {}; let k = 0;
    while (this.seats.length < this.meta.seats) {
      const st = styles[k++ % 3]; used[st] = (used[st] || 0) + 1;
      this.seats.push({ uid: null, name: STYLE_NAMES[st] + (used[st] > 1 ? ' ' + used[st] : ''), cpu: st, away: false, host: false });
    }
    this.startGame();
  }

  /* ---- the game ---- */
  startGame() {
    this.meta.status = 'playing'; this.pushLobby();
    const S = this.G = { rules: Object.assign({}, this.meta.rules), online: true };
    S.players = this.seats.map(s => ({ name: s.name, uid: s.uid, bot: s.cpu || null, host: !!s.host, away: !!s.away, acc: s.cpu ? null : s.acc }));
    this.E = Engine(S); this.E.newSession(); this.votes.clear();
    this.after({ start: true });
  }
  act(i, m) {
    const S = this.G; if (!S || (S.phase !== 'play' && S.phase !== 'final')) return;
    if (S.cur !== i || this.E.ctrl(i)) return;                   /* not your turn, or a computer is playing your seat */
    if (this.now() < this.busyUntil - 400 * this.k) return;               /* dice still rolling */
    S.fx = null; S.unlocks = [];
    let ev = null;
    if (m.t === 'roll') { const r = this.E.roll(); if (!r) return; ev = { roll: { a: r.a, b: r.b, dir: m.dir || null }, fx: r.fx } }
    else if (m.t === 'reroll') { const r = this.E.reroll(); if (!r) return; ev = { roll: { a: r.a, b: r.b, dir: null }, fx: r.fx } }
    else if (m.t === 'take') { const fx = this.E.takeBust(); if (!fx) return; ev = { fx } }
    else if (m.t === 'lock') { if (!this.E.lockIn()) return; ev = { fx: S.fx } }
    else if (m.t === 'pass') { if (!this.E.pass()) return; ev = { fx: S.fx } }
    this.after(ev);
  }
  after(ev) {
    const S = this.G; ev = ev || {}; S.watchers = this.watchers();
    if (ev.roll) this.busyUntil = this.now() + (ROLL_MS * this.k) + (ev.fx && ev.fx.burn > 0 ? (BURN_MS * this.k) : 0);
    else if (ev.fx && ev.fx.burn > 0) this.busyUntil = this.now() + (BURN_MS * this.k);
    if (S.fx && S.fx.hot) ev.hot = true; if (S.fx && S.fx.lock) ev.lock = S.fx.lock;
    if (S.unlocks && S.unlocks.length) { ev.unlocks = S.unlocks; S.unlocks = [] }
    if (S.phase === 'over' && !ev.over) { ev.over = true; this.saveGame() }
    this.broadcast(ev); this.tick();
  }
  /* decide what happens next on its own: a computer move, an automatic pass after a bust, or the turn timer */
  tick() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null } this.deadline = 0;
    const S = this.G; if (!S || this.meta.status !== 'playing' || (S.phase !== 'play' && S.phase !== 'final')) return;
    const wait = Math.max(0, this.busyUntil - this.now()), i = S.cur;
    if (this.E.ctrl(i)) { this.timer = setTimeout(() => this.botStep(), wait + (S.bust ? 1500 * this.k : (BOT_MS * this.k))); return }
    if (S.bust) { this.timer = setTimeout(() => { this.timer = null; S.fx = null; if (this.E.pass()) this.after({ fx: S.fx }) }, wait + (BUST_PASS_MS * this.k)); return }
    if (S.players[i].rc) {   /* paused: show everyone how long until a computer steps in */
      this.deadline = (this.seats[i] && this.seats[i].rcUntil) || 0;
      this.broadcastDeadline(); return }
    if (S.rules.timer === 0) { this.broadcastDeadline(); return }   /* No timer: wait as long as it takes */
    const ms = S.rules.timer * 1000 * this.k; this.deadline = this.now() + wait + ms;
    this.timer = setTimeout(() => { this.timer = null; S.fx = null; S.unlocks = []; const who = S.players[S.cur].name; if (this.E.timeout()) this.after({ fx: S.fx, note: who + ' ran out of time.' }) }, wait + ms);
    this.broadcastDeadline();
  }
  botStep() {
    this.timer = null; const S = this.G; if (!S || (S.phase !== 'play' && S.phase !== 'final') || !this.E.ctrl(S.cur)) return this.tick();
    S.fx = null; S.unlocks = [];
    const mv = this.E.botMove(); let ev = { fx: S.fx };
    if (mv.kind === 'roll' && mv.result) ev = { roll: { a: mv.result.a, b: mv.result.b, dir: null }, fx: mv.result.fx };
    else if (mv.kind === 'take') ev = { fx: mv.result };
    this.after(ev);
  }
  voteAgain(uid) {
    const S = this.G; if (!S || S.phase !== 'over' || this.meta.status !== 'playing') return;
    this.votes.add(uid);
    const need = this.seats.filter(s => s.uid && !s.away).map(s => s.uid);
    if (need.every(u => this.votes.has(u))) { this.votes.clear(); S.fx = null; this.E.beginOrder(); this.after({ again: true }) }
    else this.broadcast();
  }
  leave(i) {
    const seat = this.seats[i]; if (!seat) return;
    if (this.meta.status === 'waiting') return this.dropSeat(seat, 'left');
    this.end(seat.name + ' left the table, so the game is over.');
  }
  checkEmpty() {
    if (this.seats.some(s => s.uid && !s.away) || this.emptyTimer) return;
    this.emptyTimer = setTimeout(() => { this.emptyTimer = null; if (!this.seats.some(s => s.uid && !s.away)) this.end('Everyone disconnected.') }, EMPTY_END_MS);
  }
  /* One history entry per table session: it opens with the first game and is updated after every game,
     then marked closed when the table ends. Each entry holds the final standings for the whole session. */
  saveGame() {
    this.lobby.event({ type: 'game', humans: this.seats.filter(s => s.uid).length }).catch(() => { });
    /* leaderboards: wins, points banked and points lost at risk, for each signed-in player */
    const rec = this.G.records[this.G.records.length - 1];
    if (rec) {
      const rows = rec.players.filter(p => p.uid).map(p => ({ uid: p.uid, name: p.name, won: !!p.won, points: p.banked || 0, lost: p.lost || 0 }));
      /* Top Pig: whoever now leads this week's wins board (with at least 5 wins) earns it */
      if (rows.length) this.accounts.lbAdd(rows).then(top => {
        const i = this.seats.findIndex(s => s.uid && s.uid === top && s.acc); if (i < 0) return;
        const acc = this.seats[i].acc; if (acc.v.toppig) return; acc.v.toppig = 1;
        this.accounts.put(top, acc).catch(() => { }); this.sendUnlocks(this.seats[i].uid, [{ seat: i, id: 'toppig', lv: 1 }]);
      }).catch(() => { });
    }
    this.railbirds();
    this.pushLobby();
    return this.saveSession(false);
  }
  /* spectators who watched a game to the end earn toward Railbird */
  async railbirds() {
    const seen = new Set();
    for (const [sock, c] of this.conns) {
      if (!c.watch || !c.uid || seen.has(c.uid)) continue; seen.add(c.uid);
      try {
        const r = (await this.accounts.get(c.uid)) || { v: {}, opp: {}, history: [] }; r.v = r.v || {};
        const L = [1, 5, 25, 100], before = L.filter(x => (r.v.railbird || 0) >= x).length;
        r.v.railbird = (r.v.railbird || 0) + 1; await this.accounts.put(c.uid, r);
        const after = L.filter(x => r.v.railbird >= x).length;
        if (after > before) this.send(sock, { t: 'unlock', unlocks: [{ id: 'railbird', lv: after }] });
      } catch (e) { }
    }
  }
  sendUnlocks(uid, unlocks) { for (const [sock, c] of this.conns) if (c.uid === uid && !c.watch) this.send(sock, { t: 'unlock', unlocks }) }
  async saveSession(closed) {
    const S = this.G; if (!S || !S.games) return;
    const m = this.meta, sid = m.code + ':' + m.createdAt, gd = !!S.rules.golden;
    const totals = S.players.map((p, i) => ({
      name: p.name, cpu: !!p.bot,
      total: S.ledger.reduce((a, g) => a + (g.s[i] || 0), 0),
      golden: gd ? S.ledger.reduce((a, g) => a + ((g.g || [])[i] || 0), 0) : 0,
      wins: p.wins || 0
    }));
    const entry = { sid, table: m.name, code: m.code, start: m.createdAt, end: this.now(), games: S.games, rules: Object.assign({}, S.rules), closed: !!closed, reason: closed ? (m.endReason || '') : '', players: totals };
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i]; if (!s.uid || !s.acc) continue;
      const h = (s.acc.history || []).filter(x => x && x.sid && x.sid !== sid);
      h.unshift(Object.assign({ you: i }, entry)); s.acc.history = h.slice(0, 100);
      try { await this.accounts.put(s.uid, s.acc) } catch (e) { }
    }
  }
  end(reason) {
    if (!this.meta || this.meta.status === 'ended') return;
    this.meta.status = 'ended'; this.meta.endReason = reason;
    this.saveSession(true);
    if (this.beat) clearInterval(this.beat); this.beat = null; if (this.resumeT) clearTimeout(this.resumeT);
    this.persist();
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    this.graces.forEach(t => clearTimeout(t)); this.graces.clear();
    for (const [sock] of this.conns) this.send(sock, { t: 'ended', reason });
    this.lobby.remove(this.meta.code).catch(() => { });
    setTimeout(() => { for (const [sock] of this.conns) { try { sock.close(1000, 'ended') } catch (e) { } } }, 500);
  }

  /* ---- what phones see ---- */
  publicMeta() {
    const m = this.meta;
    return {
      code: m.code, name: m.name, public: m.public, locked: !!m.pw, seats: m.seats, rules: m.rules, status: m.status, hostName: m.hostName, watchers: this.watchers(),
      players: this.seats.map(s => ({ name: s.name, cpu: s.cpu || null, away: !!s.away, host: !!s.host, again: !!(s.uid && this.votes.has(s.uid)) }))
    };
  }
  snapshot() {
    const S = this.G; if (!S) return null;
    const o = {};
    for (const k in S) { if (k === 'players' || k === 'unlocks' || k === 'records') continue; o[k] = S[k] }
    o.players = S.players.map(p => { const q = {}; for (const k in p) if (k !== 'acc' && k !== 'uid') q[k] = p[k]; return q });
    return o;
  }
  broadcast(ev) {
    this.persist();
    const meta = this.publicMeta(), s = this.snapshot(), left = this.deadline ? Math.max(0, this.deadline - this.now()) : 0;
    for (const [sock, c] of this.conns) {
      if (!c.uid) continue;
      if (c.watch) { this.send(sock, { t: 'state', meta, s, ev: ev ? Object.assign({}, ev, { unlocks: [] }) : null, you: -1, left, host: false, watch: true }); continue }
      const you = this.seats.findIndex(x => x.uid === c.uid); if (you < 0) continue;
      let e = ev;
      if (ev && ev.unlocks) e = Object.assign({}, ev, { unlocks: ev.unlocks.filter(u => u.seat === you) });
      this.send(sock, { t: 'state', meta, s, ev: e || null, you, left, host: this.meta.hostUid === c.uid });
    }
  }
  broadcastDeadline() {
    const left = this.deadline ? Math.max(0, this.deadline - this.now()) : 0;
    for (const [sock, c] of this.conns) if (c.uid) this.send(sock, { t: 'timer', left, turnId: this.G ? this.G.turnId : 0 });
  }
  /* tell the lobby about this table: waiting tables are listed for players; playing ones only show on the owner's stats page */
  pushLobby() {
    const m = this.meta; if (!m) return;
    if (m.status === 'ended') { this.lobby.remove(m.code).catch(() => { }); return }
    const uids = [...new Set([...this.conns.values()].filter(c => !c.watch).map(c => c.uid).filter(Boolean))];
    this.lobby.update({
      code: m.code, name: m.name, locked: !!m.pw, seats: m.seats, filled: this.seats.length, host: m.hostName, rules: m.rules, at: m.createdAt,
      status: m.status, humans: this.seats.filter(s => s.uid).length, uids, games: this.G ? this.G.games || 0 : 0,
      names: this.seats.map(s => s.name + (s.cpu ? ' (CPU)' : ''))
    }).catch(() => { });
  }
}

export function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', u = new Uint8Array(6); crypto.getRandomValues(u);
  return [...u].map(x => A[x % A.length]).join('');
}
