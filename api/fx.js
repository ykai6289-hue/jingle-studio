// Exchange rates for showing CNY prices in other currencies (reference only).
// Source: European Central Bank daily rates via frankfurter.app. The answer is
// cached at Vercel's edge for 6 hours, so the source is asked a few times a day.
const FALLBACK = { GBP: 0.105, EUR: 0.12, USD: 0.14 };

export async function GET() {
  let rates = null, date = '', live = false;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch('https://api.frankfurter.app/latest?from=CNY&to=GBP,EUR,USD', { signal: ctl.signal });
    clearTimeout(t);
    if (res.ok) {
      const d = await res.json();
      if (d && d.rates && d.rates.GBP && d.rates.EUR && d.rates.USD) { rates = d.rates; date = d.date || ''; live = true; }
    }
  } catch (e) {}
  if (!rates) rates = FALLBACK;
  return new Response(JSON.stringify({ base: 'CNY', rates, date, live }), {
    headers: {
      'content-type': 'application/json',
      'cache-control': live ? 'public, s-maxage=21600, stale-while-revalidate=86400' : 'public, s-maxage=600',
    },
  });
}
