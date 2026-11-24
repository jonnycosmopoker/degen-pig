/* The Degen Pig Shop's payments, through Stripe Checkout.
   The phone asks for a piece, a bundle or Any 3 Bundles; the server works out the price from what the player already owns
   (never trusting a price from the phone), opens a Stripe Checkout page, and hands the items over once Stripe says it's paid:
   right away when the player comes back from Stripe (/api/pay/confirm), and again from Stripe's webhook in case they don't.
   A full refund, or a dispute the seller loses, takes that purchase's items back.

   Cloudflare secrets: STRIPE_SECRET_KEY (sk_test_... while testing, sk_live_... for real), STRIPE_WEBHOOK_SECRET (whsec_...).
   Cloudflare variables: SHOP_OPEN=1 shows the Shop to everyone (until then only the owner sees it),
                         STRIPE_INVOICES=1 also has Stripe make an invoice for each purchase (Stripe charges 0.4% for that). */

/* The bundles, the same as the Shop's list in public/index.html (keep the two in step). s is the sound set. */
export const BUNDLES = [
  { id: 'xmas', n: 'Christmas Eve', t: 'xmas', d: 'candy', b: 'candy', s: 'xmas', anim: true },
  { id: 'gold', n: 'Gold Vault', t: 'vault', d: 'gold24', b: 'gold', s: 'gold', anim: true },
  { id: 'lava', n: 'Molten Core', t: 'molten', d: 'magma', b: 'magma', s: 'molten', anim: true },
  { id: 'space', n: 'Deep Space', t: 'space', d: 'nebula', b: 'nebula', s: 'space', anim: true },
  { id: 'lagoon', n: 'Tropical Lagoon', t: 'lagoon', d: 'sand', b: 'lagoon', s: 'lagoon', anim: true },
  { id: 'npink', n: 'Neon Pink', t: 'npink', d: 'npink', b: 'npink', s: 'neon', anim: true },
  { id: 'ngreen', n: 'Neon Green', t: 'ngreen', d: 'ngreen', b: 'ngreen', s: 'neon', anim: true },
  { id: 'craps', n: 'High Roller', t: 'craps', d: 'ruby', b: 'hiroll', s: 'craps', anim: true },
  { id: 'arcade', n: 'Arcade Retro', t: 'arcade', d: 'arcade', b: 'arcade', s: 'arcade', anim: true },
  { id: 'seven', n: 'Seven Mile', t: 'seven', d: 'seven', b: 'seven', anim: false },
  { id: 'usa', n: 'Stars & Stripes', t: 'usa', d: 'usa', b: 'usa', anim: false },
  { id: 'whimsy', n: 'Whimsical', t: 'whimsy', d: 'whimsy', b: 'whimsy', anim: false },
  { id: 'gridiron', n: 'Game Day', t: 'gridiron', d: 'gridiron', b: 'gridiron', anim: false },
  { id: 'hog', n: 'Hog Heaven', t: 'hog', d: 'hog', b: 'hog', anim: false }
];
const SOUND_NAMES = { xmas: 'Christmas Eve', gold: 'Treasure Hoard', molten: 'Forge Fire', space: 'Cosmic Drift', lagoon: 'Island Breeze', neon: 'Nightclub', craps: 'High-Stakes Lounge', arcade: '8-Bit Console' };
const KIND = { t: 'table', d: 'dice', b: 'name tag', s: 'sound effects' };

/* prices in cents: Ultra Premium pieces and every sound set $5.99, regular pieces $1.99; bundles $14.99 / $4.99,
   less once some of the bundle is owned; Any 3 Bundles $29.99, or what the three cost on their own if that's less */
const PIECE_UP = 599, PIECE_REG = 199, BUNDLE_UP = 1499, BUNDLE_REG = 499, PICK3 = 2999;
const REST_UP = [999, 499, 299], REST_REG = [299, 149];

