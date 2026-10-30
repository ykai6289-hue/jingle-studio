import { isAdmin, json } from '../lib/auth.js';
import { readData, writeData, deleteImages, HOME_TILES } from '../lib/store.js';

// Admin: set or clear one home-page picture.
// Body: { tile: 'bags' | 'sneakers' | 'heels' | 'accessories', url: 'https://…' | '' }
export async function PUT(request) {
  if (!isAdmin(request)) return json({ error: 'Not logged in' }, 401);
  try {
    const body = await request.json().catch(() => ({}));
    const tile = String(body.tile || '');
    if (!HOME_TILES.includes(tile)) return json({ error: 'Unknown picture slot' }, 400);
    const url = String(body.url || '').trim();
    if (url && !/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(url)) return json({ error: 'Upload the picture first' }, 400);
    const data = await readData();
    const old = data.home.tiles[tile];
    if (url) data.home.tiles[tile] = url; else delete data.home.tiles[tile];
    await writeData(data);
    if (old && old !== url) await deleteImages([old]).catch(() => {});
    return json(data);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
