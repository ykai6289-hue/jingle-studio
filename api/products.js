import { isAdmin, json } from '../lib/auth.js';
import { readProducts, writeProducts, deleteImages } from '../lib/store.js';

const CATS = ['bags', 'apparel', 'belts', 'shoes', 'other'];
const BADGES = ['', 'new', 'sale', 'sold'];

function clean(p) {
  const str = (v, n) => String(v ?? '').trim().slice(0, n);
  const imgs = Array.isArray(p.imgs) ? p.imgs.filter(u => typeof u === 'string' && /^(https?:\/\/|\/seed\/)/.test(u)).slice(0, 6) : [];
  return {
    id: Number(p.id) || Date.now(),
    imgs,
    brand: str(p.brand, 80),
    name: str(p.name, 160),
    desc: str(p.desc, 4000),
    price: Math.max(0, parseInt(p.price) || 0),
    cat: CATS.includes(p.cat) ? p.cat : 'other',
    badge: BADGES.includes(p.badge) ? p.badge : '',
    ts: Number(p.ts) || Date.now(),
  };
}

// Everyone: list products
export async function GET() {
  try {
    return json(await readProducts());
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// Admin: add or update one product
export async function PUT(request) {
  if (!isAdmin(request)) return json({ error: 'Not logged in' }, 401);
  try {
    const p = clean(await request.json());
    if (!p.brand || !p.name) return json({ error: 'Brand and name are required' }, 400);
    const products = await readProducts();
    const i = products.findIndex(x => x.id === p.id);
    let removed = [];
    if (i >= 0) {
      removed = products[i].imgs.filter(u => !p.imgs.includes(u));
      products[i] = p;
    } else {
      products.unshift(p);
    }
    await writeProducts(products);
    await deleteImages(removed).catch(() => {});
    return json(products);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// Admin: delete one product (?id=...)
export async function DELETE(request) {
  if (!isAdmin(request)) return json({ error: 'Not logged in' }, 401);
  try {
    const id = Number(new URL(request.url).searchParams.get('id'));
    const products = await readProducts();
    const gone = products.find(x => x.id === id);
    if (!gone) return json({ error: 'Not found' }, 404);
    const rest = products.filter(x => x.id !== id);
    await writeProducts(rest);
    await deleteImages(gone.imgs).catch(() => {});
    return json(rest);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