export function bundleParts(B) { const p = [['t', B.t], ['d', B.d], ['b', B.b]]; if (B.s) p.push(['s', B.s]); return p.map(x => x[0] + ':' + x[1]) }
function bundleOf(key) { const [k, id] = key.split(':'); return BUNDLES.find(B => B[k] === id) || null }
function pieceName(key) { const [k, id] = key.split(':'); if (k === 's') return (SOUND_NAMES[id] || id) + ' sound effects'; const B = bundleOf(key); return (B ? B.n : id) + ' ' + KIND[k] }
function bundlePrice(B, own) {
  const parts = bundleParts(B), have = parts.filter(k => own[k]).length;
  if (have >= parts.length) return null;
  return have === 0 ? (B.anim ? BUNDLE_UP : BUNDLE_REG) : (B.anim ? REST_UP : REST_REG)[have - 1];
}

/* what a request costs this player: { name, desc, amount (cents), keys (what they get) } or { error } */
export function quote(own, req) {
  own = own || {}; req = req || {};
  if (req.kind === 'piece') {
    const key = String(req.key || ''), B = bundleOf(key);
    if (!B || !bundleParts(B).includes(key)) return { error: 'That item isn’t for sale.' };
    if (own[key]) return { error: 'You already own that.' };
    return { name: pieceName(key), desc: 'Degen Pig: from the ' + B.n + ' bundle', amount: key[0] === 's' || B.anim ? PIECE_UP : PIECE_REG, keys: [key] };
  }
  if (req.kind === 'bundle') {
    const B = BUNDLES.find(x => x.id === req.id); if (!B) return { error: 'That bundle isn’t for sale.' };
    const amount = bundlePrice(B, own); if (amount == null) return { error: 'You already own the whole bundle.' };
    const keys = bundleParts(B).filter(k => !own[k]), full = keys.length === bundleParts(B).length;
    return { name: B.n + ' bundle' + (full ? '' : ' (the rest of it)'), desc: 'Degen Pig: ' + keys.map(pieceName).join(', '), amount, keys };
  }
  if (req.kind === 'pick3') {
    const ids = Array.isArray(req.ids) ? [...new Set(req.ids.map(String))] : [];
    const Bs = ids.map(id => BUNDLES.find(x => x.id === id));
    if (Bs.length !== 3 || Bs.some(B => !B)) return { error: 'Pick 3 different bundles.' };
    let sum = 0; const keys = [];
    for (const B of Bs) { const a = bundlePrice(B, own); if (a == null) return { error: 'You already own all of ' + B.n + '.' }; sum += a; bundleParts(B).forEach(k => { if (!own[k] && !keys.includes(k)) keys.push(k) }) }
    return { name: 'Any 3 Bundles', desc: 'Degen Pig: ' + Bs.map(B => B.n).join(', '), amount: Math.min(PICK3, sum), keys };
  }
  return { error: 'Bad request' };
}

