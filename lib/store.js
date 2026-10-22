import { put, list, del } from '@vercel/blob';

// All products live in one JSON file in Vercel Blob. Each save writes a new
// file (fresh URL, so no stale CDN cache) and then removes the older ones.
const PREFIX = 'data/products';

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

export async function readProducts() {
  const blobs = await dataBlobs();
  if (!blobs.length) return SEED;
  const res = await fetch(blobs[0].url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not read products (' + res.status + ')');
  return res.json();
}

export async function writeProducts(products) {
  const old = await dataBlobs();
  await put(PREFIX + '.json', JSON.stringify(products), {
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
