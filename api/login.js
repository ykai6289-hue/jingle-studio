import { checkPassword, makeToken, json } from '../lib/auth.js';

export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  try {
    if (!checkPassword(body.password)) {
      await new Promise(r => setTimeout(r, 800)); // slow down guessing
      return json({ error: 'Wrong password' }, 401);
    }
    return json({ token: makeToken() });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
