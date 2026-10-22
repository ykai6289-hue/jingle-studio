import { createHmac, timingSafeEqual } from 'node:crypto';

// Admin password is set in Vercel → Settings → Environment Variables → ADMIN_PASSWORD.
// Tokens are signed with it, so changing the password logs everyone out.
const TOKEN_DAYS = 30;

function secret() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error('ADMIN_PASSWORD is not set');
  return pw;
}

function sign(data) {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(pw) {
  return safeEqual(pw || '', secret());
}

export function makeToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_DAYS * 864e5 })).toString('base64url');
  return payload + '.' + sign(payload);
}

export function isAdmin(request) {
  try {
    const h = request.headers.get('authorization') || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    const [payload, sig] = token.split('.');
    if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
