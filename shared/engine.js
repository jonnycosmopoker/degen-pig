/* Degen Pig rules engine.
   Runs on the server for online tables: it rolls the dice, applies every rule and setting,
   plays computer seats, keeps the stats and graph history, and tracks achievements.
   The state object uses the same field names as the game page, so a phone can draw a snapshot directly. */

export const DEF_RULES = { target: 100, golden: true, noDbl: false, reroll: false, verify: false, power: true, triple: false, timer: 30 };

/* achievement thresholds (names and wording live in the page) */
const ACH = [
  ['hogwild','max',[50,75,100,150]],['greedy','max',[8,10,12,15]],['badbeat','max',[30,50,75,100]],
  ['doubledouble','one',1],['runninghot','one',2],['onfire','one',3],['doubleboxcars','one',3],
  ['suckout','max',[null,50,75,100]],['phoenix','max',[10,25,50,75]],['speedpig','min',[8,6,5,4]],
  ['rivered','one',1],['doubletrouble','one',1],['cleangame','one',2],['wire','one',2],['snakecharmer','one',3],
  ['degen','cnt',[25,100,500,1000]],['shark','cnt',[10,50,200,500]],['piggybank','cnt',[5000,25000,100000,250000]],
  ['diceroller','cnt',[1000,5000,25000,100000]],['seeingdouble','cnt',[100,500,1500,5000]],['bigturns','cnt',[10,50,200,500]],
  ['comeback','cnt',[5,25,75,200]],['hotstreak','max',[3,4,5,7]],['grinder','max',[3,7,30,100]],['goldenhoard','cnt',[250,1000,5000,25000]],
  ['secondchance','one',0],['powertrip','one',1],['verified','one',2],['goldenhog','one',2],
  ['homegame','cnt',[5,25,100,250]],
  ['marathon','max',[3,5,10,20]],['social','max',[5,15,50,100]],['clockwork','max',[2,4,12,52]],['headsup','cnt',[1,10,50,200]],['railbird','cnt',[1,5,25,100]],
  ['crowd','one',2],['nightowl','one',1],['toppig','one',3],['nemesis','max',[10,25,50,100]],['fulltable','cnt',[1,10,50,200]],
  ['tilted','max',[5,7,10,null]],['snakecollector','cnt',[25,100,250,500]],['burntbacon','cnt',[1000,10000,50000,100000]],['roughstart','one',0]
];
const ACHBY = {};
ACH.forEach(a => { ACHBY[a[0]] = { id: a[0], k: a[1], L: Array.isArray(a[2]) ? a[2] : null, t: Array.isArray(a[2]) ? null : a[2] } });
export function achLevel(id, rec) {
  const a = ACHBY[id], v = rec && rec.v ? rec.v[id] : null;
  if (a.k === 'one') return v ? 1 : 0;
  if (v == null) return 0;
  let n = 0; a.L.forEach((x, i) => { if (x != null && (a.k === 'min' ? v <= x : v >= x)) n = i + 1 });
  return n;
}

export function rint(n) { const u = new Uint32Array(1); crypto.getRandomValues(u); return u[0] % n }
export function d6() { return 1 + rint(6) }
/* Pacific time helpers for the online achievements */
function ptHour(now) { return +new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23' }).format(new Date(now)) }
export function ptWeek(now) { const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now)); const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
function dayStr(off, now) { const d = new Date(now); d.setUTCDate(d.getUTCDate() + (off || 0)); return d.toISOString().slice(0, 10) }

export const STYLE_NAMES = { c: 'Cal', b: 'Bea', g: 'Gus' };

