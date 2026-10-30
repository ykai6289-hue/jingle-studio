import { put, list, del } from '@vercel/blob';

// Everything (categories + products) lives in one JSON file in Vercel Blob.
// Each save writes a new file (fresh URL, so no stale CDN cache) and then
// removes the older ones.
const PREFIX = 'data/products';

export const DEFAULT_CATEGORIES = [
  { id: 'bags', en: 'Bags', zh: '手袋' },
  { id: 'apparel', en: 'Apparel', zh: '服装' },
  { id: 'belts', en: 'Belts', zh: '皮带' },
  { id: 'shoes', en: 'Shoes', zh: '鞋履' },
  { id: 'accessories', en: 'Accessories', zh: '配饰' },
  { id: 'other', en: 'Other', zh: '其他' },
];

// Site sections (navigation). Every category belongs to one section.
export const SECTION_IDS = ['fashion', 'stone', 'paper', 'tea'];
// Each product-line section always has at least one category to upload into.
const LINE_DEFAULTS = [
  { id: 'stone', en: 'Natural Stone', zh: '天然石材', section: 'stone' },
  { id: 'paper', en: 'Paper Products', zh: '纸制品', section: 'paper' },
  { id: 'herbal-tea', en: 'Herbal Tea', zh: '草本茶', section: 'tea' },
];

// Shown until the first save from admin mode.
const SEED = [
  {
    id: 1748000000000,
    imgs: [1, 2, 3, 4, 5, 6].map(i => `/seed/af1-mamba-${i}.jpg`),
    brand: 'Nike',
    name: 'Air Force 1 Low "Mamba Forever"',
    desc: '',
    price: 0,
    cat: 'shoes',
    badge: 'new',
    ts: 1748000000000,
  },
];

async function dataBlobs() {
  const { blobs } = await list({ prefix: PREFIX, limit: 100 });
  return blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

// Stable id for a brand name, so brands built from old data keep the same id
// on every read until they are saved.
export function brandIdFor(name) {
  let h = 5381;
  for (const ch of String(name).trim().toLowerCase()) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return 'b' + h.toString(36);
}
export function newBrandId() {
  return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

// Every category gets a brands list [{id, name}] and every product a brandId.
// Categories saved before brands existed get their list built from products.
export function normalize(d) {
  const categories = (Array.isArray(d.categories) ? d.categories : DEFAULT_CATEGORIES)
    .map(c => ({ ...c, section: SECTION_IDS.includes(c.section) ? c.section : 'fashion' }));
  for (const def of LINE_DEFAULTS) {
    if (!categories.some(c => c.section === def.section) && !categories.some(c => c.id === def.id)) {
      categories.push({ ...def, brands: [] });
    }
  }
  const products = (Array.isArray(d.products) ? d.products : []).map(p => ({ ...p }));
  for (const cat of categories) {
    if (Array.isArray(cat.brands)) continue;
    cat.brands = [];
    for (const p of products) {
      if (p.cat === cat.id && p.brand && !cat.brands.some(b => same(b.name, p.brand))) {
        cat.brands.push({ id: brandIdFor(p.brand), name: String(p.brand).trim() });
      }
    }
  }
  for (const p of products) {
    const cat = categories.find(c => c.id === p.cat);
    const byId = cat && cat.brands.find(b => b.id === p.brandId);
    const byName = cat && !byId && cat.brands.find(b => same(b.name, p.brand));
    const b = byId || byName;
    p.brandId = b ? b.id : '';
    if (b) p.brand = b.name;
  }
  return { categories, products, home: cleanHome(d.home) };
}

// Home page picture slots the admin can fill (e.g. the four Collection tiles).
export const HOME_TILES = ['bags', 'sneakers', 'heels', 'accessories'];
export function cleanHome(h) {
  const tiles = {};
  const src = h && typeof h.tiles === 'object' && h.tiles ? h.tiles : {};
  for (const k of HOME_TILES) {
    if (typeof src[k] === 'string' && /^https:\/\//.test(src[k])) tiles[k] = src[k];
  }
  return { tiles };
}

export async function readData() {
  const blobs = await dataBlobs();
  if (!blobs.length) return normalize({ categories: DEFAULT_CATEGORIES, products: SEED });
  const res = await fetch(blobs[0].url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not read products (' + res.status + ')');
  const d = await res.json();
  // Older saves were just an array of products
  return normalize(Array.isArray(d) ? { products: d } : d);
}

// Put a product's brand into its category's brand list (creating it if new).
export function attachBrand(data, p, brandId) {
  if (!p.brand) { p.brandId = ''; return; } // brand is optional (e.g. stone, paper)
  const cat = data.categories.find(c => c.id === p.cat);
  if (!cat) { p.brandId = ''; return; }
  let b = cat.brands.find(x => x.id === brandId) || cat.brands.find(x => same(x.name, p.brand));
  if (!b) { b = { id: newBrandId(), name: p.brand }; cat.brands.push(b); }
  p.brandId = b.id;
  p.brand = b.name;
}

export async function writeData({ categories, products, home }) {
  const old = await dataBlobs();
  await put(PREFIX + '.json', JSON.stringify({ categories, products, home: cleanHome(home) }), {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'application/json',
  });
  if (old.length) await del(old.map(b => b.url));
}

export async function saveImage(bytes, contentType) {
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const blob = await put(`images/${Date.now()}.${ext}`, bytes, {
    access: 'public',
    addRandomSuffix: true,
    contentType,
  });
  return blob.url;
}

// Remove uploaded images that no product uses any more.
export async function deleteImages(urls) {
  const mine = urls.filter(u => /^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(u));
  if (mine.length) await del(mine);
}
