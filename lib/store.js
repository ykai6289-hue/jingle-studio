import { put, list, del } from '@vercel/blob';

// Everything (categories + products + home pictures) lives in one JSON file in
// Vercel Blob at a fixed address, so reading it is a plain (cheap, cached)
// download instead of a list() call. Older sites saved it under a random name
// (data/products-xxxx.json); that copy is moved over once, then removed.
const PREFIX = 'data/products';
const FIXED = 'data/site.json';

function fixedUrl() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || '';
  const storeId = token.split('_')[3] || ''; // same rule the Blob SDK uses
  return storeId ? `https://${storeId}.public.blob.vercel-storage.com/${FIXED}` : '';
}

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
  const migrated = Array.isArray(d.migrated) ? d.migrated.filter(x => typeof x === 'string') : [];
  // One-time: add Tops / Bottoms to the Collection (replacing an empty "Apparel").
  // Recorded in `migrated`, so deleting them later in admin sticks.
  if (!migrated.includes('tops-bottoms')) {
    const add = [{ id: 'tops', en: 'Tops', zh: '上装', section: 'fashion', brands: [] }, { id: 'bottoms', en: 'Bottoms', zh: '下装', section: 'fashion', brands: [] }]
      .filter(c => !categories.some(x => x.id === c.id));
    let at = categories.findIndex(c => c.id === 'apparel');
    if (at >= 0 && !products.some(p => p.cat === 'apparel')) categories.splice(at, 1);
    else at = at >= 0 ? at + 1 : Math.min(1, categories.length);
    categories.splice(at, 0, ...add);
    migrated.push('tops-bottoms');
  }
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
  return { categories, products, home: cleanHome(d.home), migrated };
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

const parse = d => normalize(Array.isArray(d) ? { products: d } : d); // oldest saves were just an array

// fresh=true skips the CDN cache (used before every save, and by admin pages)
export async function readData({ fresh = false } = {}) {
  const url = fixedUrl();
  let missing = !url;
  if (url) {
    try {
      const res = await fetch(fresh ? url + '?v=' + Date.now() : url, fresh ? { cache: 'no-store' } : {});
      if (res.ok) return parse(await res.json());
      missing = res.status === 404;
      if (!missing) throw new Error('Could not read products (' + res.status + ')');
    } catch (e) {
      if (!missing) throw e;
    }
  }
  // Not moved yet: read the old randomly named file once and copy it to the fixed address.
  const blobs = await dataBlobs();
  if (!blobs.length) return normalize({ categories: DEFAULT_CATEGORIES, products: SEED });
  const res = await fetch(blobs[0].url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not read products (' + res.status + ')');
  const data = parse(await res.json());
  if (url) await writeData(data).catch(() => {});
  return data;
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

export async function writeData({ categories, products, home, migrated }) {
  const done = Array.isArray(migrated) ? [...migrated] : [];
  const firstFixedSave = !done.includes('fixed-path');
  if (firstFixedSave) done.push('fixed-path');
  await put(FIXED, JSON.stringify({ categories, products, home: cleanHome(home), migrated: done }), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60, // visitors may see a save up to ~1 minute late
    contentType: 'application/json',
  });
  // One-time clean-up of the old randomly named copies.
  if (firstFixedSave) {
    const old = await dataBlobs().catch(() => []);
    if (old.length) await del(old.map(b => b.url)).catch(() => {});
  }
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
