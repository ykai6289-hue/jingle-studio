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

export async function readData() {
  const blobs = await dataBlobs();
  if (!blobs.length) return { categories: DEFAULT_CATEGORIES, products: SEED };
  const res = await fetch(blobs[0].url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not read products (' + res.status + ')');
  const d = await res.json();
  // Older saves were just an array of products
  if (Array.isArray(d)) return { categories: DEFAULT_CATEGORIES, products: d };
  return {
    categories: Array.isArray(d.categories) ? d.categories : DEFAULT_CATEGORIES,
    products: Array.isArray(d.products) ? d.products : [],
  };
}

export async function writeData({ categories, products }) {
  const old = await dataBlobs();
  await put(PREFIX + '.json', JSON.stringify({ categories, products }), {
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
