import { isAdmin, json } from '../lib/auth.js';
import { readData, writeData } from '../lib/store.js';

// Admin: replace the whole category list (order = display order).
// Products in a deleted category become uncategorized (cat = '').
export async function PUT(request) {
  if (!isAdmin(request)) return json({ error: 'Not logged in' }, 401);
  try {
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.categories)) return json({ error: 'categories must be a list' }, 400);
    const str = (v, n) => String(v ?? '').trim().slice(0, n);
    const seen = new Set();
    const categories = [];
    for (const c of body.categories.slice(0, 60)) {
      const id = str(c.id, 40).replace(/[^\w-]/g, '');
      const en = str(c.en, 40);
      const zh = str(c.zh, 40);
      if (!id || seen.has(id) || (!en && !zh)) continue;
      seen.add(id);
      categories.push({ id, en: en || zh, zh: zh || en });
    }
    const data = await readData();
    data.categories = categories;
    for (const p of data.products) if (!seen.has(p.cat)) p.cat = '';
    await writeData(data);
    return json(data);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
