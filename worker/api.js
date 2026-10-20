/* The /api routes, shared by the Cloudflare Worker and the local dev server.
   d = { verify(token), lobby, accounts, createTable(body) -> code, admins: [emails], deleteSignin(user) } */

export async function handleApi(d, method, path, token, body) {
  let user = null;
  if (token) user = await d.verify(token).catch(() => null);

  if (path === '/api/lobby') {
    if (user) await d.lobby.seen(user.id);
    return [200, { tables: await d.lobby.list(), counts: await d.lobby.counts() }];
  }
  if (!user) return [401, { error: 'Please sign in.' }];
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
  if (path === '/api/admin') {
    if (!admin) return [403, { error: 'This page is only for the owner.' }];
    const a = await d.lobby.admin(), t = await d.accounts.top();
    return [200, Object.assign(a, { players: t.players, top: t.top })];
  }
  return [404, { error: 'Not found' }];
}
