/* The Shop's payment logic: prices, Stripe's webhook signature, handing items over and taking them back.
   node test/pay.mjs */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { BUNDLES, bundleParts, quote, sessionParams, verifySig, onEvent } from '../worker/pay.js';
import { AccountsLogic, MemStorage } from '../worker/store.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m) } };

/* prices */
ok(quote({}, { kind: 'piece', key: 'd:magma' }).amount === 599, 'ultra premium dice $5.99');
ok(quote({}, { kind: 'piece', key: 't:seven' }).amount === 199, 'regular table $1.99');
ok(quote({}, { kind: 'piece', key: 's:neon' }).amount === 599, 'sound $5.99');
ok(quote({}, { kind: 'piece', key: 'd:classic' }).error, 'free/unknown items are not for sale');
ok(quote({ 'd:magma': 1 }, { kind: 'piece', key: 'd:magma' }).error, 'cannot buy twice');
ok(quote({}, { kind: 'bundle', id: 'lava' }).amount === 1499, 'ultra bundle $14.99');
ok(quote({ 'd:magma': 1 }, { kind: 'bundle', id: 'lava' }).amount === 999, 'own 1 of 4: $9.99');
ok(quote({ 'd:magma': 1, 's:molten': 1 }, { kind: 'bundle', id: 'lava' }).amount === 499, 'own 2 of 4: $4.99');
ok(quote({ 'd:magma': 1, 's:molten': 1, 't:molten': 1 }, { kind: 'bundle', id: 'lava' }).amount === 299, 'own 3 of 4: $2.99');
ok(quote({ 'd:magma': 1, 's:molten': 1, 't:molten': 1, 'b:magma': 1 }, { kind: 'bundle', id: 'lava' }).error, 'own all: no sale');
ok(JSON.stringify(quote({ 'd:magma': 1 }, { kind: 'bundle', id: 'lava' }).keys) === JSON.stringify(['t:molten', 'b:magma', 's:molten']), 'rest of bundle grants the missing pieces');
ok(quote({}, { kind: 'bundle', id: 'hog' }).amount === 499, 'regular bundle $4.99');
ok(quote({ 'd:hog': 1 }, { kind: 'bundle', id: 'hog' }).amount === 299 && quote({ 'd:hog': 1, 't:hog': 1 }, { kind: 'bundle', id: 'hog' }).amount === 149, 'regular rest $2.99/$1.49');
ok(quote({ 's:neon': 1 }, { kind: 'bundle', id: 'ngreen' }).amount === 999, 'Nightclub sounds count toward both neon bundles');
ok(quote({}, { kind: 'pick3', ids: ['lava', 'space', 'xmas'] }).amount === 2999, 'any 3 ultra: $29.99');
ok(quote({}, { kind: 'pick3', ids: ['hog', 'usa', 'seven'] }).amount === 1497, 'any 3 cheap: their own total');
ok(quote({}, { kind: 'pick3', ids: ['npink', 'ngreen', 'hog'] }).keys.filter(k => k === 's:neon').length === 1, 'shared sound granted once');
ok(quote({}, { kind: 'pick3', ids: ['lava', 'lava', 'xmas'] }).error, 'any 3 needs 3 different bundles');
ok(quote({}, { kind: 'piece', key: 'd:magma', amount: 1 }).amount === 599, 'a price from the phone is ignored');

/* every item for sale is one the server lets players use */
const room = fs.readFileSync(new URL('../worker/room.js', import.meta.url), 'utf8');
BUNDLES.forEach(B => bundleParts(B).forEach(key => { const [k, id] = key.split(':'); const m = room.match(new RegExp('\\n  ' + k + ': \\{[^\\n]*shop: \\[([^\\]]*)\\]')); ok(m && m[1].includes("'" + id + "'"), 'LOOKS allows ' + key) }));
/* the Shop page lists the same bundles */
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
BUNDLES.forEach(B => { const re = new RegExp("\\{id:'" + B.id + "',n:'[^']*',t:'" + B.t + "',d:'" + B.d + "',b:'" + B.b + "'" + (B.s ? ",s:'" + B.s + "'" : ",price") + "[^}]*anim:" + B.anim); ok(re.test(html), 'page bundle matches server: ' + B.id) });

/* checkout page settings */
const sp = sessionParams(quote({}, { kind: 'bundle', id: 'xmas' }), { id: 'sb:u1', email: 'a@b.c' }, 'https://degenpig.com', false);
ok(sp.mode === 'payment' && sp.line_items[0].price_data.unit_amount === 1499 && sp.metadata.uid === 'sb:u1' && sp.success_url.includes('{CHECKOUT_SESSION_ID}') && !sp.invoice_creation, 'session params');

