import { isAdmin, json } from '../lib/auth.js';
import { readData, writeData, deleteImages } from '../lib/store.js';

const BADGES = ['', 'new', 'sale', 'sold'];

function clean(p, catIds) {
  const str = (v, n) => String(v ?? '').trim().slice(0, n);
  const imgs = Array.isArray(p.imgs) ? p.imgs.filter(u => typeof u === 'string' && /^(https?:\/\/|\/seed\/)/.test(u)).slice(0, 6) : [];
  return {
    id: Number(p.id) || Date.now(),
    imgs,
    brand: str(p.brand, 80),
    name: str(p.name, 160),
    desc: str(p.desc, 4000),
    price: Math.max(0, parseInt(p.price) || 0),
    cat: catIds.has(p.cat) ? p.cat : '',
    badge: BADGES.includes(p.badge) ? p.badge : '',
    ts: Number(p.ts) || Date.now(),
  };
}

// Everyone: { categories, products }
export async function GET() {
  try {
    return json(await readData());
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// Admin: add or update one product
export async function PUT(request) {
  if (!isAdmin(request)) return json({ error: 'Not logged in' }, 401);
  try {
    const data = await readData();
    const p = clean(await request.json(), new Set(data.categories.map(c => c.id)));
    if (!p.brand || !p.name) return json({ error: 'Brand and name are required' }, 400);
    const i = data.products.findIndex(x => x.id === p.id);
    let removed = [];
    if (i >= 0) {
      removed = data.products[i].imgs.filter(u => !p.imgs.includes(u));
      data.products[i] = p;
    } else {
      data.products.unshift(p);
    }
    await writeData(data);
    await deleteImages(removed).catch(() => {});
    return json(data);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// Admin: delete one product (?id=...)
export async function DELETE(request) {
  if (!isAdmin(request)) return json({ error: 'Not logged in' }, 401);
  try {
    const id = Number(new URL(request.url).searchParams.get('id'));
    const data = await readData();
    const gone = data.products.find(x => x.id === id);
    if (!gone) return json({ error: 'Not found' }, 404);
    data.products = data.products.filter(x => x.id !== id);
    await writeData(data);
    await deleteImages(gone.imgs).catch(() => {});
    return json(data);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
