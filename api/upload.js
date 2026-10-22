import { isAdmin, json } from '../lib/auth.js';
import { saveImage } from '../lib/store.js';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Admin: upload one image (raw bytes in the body). The page shrinks photos
// before sending, so they stay well under Vercel's 4.5 MB request limit.
export async function POST(request) {
  if (!isAdmin(request)) return json({ error: 'Not logged in' }, 401);
  const type = (request.headers.get('content-type') || '').split(';')[0];
  if (!TYPES.includes(type)) return json({ error: 'Only JPG, PNG or WEBP' }, 400);
  try {
    const bytes = Buffer.from(await request.arrayBuffer());
    if (!bytes.length) return json({ error: 'Empty file' }, 400);
    return json({ url: await saveImage(bytes, type) });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