/* Engine(S): every function below works on the state object S. */
export function Engine(S) {
  const P = i => S.players[i];
  const RL = () => S.rules;
  const say = (text, kind) => { S.callout = text ? { text, kind: kind || '' } : null };
  const golden = i => Math.max(0, P(i).score - RL().target);
  const regular = i => RL().golden ? Math.min(P(i).score, RL().target) : P(i).score;
  const points = (a, b, m) => (a === 1 || b === 1) ? 0 : (a + b) * (a === b && !RL().noDbl ? 2 : 1) * (m || 1);
  const barScore = () => Math.max.apply(null, S.players.map(p => p.score));
  const leaders = () => { const b = barScore(); return S.players.map((p, i) => p.score === b ? i : -1).filter(i => i >= 0) };
  const ctrl = i => P(i).bot || (P(i).away ? 'b' : null);   /* who decides for a seat: a computer style, or null for a person */

  /* ---- achievements: p.acc is the player's saved record, or null for computer seats ---- */
  function achSet(p, id, val, mode) {
    const r = p.acc; if (!r) return;
    const old = achLevel(id, r), cur = r.v[id];
    if (mode === 'add') r.v[id] = (cur || 0) + val;
    else if (mode === 'max') { if (cur == null || val > cur) r.v[id] = val }
    else if (mode === 'min') { if (cur == null || val < cur) r.v[id] = val }
    else r.v[id] = 1;
    const nw = achLevel(id, r);
    if (nw > old) (S.unlocks = S.unlocks || []).push({ seat: S.players.indexOf(p), id, lv: nw });
  }
  function achRoll(p, a, b) {
    if (!p.acc || !p.g) return; const g = p.g, one = a === 1 || b === 1, snake = a === 1 && b === 1 && !S.inReroll, pair = a === b && !one;
    achSet(p, 'diceroller', 1, 'add'); if (pair) achSet(p, 'seeingdouble', 1, 'add');
    if (snake) { achSet(p, 'snakecollector', 1, 'add'); if (!g.rolls) achSet(p, 'roughstart', 1) }
    g.rolls++;
    g.dbl = pair ? g.dbl + 1 : 0; if (g.dbl >= 2) achSet(p, 'doubledouble', 1); if (g.dbl >= 3) achSet(p, 'runninghot', 1); if (g.dbl >= 4) achSet(p, 'onfire', 1);
    g.six = (a === 6 && b === 6) ? g.six + 1 : 0; if (g.six >= 2) achSet(p, 'doubleboxcars', 1);
    if (RL().verify) { if (one || !S.mustRoll) g.forced = 0; else { g.forced++; if (g.forced >= 3) achSet(p, 'verified', 1) } }
  }
  function achBust(p, risk, burn, snake) {
    if (!p.g) return; const g = p.g; g.busts++; if (snake && burn > g.burnMax) g.burnMax = burn;
    if (!p.acc) return; const r = p.acc;
    if (risk > 0) achSet(p, 'badbeat', risk, 'max'); if (risk + burn > 0) achSet(p, 'burntbacon', risk + burn, 'add');
    if (snake && p.st && p.st.sn >= 2) achSet(p, 'doubletrouble', 1);
    r.bs = (r.bs || 0) + 1; achSet(p, 'tilted', r.bs, 'max');
  }
  function achLock(p, amt, rolls) {
    if (!p.acc) return; p.acc.bs = 0;
    achSet(p, 'hogwild', amt, 'max'); achSet(p, 'greedy', rolls, 'max'); achSet(p, 'piggybank', amt, 'add'); if (amt >= 50) achSet(p, 'bigturns', 1, 'add');
    if (S.rrUsed) achSet(p, 'secondchance', 1); if (S.powerTurn && amt >= 30) achSet(p, 'powertrip', 1);
  }
  function achRound() { S.players.forEach((p, i) => { if (!p.g) return; const mx = Math.max.apply(null, S.players.map((q, j) => j === i ? -1 : q.score)); if (p.score < mx) p.g.wireFail = true }) }
  function achGame(w) {
    const n = S.players.length, now = Date.now(), today = dayStr(0, now), yest = dayStr(-1, now);
    S.players.forEach((p, i) => {
      if (!p.acc || !p.g) return; const g = p.g, won = w.indexOf(i) >= 0, r = p.acc;
      achSet(p, 'degen', 1, 'add');
      if (S.online) {
        achSet(p, 'homegame', p.host ? 1 : 0, 'add'); if (n === 6 && S.players.filter(q => !q.bot).length === 6) achSet(p, 'fulltable', 1, 'add');
        achSet(p, 'marathon', S.games, 'max');                                     /* games in one sitting at this table */
        r.met = r.met || {}; S.players.forEach(q => { if (q !== p && !q.bot && q.uid) r.met[q.uid] = 1 }); achSet(p, 'social', Object.keys(r.met).length, 'max');
        const wk = ptWeek(now), lastWk = ptWeek(now - 7 * 86400000);              /* weeks in a row with an online game */
        if (r.wk !== wk) { r.wks = r.wk === lastWk ? (r.wks || 0) + 1 : 1; r.wk = wk; achSet(p, 'clockwork', r.wks, 'max') }
        if (ptHour(now) < 5) achSet(p, 'nightowl', 1);
        if (won && n === 2 && S.players.every(q => !q.bot)) achSet(p, 'headsup', 1, 'add');
        if (won && (S.watchers || 0) >= 3) achSet(p, 'crowd', 1);
      }
      if (r.day !== today) { r.ds = r.day === yest ? (r.ds || 0) + 1 : 1; r.day = today; achSet(p, 'grinder', r.ds, 'max') }
      if (RL().golden) { const gp = golden(i); if (gp > 0) achSet(p, 'goldenhoard', gp, 'add'); if (gp >= 50) achSet(p, 'goldenhog', 1) }
      if (n >= 3) { if (won) { r.ws = (r.ws || 0) + 1; achSet(p, 'hotstreak', r.ws, 'max') } else r.ws = 0 }
      if (!won) return;
      achSet(p, 'shark', 1, 'add');
      if (g.finalDef != null && g.finalDef > 0) { achSet(p, 'suckout', g.finalDef, 'max'); if (g.finalDef >= 50) achSet(p, 'comeback', 1, 'add') }
      if (g.burnMax > 0) achSet(p, 'phoenix', g.burnMax, 'max');
      achSet(p, 'speedpig', g.turns, 'min');
      if (S.trigger >= 0 && S.trigger !== i) achSet(p, 'rivered', 1);
      if (!g.busts) achSet(p, 'cleangame', 1);
      if (!g.wireFail) achSet(p, 'wire', 1);
      if (p.st && p.st.sn >= 2) achSet(p, 'snakecharmer', 1);
      S.players.forEach((q, j) => { if (j === i || q.bot || !q.uid || w.indexOf(j) >= 0) return; r.opp = r.opp || {}; r.opp[q.uid] = (r.opp[q.uid] || 0) + 1; achSet(p, 'nemesis', r.opp[q.uid], 'max') });
    });
  }

  /* ---- game flow ---- */
  function newSession() {
    S.games = 0; S.ledger = []; S.baseOrder = null; S.records = [];
    S.sess = S.players.map(() => ({ f: [0, 0, 0, 0, 0, 0], d: 0, lost: 0, rolls: 0 }));
    S.players.forEach(p => { p.wins = 0 });
    beginOrder();
  }
  function beginOrder() {
    S.order = []; S.pos = 0; S.turn = 0; S.rolls = []; S.bust = false; S.finalDone = false; S.queue = []; S.trigger = -1; S.n = S.players.length; S.finalMode = 'turn';
    S.players.forEach(p => { p.score = 0; p.hot = false; p.rr = RL().reroll ? 3 : 0; p.pw = 0; p.pwReady = false; p.g = { turns: 0, rolls: 0, busts: 0, burnMax: 0, finalDef: null, dbl: 0, six: 0, forced: 0, wireFail: false }; p.st = { f: [0, 0, 0, 0, 0, 0], d: 0, lost: 0, sn: 0 } });
    S.pend = null; S.inReroll = false; S.rrFail = false; S.hotTurn = false; S.hotX = 1; S.powerTurn = false; S.snake = false; S.mustRoll = false; S.winners = [];
    /* Game 1 draws a random seating order. Every later game keeps that order and moves the first turn one seat along. */
    let all; const G = S.games || 0;
    if (G > 0 && S.baseOrder && S.baseOrder.length === S.players.length) { const r = G % S.baseOrder.length; all = S.baseOrder.slice(r).concat(S.baseOrder.slice(0, r)) }
    else { all = S.players.map((_, i) => i); for (let k = all.length - 1; k > 0; k--) { const j = rint(k + 1), t = all[k]; all[k] = all[j]; all[j] = t } S.baseOrder = all.slice() }
    S.order = all; S.hist = S.players.map(() => []);
    S.phase = 'play'; S.cur = S.order[0]; S.marks = ['', '']; say(null); beginTurn();
    say((G > 0 ? 'Game ' + (G + 1) + ': ' : '') + P(S.order[0]).name + ' goes first');
  }
  function onDoubles(i) {
    if (RL().noDbl) return false;
    if (P(i).st && P(i).st.sn >= 2) return true;
    const mine = P(i).score, lead = Math.max.apply(null, S.players.map((q, j) => j === i ? -1 : q.score));
    if (mine === 0 && lead > 75) return true;
    return S.phase === 'final' && lead - mine > 75;
  }
  /* how many separate reasons this player's turn is doubled: Five Ones 2x, two snake eyes this game, far behind (at 0 with someone over 75, or 75+ back on the final turn).
     With Enable 3x on, two or more reasons at once make it a ×3 turn instead of ×2. */
  function hotReasons(i) {
    let n = S.powerTurn ? 1 : 0;
    if (RL().noDbl) return n;
    if (P(i).st && P(i).st.sn >= 2) n++;
    const mine = P(i).score, lead = Math.max.apply(null, S.players.map((q, j) => j === i ? -1 : q.score));
    if ((mine === 0 && lead > 75) || (S.phase === 'final' && lead - mine > 75)) n++;
    return n;
  }
  const MX = () => S.hotX || (S.hotTurn ? 2 : 1);
  function beginTurn() {
    const p = P(S.cur); S.pwFull = false; S.powerTurn = false; S.rrUsed = false;
    if (p.g) { p.g.turns++; p.g.dbl = 0; p.g.six = 0; p.g.forced = 0; if (S.phase === 'final' && p.g.finalDef == null) p.g.finalDef = barScore() - p.score }
    if (RL().power && p.pwReady) { p.pwReady = false; p.pw = 0; S.powerTurn = true }
    const why = hotReasons(S.cur); S.hotX = why === 0 ? 1 : (RL().triple && why >= 2 ? 3 : 2); S.hotTurn = S.hotX > 1;
    S.turnId = (S.turnId || 0) + 1;
    if (S.hotTurn) S.fx = { hot: true, x: S.hotX };
  }
  function nextPlayer() {
    S.turn = 0; S.rolls = []; S.bust = false; S.snake = false; S.pend = null; S.inReroll = false; S.rrFail = false; S.mustRoll = false; S.finalDone = false; S.marks = ['', '']; S.hotTurn = false; S.hotX = 1; say(null);
    if (S.phase === 'final') { S.queue.shift(); if (!S.queue.length) { endGame(); return } S.cur = S.queue[0] }
    else { S.pos = (S.pos + 1) % S.n; S.cur = S.order[S.pos]; if (S.pos === 0) achRound() }
    beginTurn();
  }
  function lockIn(force) {
    if (S.bust || S.pend || (S.mustRoll && !force) || S.turn <= 0 || (S.phase !== 'play' && S.phase !== 'final')) return false;
    const p = P(S.cur), amt = S.turn; p.score += amt; if (p.g) p.g.banked = (p.g.banked || 0) + amt; rec(S.cur, 'lock', amt, amt, S.rolls.length); achLock(p, amt, S.rolls.length);
    S.fx = { lock: amt };
    if (S.phase === 'play' && p.score >= RL().target) {
      S.trigger = S.cur; S.phase = 'final'; S.queue = [];
      for (let k = 1; k < S.n; k++) S.queue.push(S.order[(S.pos + k) % S.n]);
      S.cur = S.queue[0]; S.turn = 0; S.rolls = []; S.mustRoll = false; S.marks = ['', '']; S.hotTurn = false; S.hotX = 1; beginTurn();
      say(p.name + ' locked in ' + p.score + (RL().golden ? ' · ' + Math.max(0, p.score - RL().target) + ' golden' : ''), 'gold');
    } else { nextPlayer(); if (S.phase !== 'over') say(p.name + ' banked ' + amt) }
    S.fx.lock = amt;
    return true;
  }
  function rollText(a, b, pts, dbl, m) {
    if (dbl) return 'Doubles! ' + (a + b) + ' ×' + (2 * m) + ' = ' + pts;
    return m > 1 ? a + ' + ' + b + ' = ' + (a + b) + ', ×' + m + ' = ' + pts : a + ' + ' + b + ' = ' + pts;
  }
  function rollResult(a, b) {
    const one = (a === 1 || b === 1), snake = (a === 1 && b === 1), pair = (a === b && !one), dbl = pair && !RL().noDbl;
    S.marks = one ? [a === 1 ? 'bust' : 'dim', b === 1 ? 'bust' : 'dim'] : dbl ? ['gold', 'gold'] : ['', ''];
    const p = P(S.cur), m = MX();
    if (p.st) { p.st.f[a - 1]++; p.st.f[b - 1]++; if (pair) p.st.d++ }
    achRoll(p, a, b);
    if (RL().power && one && !p.pwReady) { p.pw = Math.min(5, (p.pw || 0) + (a === 1) + (b === 1)); if (p.pw >= 5) { p.pwReady = true; S.pwFull = true } }
    if (S.inReroll) { S.inReroll = false; if (one) return applyBust(a, b, false, true) }
    else if (one && !snake && S.rolls.length === 0 && RL().reroll && (p.rr || 0) > 0) {
      S.pend = { a, b, snake }; say('ROLLED A 1', 'red'); return { bust: true, pend: true } }
    if (one) return applyBust(a, b, snake, false);
    const pts = points(a, b, m); S.turn += pts; S.rolls.push({ a, b, pts, dbl, m });
    S.mustRoll = !!RL().verify && pair; say(rollText(a, b, pts, dbl, m), (dbl || m > 1) ? 'gold' : '');
    return { dbl };
  }
  function applyBust(a, b, snake, fromReroll) {
    const p = P(S.cur); let burn = 0; const zero = snake || !!fromReroll;
    if (p.st) { p.st.lost += S.turn; if (snake) p.st.sn = (p.st.sn || 0) + 1 }
    if (zero) { burn = p.score; p.score = 0 }
    achBust(p, S.turn, burn, snake);
    S.rolls.forEach(r => { r.x = true }); S.rolls.push({ a, b, pts: 0, bust: true, m: 1 });
    S.lost = S.turn; S.lostBank = burn; S.snake = snake; S.rrFail = !!fromReroll;
    rec(S.cur, fromReroll ? 'zero' : snake ? 'snake' : 'bust', zero ? burn : S.turn, S.turn, S.rolls.length); S.turn = 0; S.bust = true;
    say(fromReroll ? 'RE-ROLL BUST' : snake ? 'SNAKE EYES' : 'BUST', 'red');
    return { bust: true, snake, burn };
  }
  function rec(i, ev, amt, risk, rolls) { if (!S.hist || !S.hist[i]) return; S.hist[i].push({ s: P(i).score, ev, amt, risk: risk || 0, rolls: rolls || 0, hot: S.hotTurn ? MX() : 0 }) }
  function endGame() {
    const w = leaders();
    if (S.hist) { const R = Math.max.apply(null, S.hist.map(h => h.length)); S.hist.forEach((h, i) => { while (h.length < R) h.push({ s: P(i).score, ev: 'pad', amt: 0, hot: false }) }) }
    w.forEach(i => { P(i).wins = (P(i).wins || 0) + 1 }); S.games = (S.games || 0) + 1;
    S.players.forEach((p, i) => { const a = S.sess[i], st = p.st; if (!a || !st) return; st.f.forEach((v, k) => { a.f[k] += v }); a.d += st.d; a.lost += st.lost; a.rolls += st.f.reduce((x, y) => x + y, 0) / 2 });
    S.ledger.push({ s: S.players.map((_, i) => regular(i)), g: S.players.map((_, i) => golden(i)), w: w.slice() });
    achGame(w);
    S.records.push({
      at: Date.now(), game: S.games, rules: Object.assign({}, RL()),
      players: S.players.map((p, i) => ({ uid: p.uid || null, name: p.name, cpu: !!p.bot, score: p.score, banked: (p.g && p.g.banked) || 0, regular: regular(i), golden: golden(i), won: w.indexOf(i) >= 0, rolls: p.st.f.reduce((x, y) => x + y, 0) / 2, doubles: p.st.d, lost: p.st.lost }))
    });
    S.phase = 'over'; S.winners = w; S.hotTurn = false; S.hotX = 1; S.marks = ['', '']; say(null);
  }

  /* ---- actions; each returns false when it is not allowed right now ---- */
  function canRoll() { if (S.pend) return false; if (S.phase === 'play' || S.phase === 'final') return !S.bust; return false }
  function roll() {
    if (!canRoll()) return null;
    const vals = [d6(), d6()]; S.dice = vals; S.fx = null;
    const fx = rollResult(vals[0], vals[1]) || {};
    return { a: vals[0], b: vals[1], fx };
  }
  function reroll() {
    const p = P(S.cur); if (!S.pend || !((p.rr || 0) > 0)) return null;
    p.rr--; S.rrUsed = true; S.rolls.push({ a: S.pend.a, b: S.pend.b, pts: 0, rr: true }); S.pend = null; S.inReroll = true;
    return roll();
  }
  function takeBust() { if (!S.pend) return null; const q = S.pend; S.pend = null; const fx = applyBust(q.a, q.b, q.snake, false); fx.quiet = true; return fx }
  function pass() { if (!(S.bust && (S.phase === 'play' || S.phase === 'final'))) return false; nextPlayer(); return true }
  /* turn timer ran out: bank whatever is on the table (even mid Verify Double), take a pending bust, or pass */
  function timeout() {
    if (S.phase !== 'play' && S.phase !== 'final') return false;
    if (S.pend) { takeBust(); nextPlayer(); return true }
    if (S.bust) { nextPlayer(); return true }
    if (S.turn > 0) return lockIn(true);
    nextPlayer(); return true;
  }

  /* ---- computer decisions ---- */
  function botDecide(i) {
    const p = P(i), B = p.score, Tn = S.turn, m = MX(), st = ctrl(i) || 'b', k = st === 'c' ? 0.75 : st === 'g' ? 1.35 : 1, margin = st === 'c' ? 6 : st === 'g' ? 20 : 12;
    if (Tn <= 0 || S.mustRoll) return 'roll';
    const maxO = Math.max.apply(null, S.players.filter((q, j) => j !== i).map(q => q.score));
    let thr = (240 * m - B) / 11 * k; const total = B + Tn;
    if (S.phase === 'final') {
      if (total <= maxO) return 'roll';
      const goal = maxO + 1 + (S.queue.length > 1 ? Math.round(margin / 2) : 0);
      return (total >= goal || Tn >= thr * 1.5) ? 'lock' : 'roll';
    }
    if (maxO > 85 && total < maxO - 25) thr *= 1.3;
    const TG = RL().target;
    if (total >= TG) return (total >= Math.max(TG, maxO + margin) || Tn >= thr * 1.5) ? 'lock' : 'roll';
    return Tn >= Math.max(thr, 6) ? 'lock' : 'roll';
  }
  function botReroll(i) {
    const p = P(i); if (S.phase === 'final' || p.score === 0) return true;
    const st = ctrl(i) || 'b', k = st === 'c' ? 1.3 : st === 'g' ? 0.75 : 1, m = MX();
    return 11 * p.score * k < 25 * 14 * m;
  }
  /* one computer move for the seat whose turn it is: returns {kind, result} */
  function botMove() {
    const i = S.cur;
    if (S.bust) { nextPlayer(); return { kind: 'pass' } }
    if (S.pend) { if (botReroll(i)) return { kind: 'roll', result: reroll() }; const fx = takeBust(); return { kind: 'take', result: fx } }
    if (botDecide(i) === 'lock') { lockIn(); return { kind: 'lock' } }
    return { kind: 'roll', result: roll() };
  }

  return { newSession, beginOrder, roll, reroll, takeBust, lockIn, pass, timeout, botMove, ctrl, golden, regular, leaders };
}
