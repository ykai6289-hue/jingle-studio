#!/usr/bin/env python3
"""Generate the SEO copies of the site. Run from the repo root after editing
index.html, stones.js or the SCENES list:   python3 tools/build_pages.py

Writes:
  index.html (its <!--SEO--> block only), trade.html, collection.html,
  stone.html, paper.html, tea.html  -> same page, own title/description
  stones/<slug>.html                -> one static page per stone
  sitemap.xml, robots.txt
"""
import json, re, os, html, shutil, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://www.jingleluxurystudio.com'
os.chdir(ROOT)

PAGES = {
    '/': ('Jingle Studio — Natural Stone, Custom Paper & Herbal Tea from China',
          'Wholesale and made-to-order supply from China to the UK, Europe and worldwide: marble and natural stone, custom-printed paper products and FuLu is Coming herbal tea.',
          'img/stone-persian.jpg'),
    '/trade': ('Trade & Custom Supply from China — Stone, Paper, Herbal Tea | Jingle Studio',
               'Work directly with manufacturers across China. Natural stone, custom-printed paper products and herbal tea, made to your spec and shipped to the UK, Europe and worldwide.',
               'img/stone-island.jpg'),
    '/stone': ('Marble & Natural Stone Supplier — 140+ Stones, Slabs & Cut-to-Size | Jingle Studio',
               'Marble, quartzite, onyx, travertine and granite from China. Browse 140+ stones, see them in real interiors, and order slabs or finished pieces cut to your drawings. Shipped to the UK, Europe and worldwide.',
               'img/stone-persian.jpg'),
    '/paper': ('Custom Printed Napkins, Coasters & Greaseproof Paper | Jingle Studio',
               'Napkins, drink coasters and greaseproof paper printed with your logo, colours and sizes. Made to order for bars, restaurants and hotels in the UK and Europe.',
               'img/stone-slab.jpg'),
    '/tea': ('FuLu is Coming Herbal Tea — Five-Elements Range, Up to 51% Off | Jingle Studio',
             'Six herbal infusions inspired by the Chinese five elements, in signature gourd packaging. Retail from ¥179 per box, wholesale for hotels, spas and gift shops.',
             'img/tea-range.jpg'),
    '/collection': ('The Collection — Bags, Sneakers, Heels & Apparel | Jingle Studio',
                    'Hand-picked bags, sneakers, heels, apparel and accessories, photographed piece by piece. Message us on WhatsApp to ask about any item.',
                    'img/stone-slab.jpg'),
}
FILES = {'/trade': 'trade.html', '/collection': 'collection.html', '/stone': 'stone.html', '/paper': 'paper.html', '/tea': 'tea.html'}

def e(s): return html.escape(s, quote=True)

def seo_block(path):
    t, d, img = PAGES[path]
    url = SITE + (path if path != '/' else '/')
    data = {k: {'t': v[0], 'd': v[1]} for k, v in PAGES.items()}
    return ('<!--SEO-->\n'
            f'<title>{e(t)}</title>\n'
            f'<meta name="description" content="{e(d)}"/>\n'
            f'<link rel="canonical" href="{url}"/>\n'
            '<meta property="og:type" content="website"/>\n<meta property="og:site_name" content="Jingle Studio"/>\n'
            f'<meta property="og:title" content="{e(t)}"/>\n<meta property="og:description" content="{e(d)}"/>\n'
            f'<meta property="og:url" content="{url}"/>\n<meta property="og:image" content="{SITE}/{img}"/>\n'
            '<meta name="twitter:card" content="summary_large_image"/>\n'
            f'<script>window.__SEO={json.dumps(data, ensure_ascii=False)};</script>\n'
            '<!--/SEO-->')

src = open('index.html', encoding='utf-8').read()
pat = re.compile(r'<!--SEO-->.*?<!--/SEO-->', re.S)
assert len(pat.findall(src)) == 1, 'index.html needs one <!--SEO--> block'
src = pat.sub(lambda m: seo_block('/'), src)
open('index.html', 'w', encoding='utf-8').write(src)
for path, fn in FILES.items():
    open(fn, 'w', encoding='utf-8').write(pat.sub(lambda m: seo_block(path), src))

# ---------- stones ----------
st = open('stones.js', encoding='utf-8').read()
stones = json.loads(st[st.index('window.STONES = ') + 16: st.rindex(']') + 1])
scenes = re.findall(r"\['(p[\w-]+)', '([^']*)', '(\w+)', '([^']*)', '([^']*)'\]", src)
TYPE = {'marble': 'Marble', 'quartzite': 'Quartzite', 'onyx': 'Onyx', 'travertine': 'Travertine', 'granite': 'Granite'}
TYPE_ZH = {'marble': '大理石', 'quartzite': '石英岩', 'onyx': '玉石', 'travertine': '洞石', 'granite': '花岗岩'}
COLOR = {'white': 'white', 'grey': 'grey', 'black': 'black', 'beige': 'beige and brown', 'gold': 'gold', 'green': 'green', 'blue': 'blue', 'pink': 'pink and red', 'purple': 'purple'}
USES = {
    'marble': 'feature walls, vanity tops, flooring, fireplaces and furniture',
    'quartzite': 'kitchen worktops, islands, feature walls and vanity tops',
    'onyx': 'backlit walls, bar counters, tables and decorative pieces',
    'travertine': 'flooring, walls, vanity units and furniture',
    'granite': 'worktops, flooring, stairs and outdoor paving',
}

