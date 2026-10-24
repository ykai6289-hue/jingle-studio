import { isAdmin, json } from '../lib/auth.js';
import { readData, writeData, newBrandId, SECTION_IDS } from '../lib/store.js';

// Admin: replace the whole category list (order = display order), each with
// its own brand list. Renamed brands are copied onto their products.
// Products in a deleted category become uncategorized; products whose brand
// was deleted keep the brand text but are no longer linked to the list.
export async function PUT(request) {
  if (!isAdmin(request)) return json({ error: 'Not logged in' }, 401);
  try {
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.categories)) return json({ error: 'categories must be a list' }, 400);
    const str = (v, n) => String(v ?? '').trim().slice(0, n);
    const seen = new Set();
    const categories = [];
    const brandMap = new Map(); // old brand id -> kept brand id (merges duplicate names)
    for (const c of body.categories.slice(0, 60)) {
      const id = str(c.id, 40).replace(/[^\w-]/g, '');
      const en = str(c.en, 40);
      const zh = str(c.zh, 40);
      if (!id || seen.has(id) || (!en && !zh)) continue;
      seen.add(id);
      const brands = [];
      for (const b of (Array.isArray(c.brands) ? c.brands : []).slice(0, 200)) {
        const name = str(b.name, 80);
        if (!name) continue;
        const bid = str(b.id, 40).replace(/[^\w-]/g, '') || newBrandId();
        const dup = brands.find(x => x.name.toLowerCase() === name.toLowerCase());
        if (dup) { brandMap.set(bid, dup.id); continue; }
        if (brands.some(x => x.id === bid)) continue;
        brands.push({ id: bid, name });
        brandMap.set(bid, bid);
      }
      const section = SECTION_IDS.includes(c.section) ? c.section : 'fashion';
      categories.push({ id, en: en || zh, zh: zh || en, section, brands });
    }
    const data = await readData();
    data.categories = categories;
    for (const p of data.products) {
      const cat = categories.find(c => c.id === p.cat);
      if (!cat) { p.cat = ''; p.brandId = ''; continue; }
      const b = cat.brands.find(x => x.id === brandMap.get(p.brandId));
      p.brandId = b ? b.id : '';
      if (b) p.brand = b.name;
    }
    await writeData(data);
    return json(data);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