/* ---------- talking to Stripe ---------- */
function form(obj, pre, out) {
  out = out || [];
  for (const k in obj) {
    const v = obj[k], key = pre ? pre + '[' + k + ']' : k;
    if (v == null) continue;
    if (typeof v === 'object') form(v, key, out); else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out.join('&');
}
export function stripeApi(secret) {
  const call = async (method, path, params) => {
    const r = await fetch('https://api.stripe.com/v1/' + path + (method === 'GET' && params ? '?' + form(params) : ''), {
      method, headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: method === 'GET' ? undefined : form(params || {})
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || 'Stripe error ' + r.status);
    return j;
  };
  return {
    createSession: p => call('POST', 'checkout/sessions', p),
    getSession: id => call('GET', 'checkout/sessions/' + encodeURIComponent(id)),
    getIntent: id => call('GET', 'payment_intents/' + encodeURIComponent(id)),
    /* a "thin" event only names the object it's about (e.g. /v1/charges/ch_...): fetch the object itself */
    getUrl: url => call('GET', String(url).replace(/^\/v1\//, ''))
  };
}

/* the Checkout page for one quote */
export function sessionParams(q, user, origin, invoices) {
  const keys = q.keys.join(',');
  return {
    mode: 'payment',
    line_items: { 0: { quantity: 1, price_data: { currency: 'usd', unit_amount: q.amount, product_data: { name: q.name, description: q.desc.slice(0, 300) } } } },
    success_url: origin + '/?paid={CHECKOUT_SESSION_ID}',
    cancel_url: origin + '/?shop=back',
    client_reference_id: user.id,
    customer_email: user.email || undefined,
    metadata: { uid: user.id, keys },
    payment_intent_data: { metadata: { uid: user.id, keys }, description: q.name },
    invoice_creation: invoices ? { enabled: 'true' } : undefined
  };
}

/* a paid Checkout session -> the purchase to record */
export function purchaseOf(s) {
  const md = s.metadata || {}, keys = String(md.keys || '').split(',').filter(Boolean);
  const pi = typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent && s.payment_intent.id) || null;
  return { uid: md.uid || s.client_reference_id || null, keys, ref: pi || s.id, sid: s.id, amt: s.amount_total || 0 };
}

/* ---------- Stripe's webhook ---------- */
/* Stripe signs each webhook with the endpoint's secret: header "t=TIMESTAMP,v1=SIGNATURE", HMAC-SHA256 of "TIMESTAMP.BODY" */
export async function verifySig(raw, header, secret, now) {
  if (!header || !secret) return false;
  const parts = {}; String(header).split(',').forEach(x => { const i = x.indexOf('='); if (i > 0) { const k = x.slice(0, i).trim(); (parts[k] = parts[k] || []).push(x.slice(i + 1).trim()) } });
  const t = parts.t && parts.t[0], sigs = parts.v1 || [];
  if (!t || !sigs.length) return false;
  if (Math.abs((now || Date.now()) / 1000 - Number(t)) > 300) return false;   /* older than 5 minutes: refuse (stops replays) */
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(t + '.' + raw)));
  const hex = [...mac].map(b => b.toString(16).padStart(2, '0')).join('');
  return sigs.some(s => s.length === hex.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

/* what to do with one webhook event. accounts = the Accounts store; api = stripeApi(...) */
export async function onEvent(ev, accounts, api) {
  let o = (ev && ev.data && ev.data.object) || null;
  /* Stripe's newer event destinations can send "thin" events: just the type and which object it's about, no details */
  if (!o && ev && ev.related_object && /^\/v1\/(checkout\/sessions|charges|disputes)\/[A-Za-z0-9_]+$/.test(ev.related_object.url || '')) o = await api.getUrl(ev.related_object.url);
  o = o || {};
  /* thin events name their type with a "v1." in front (v1.charge.refunded) */
  ev = Object.assign({}, ev, { type: String(ev.type || '').replace(/^v1\./, '') });
  if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
    if (o.payment_status !== 'paid') return 'waiting for payment';
    const p = purchaseOf(o); if (!p.uid || !p.keys.length) return 'no purchase in it';
    await accounts.grant(p.uid, p.keys, { ref: p.ref, sid: p.sid, amt: p.amt }); return 'granted';
  }
  /* a full refund, or a dispute the seller lost: take that purchase back */
  let pi = null;
  if (ev.type === 'charge.refunded' && o.refunded) pi = o.payment_intent;
  if (ev.type === 'charge.dispute.closed' && o.status === 'lost') pi = o.payment_intent;
  if (pi) {
    let uid = o.metadata && o.metadata.uid;
    if (!uid) { const intent = await api.getIntent(pi); uid = intent.metadata && intent.metadata.uid }
    if (uid) { await accounts.revoke(uid, pi); return 'revoked' }
  }
  return 'ignored';
}