def slugify(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
seen = {}
for r in stones:
    sl = slugify(r[2]) or r[0]
    if sl in seen: sl = sl + '-' + r[0]
    seen[sl] = 1
    r.append(sl)
by_id = {r[0]: r for r in stones}

if os.path.isdir('stones'): shutil.rmtree('stones')
os.makedirs('stones')
CSS = """*{box-sizing:border-box;margin:0;padding:0}:root{--gold:#b89a5a;--gold-l:#d4b97a;--bg:#07070c;--bg2:#0e0e17;--line:#22222f;--line2:#31314a;--text:#ece7de;--muted:#a09eb3}
body{background:var(--bg);color:var(--text);font-family:'DM Mono',ui-monospace,monospace;font-size:14px;line-height:1.7}
a{color:var(--gold-l)}.wrap{max-width:1180px;margin:0 auto;padding:0 max(20px,env(safe-area-inset-left,0px))}
header{border-bottom:1px solid var(--line)}header .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-block:16px;flex-wrap:wrap}
.logo{font-family:'Cormorant Garamond',serif;font-size:20px;letter-spacing:.3em;text-transform:uppercase;color:var(--text);text-decoration:none}
nav{display:flex;gap:22px;flex-wrap:wrap}nav a{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);text-decoration:none}nav a:hover{color:var(--gold-l)}
.crumb{font-size:12px;color:var(--muted);padding-top:28px}.crumb a{color:var(--muted);text-decoration:none}.crumb a:hover{color:var(--gold-l)}
.hero{display:grid;grid-template-columns:1.25fr 1fr;gap:44px;padding-block:24px 56px;align-items:start}
.hero img{width:100%;aspect-ratio:4/3;object-fit:cover;border:1px solid var(--line);border-radius:4px;display:block}
.eyebrow{font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold)}
h1{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:52px;line-height:1.05;margin:10px 0 6px}
.zh{font-family:'Noto Serif SC',serif;font-size:22px;color:var(--gold-l)}
.facts{display:grid;grid-template-columns:auto 1fr;gap:6px 18px;margin:22px 0;font-size:13px}.facts dt{color:var(--muted)}
p.lead{color:var(--muted);max-width:560px}
.btns{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}.btn{display:inline-flex;align-items:center;padding:13px 22px;border-radius:3px;font-size:13px;text-decoration:none;letter-spacing:.04em}
.btn.p{background:var(--gold);color:#07070c}.btn.g{border:1px solid var(--line2);color:var(--text)}
.note{font-size:11px;color:var(--muted);margin-top:14px}
section{padding-block:40px;border-top:1px solid var(--line)}h2{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:30px;margin-bottom:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:16px}
.card{display:flex;flex-direction:column;background:var(--bg2);border:1px solid var(--line);border-radius:4px;overflow:hidden;text-decoration:none;color:var(--text)}
.card:hover{border-color:var(--gold)}.card img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}.card span{padding:10px 12px;font-family:'Cormorant Garamond',serif;font-size:18px;line-height:1.2}
.card small{display:block;font-family:'DM Mono',monospace;font-size:11px;color:var(--muted)}
.scenes{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}.scenes figure img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;border:1px solid var(--line);display:block}.scenes figcaption{font-size:12px;color:var(--muted);margin-top:6px}
footer{border-top:1px solid var(--line);padding-block:28px;font-size:12px;color:var(--muted)}footer .wrap{display:flex;gap:18px;flex-wrap:wrap;justify-content:space-between}
@media (max-width:820px){.hero{grid-template-columns:1fr;gap:24px}h1{font-size:38px}}"""

WA = 'https://wa.me/85262861590?text='
from urllib.parse import quote
today = datetime.date.today().isoformat()
urls = [(SITE + '/', '1.0'), (SITE + '/trade', '0.9'), (SITE + '/stone', '0.9'), (SITE + '/paper', '0.8'), (SITE + '/tea', '0.8'), (SITE + '/collection', '0.6')]

for r in stones:
    sid, zh, en, typ, col, sl = r
    url = f'{SITE}/stones/{sl}'
    tname = TYPE[typ]
    name_full = en if tname.lower() in en.lower() else f'{en} {tname}'
    title = f'{name_full} ({zh}) — Slabs & Cut-to-Size from China | Jingle Studio'
    desc = (f'{en} ({zh}) is a {COLOR[col]} {tname.lower()}. Order slabs, tiles or finished pieces cut to your drawings — '
            f'for {USES[typ]}. Shipped from China to the UK, Europe and worldwide.')
    related = [x for x in stones if x[4] == col and x[0] != sid][:8]
    if len(related) < 8: related += [x for x in stones if x[3] == typ and x[0] != sid and x not in related][:8 - len(related)]
    my_scenes = [s for s in scenes if s[1] == zh]
    msg = f'Hello! I am interested in {en} ({zh}). Could you send slab photos, sizes and price?'
    scenes_html = ''
    if my_scenes:
        scenes_html = '<section><div class="wrap"><h2>' + e(en) + ' in real spaces</h2><div class="scenes">' + ''.join(
            f'<figure><img src="/img/scenes/{s[0]}.jpg" alt="{e(s[3])}" loading="lazy"/><figcaption>{e(s[3])}</figcaption></figure>' for s in my_scenes) + '</div></div></section>'
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Natural Stone", "item": SITE + '/stone'},
        {"@type": "ListItem", "position": 2, "name": en, "item": url}]}
    page = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}"/>