/* webhook signature */
const secret = 'whsec_test123', body = JSON.stringify({ hi: 1 }), t = Math.floor(Date.now() / 1000);
const sig = crypto.createHmac('sha256', secret).update(t + '.' + body).digest('hex');
ok(await verifySig(body, 't=' + t + ',v1=' + sig, secret), 'good signature passes');
ok(!(await verifySig(body + ' ', 't=' + t + ',v1=' + sig, secret)), 'changed body fails');
ok(!(await verifySig(body, 't=' + t + ',v1=' + sig, 'whsec_other')), 'wrong secret fails');
ok(!(await verifySig(body, 't=' + (t - 1000) + ',v1=' + crypto.createHmac('sha256', secret).update((t - 1000) + '.' + body).digest('hex'), secret)), 'old event fails');
ok(!(await verifySig(body, null, secret)), 'no header fails');

/* grant, double delivery, refund */
const A = new AccountsLogic(new MemStorage());
const sess = { id: 'cs_1', payment_status: 'paid', payment_intent: 'pi_1', client_reference_id: 'sb:u1', amount_total: 1499, metadata: { uid: 'sb:u1', keys: 't:xmas,d:candy,b:candy,s:xmas' } };
ok(await onEvent({ type: 'checkout.session.completed', data: { object: sess } }, A, null) === 'granted', 'webhook grants');
ok(await onEvent({ type: 'checkout.session.completed', data: { object: sess } }, A, null) === 'granted', 'repeat webhook is harmless');
let r = await A.get('sb:u1'); ok(r.own['d:candy'] && Object.keys(r.buys).length === 1, 'owned once');
await A.grant('sb:u1', ['d:magma'], { ref: 'pi_2', sid: 'cs_2', amt: 599 });
ok(await onEvent({ type: 'checkout.session.completed', data: { object: Object.assign({}, sess, { payment_status: 'unpaid' }) } }, A, null) === 'waiting for payment', 'unpaid session waits');
const api = { getIntent: async id => ({ id, metadata: { uid: 'sb:u1' } }) };
ok(await onEvent({ type: 'charge.refunded', data: { object: { refunded: false, payment_intent: 'pi_1' } } }, A, api) === 'ignored', 'partial refund keeps items');
ok(await onEvent({ type: 'charge.refunded', data: { object: { refunded: true, payment_intent: 'pi_1' } } }, A, api) === 'revoked', 'full refund revokes');
r = await A.get('sb:u1'); ok(!r.own['d:candy'] && !r.own['t:xmas'] && r.own['d:magma'], 'refund takes back only that purchase');
ok(await onEvent({ type: 'charge.dispute.closed', data: { object: { status: 'lost', payment_intent: 'pi_2' } } }, A, api) === 'revoked', 'lost dispute revokes');
r = await A.get('sb:u1'); ok(!r.own['d:magma'], 'dispute removed the dice');

/* thin events: only the type and the object's address; the details are fetched from Stripe */
const B = new AccountsLogic(new MemStorage());
const objs = { '/v1/checkout/sessions/cs_9': { id: 'cs_9', payment_status: 'paid', payment_intent: 'pi_9', amount_total: 599, metadata: { uid: 'sb:u2', keys: 'd:magma' } },
  '/v1/charges/ch_9': { id: 'ch_9', refunded: true, payment_intent: 'pi_9', metadata: {} } };
const tapi = { getUrl: async u => objs[u], getIntent: async id => ({ id, metadata: { uid: 'sb:u2' } }) };
ok(await onEvent({ object: 'v2.core.event', type: 'v1.checkout.session.completed', related_object: { id: 'cs_9', type: 'checkout.session', url: '/v1/checkout/sessions/cs_9' } }, B, tapi) === 'granted', 'thin checkout event grants');
ok((await B.get('sb:u2')).own['d:magma'], 'thin grant owned');
ok(await onEvent({ object: 'v2.core.event', type: 'v1.charge.refunded', related_object: { id: 'ch_9', type: 'charge', url: '/v1/charges/ch_9' } }, B, tapi) === 'revoked', 'thin refund revokes');
ok(!(await B.get('sb:u2')).own['d:magma'], 'thin refund removed it');
ok(await onEvent({ type: 'charge.refunded', related_object: { url: 'https://evil.example/x' } }, B, tapi) === 'ignored', 'odd addresses are not fetched');

console.log(fails ? fails + ' failed' : 'pay: all passed');
process.exit(fails ? 1 : 0);
