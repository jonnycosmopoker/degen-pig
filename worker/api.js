/* The /api routes, shared by the Cloudflare Worker and the local dev server.
   d = { verify(token), lobby, accounts, createTable(body) -> code, admins: [emails], deleteSignin(user),
         pay: { on, test, open, invoices, origin, api } (the Shop's payments, see worker/pay.js) } */
import { quote, sessionParams, purchaseOf } from './pay.js';

export async function handleApi(d, method, path, token, body) {
  let user = null;
  if (token) user = await d.verify(token).catch(() => null);

  if (path === '/api/lobby') {
    if (user) await d.lobby.seen(user.id);
    return [200, { tables: await d.lobby.list(), live: await d.lobby.live(), counts: await d.lobby.counts() }];
  }
  if (path === '/api/leaderboard') {
    const period = ['week', 'month', 'all'].includes(body && body.period) ? body.period : 'week';
    return [200, await d.accounts.board(period, user ? user.id : null)];
  }
  /* is checkout live, in test mode, and is the Shop open to everyone yet */
  if (path === '/api/pay/config') {
    const P = d.pay || {};
    return [200, { on: !!P.on, test: !!P.test, open: !!P.open }];
  }
  if (!user) return [401, { error: path.startsWith('/api/pay/') ? 'Sign in to buy from the Shop.' : 'Please sign in.' }];
  const admin = (d.admins || []).includes(String(user.email || '').toLowerCase());

  if (path === '/api/me') {
    await d.lobby.seen(user.id);
    const t = await d.accounts.touch(user.id, user.email, user.name);
    if (t.created) await d.lobby.event({ type: 'signup' });
    return [200, { user: { id: user.id, email: user.email, name: user.name }, rec: t.rec, admin }];
  }
  if (path === '/api/claim' && method === 'POST') {
    return [200, { ok: true, moved: await d.accounts.claim(user.id, String((body && body.legacy) || '').slice(0, 64)) }];
  }
  if (path === '/api/ach' && method === 'POST') {
    const r = await d.accounts.achMerge(user.id, body);
    return r ? [200, { ok: true, rec: r }] : [400, { error: 'Bad request' }];
  }
  if (path === '/api/delete' && method === 'POST') {
    await d.accounts.del(user.id);
    const removed = d.deleteSignin ? await d.deleteSignin(user).catch(() => false) : false;
    return [200, { ok: true, signinRemoved: !!removed }];
  }
  if (path === '/api/tables' && method === 'POST') {
    if (!body) return [400, { error: 'Bad request' }];
    const code = await d.createTable(Object.assign({}, body, { hostUid: user.id }));
    return code ? [200, { code }] : [500, { error: 'Could not create the table' }];
  }
  /* open a Stripe Checkout page for a piece, a bundle or Any 3 Bundles, priced from what this player already owns */
  if (path === '/api/pay/checkout' && method === 'POST') {
    const P = d.pay || {};
    if (!P.on) return [503, { error: 'Checkout isn’t open yet.' }];
    if (!P.open && !admin) return [403, { error: 'The Shop isn’t open yet.' }];
    const rec = await d.accounts.get(user.id), q = quote((rec && rec.own) || {}, body);
    if (q.error) return [400, { error: q.error }];
    try { const s = await P.api.createSession(sessionParams(q, user, P.origin, P.invoices)); return [200, { url: s.url }] }
    catch (e) { return [502, { error: 'Couldn’t reach checkout. Please try again.' }] }
  }
  /* back from Stripe: hand over the items now (the webhook does the same, and a payment is only ever counted once) */
  if (path === '/api/pay/confirm' && method === 'POST') {
    const P = d.pay || {}, sid = String((body && body.sid) || '');
    if (!P.on || !/^cs_[A-Za-z0-9_]{6,200}$/.test(sid)) return [400, { error: 'Bad request' }];
    let s; try { s = await P.api.getSession(sid) } catch (e) { return [502, { error: 'Couldn’t check that payment. Your items will still arrive in a minute.' }] }
    const pu = purchaseOf(s);
    if (pu.uid !== user.id) return [403, { error: 'That purchase belongs to another account.' }];
    if (s.payment_status !== 'paid') return [200, { ok: false, pending: true }];
    const g = await d.accounts.grant(user.id, pu.keys, { ref: pu.ref, sid: pu.sid, amt: pu.amt });
    return [200, { ok: true, keys: pu.keys, own: g && g.own }];
  }
  if (path === '/api/admin') {
    if (!admin) return [403, { error: 'This page is only for the owner.' }];
    const a = await d.lobby.admin(), t = await d.accounts.top();
    return [200, Object.assign(a, { players: t.players, top: t.top })];
  }
  return [404, { error: 'Not found' }];
}