<link rel="canonical" href="{url}"/>
<meta property="og:type" content="website"/><meta property="og:site_name" content="Jingle Studio"/>
<meta property="og:title" content="{e(title)}"/><meta property="og:description" content="{e(desc)}"/>
<meta property="og:url" content="{url}"/><meta property="og:image" content="{SITE}/img/stones/{sid}.jpg"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Mono:wght@300;400&family=Noto+Serif+SC:wght@400&display=swap" rel="stylesheet"/>
<style>{CSS}</style>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<script defer src="/_vercel/insights/script.js"></script>
</head>
<body>
<header><div class="wrap"><a class="logo" href="/">Jingle Studio</a><nav><a href="/">Home</a><a href="/trade">Trade</a><a href="/stone">Natural Stone</a><a href="/collection">Collection</a><a href="{WA}{quote('Hello! I would like to know more.')}">Contact</a></nav></div></header>
<main>
<div class="wrap crumb"><a href="/trade">Trade</a> / <a href="/stone">Natural Stone</a> / <a href="/stone#stoneLib">Stone library</a> / {e(en)}</div>
<div class="wrap hero">
  <img src="/img/stones/{sid}.jpg" alt="{e(en)} ({e(zh)}) {e(tname.lower())} surface"/>
  <div>
    <div class="eyebrow">{e(tname)} · {e(COLOR[col].title())}</div>
    <h1>{e(en)}</h1><div class="zh">{e(zh)}</div>
    <dl class="facts"><dt>Type</dt><dd>{e(tname)} ({TYPE_ZH[typ]})</dd><dt>Colour</dt><dd>{e(COLOR[col].capitalize())}</dd><dt>Supplied as</dt><dd>Slabs, tiles and cut-to-size pieces</dd><dt>Good for</dt><dd>{e(USES[typ].capitalize())}</dd><dt>Ships to</dt><dd>UK, Europe and worldwide</dd></dl>
    <p class="lead">{e(desc)}</p>
    <div class="btns"><a class="btn p" href="{WA}{quote(msg)}">Ask about this stone on WhatsApp</a><a class="btn g" href="mailto:service@runavasto.com?subject={quote(en + ' (' + zh + ') enquiry')}">Email service@runavasto.com</a></div>
    <p class="note">Photos show the typical colour and veining. Natural stone varies from block to block, so we send photos of the actual slabs before you order.</p>
  </div>
</div>
{scenes_html}
<section><div class="wrap"><h2>Similar stones</h2><div class="grid">{''.join(f'<a class="card" href="/stones/{x[5]}"><img src="/img/stones/{x[0]}.jpg" alt="{e(x[2])}" loading="lazy"/><span>{e(x[2])}<small>{e(x[1])} · {TYPE[x[3]]}</small></span></a>' for x in related)}</div>
<p style="margin-top:22px"><a href="/stone#stoneLib">Browse all {len(stones)} stones in the library →</a></p></div></section>
</main>
<footer><div class="wrap"><span>© {datetime.date.today().year} Jingle Studio</span><span>WhatsApp +852 6286 1590 · service@runavasto.com</span></div></footer>
</body>
</html>
'''
    open(f'stones/{sl}.html', 'w', encoding='utf-8').write(page)
    urls.append((url, '0.6'))

# slug map for the library cards in index.html
open('stones-slugs.js', 'w', encoding='utf-8').write('window.STONE_SLUGS = ' + json.dumps({r[0]: r[5] for r in stones}) + ';\n')

open('sitemap.xml', 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    ''.join(f'  <url><loc>{u}</loc><lastmod>{today}</lastmod><priority>{p}</priority></url>\n' for u, p in urls) + '</urlset>\n')
open('robots.txt', 'w').write(f'User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: {SITE}/sitemap.xml\n')
print(f'{len(FILES)} page copies, {len(stones)} stone pages, {len(urls)} sitemap urls')
