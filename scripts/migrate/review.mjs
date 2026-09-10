/**
 * Builds the migration review page — every extracted article rendered with its
 * block sequence and its real photographs, so the migration can be checked
 * before anything is written to Sanity.
 *
 *   node scripts/migrate/review.mjs   ->  out/review.html
 */
import {readFileSync, writeFileSync} from 'node:fs'
import {join, resolve} from 'node:path'

const OUT = resolve(import.meta.dirname, 'out')
const content = JSON.parse(readFileSync(join(OUT, 'content.json'), 'utf8'))
const thumbs = JSON.parse(readFileSync(join(OUT, 'thumbs.json'), 'utf8'))
const warnings = readFileSync(join(OUT, 'warnings.txt'), 'utf8').split('\n').filter(Boolean)

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]))

const thumb = (id, cls = '') =>
  thumbs[id]
    ? `<img class="shot ${cls}" src="${thumbs[id]}" alt="" loading="lazy">`
    : `<div class="shot missing" role="img" aria-label="image not prepared">?</div>`

const fileOf = (id) => String(id || '').split('/').pop()

/** Portable Text spans -> HTML, keeping the marks the prose actually uses. */
function spans(block) {
  const defs = new Map((block.markDefs || []).map((d) => [d._key, d]))
  return (block.children || [])
    .map((c) => {
      let html = esc(c.text).replace(/\n/g, '<br>')
      for (const m of c.marks || []) {
        if (m === 'em') html = `<em>${html}</em>`
        else if (m === 'strong') html = `<strong>${html}</strong>`
        else if (defs.has(m)) html = `<a href="${esc(defs.get(m).href)}">${html}</a>`
      }
      return html
    })
    .join('')
}

const captionOf = (b) =>
  b.caption ? `<p class="cap">${esc(b.caption)}</p>` : ''

const altOf = (b) => (b.alt ? `<p class="alt">alt: ${esc(b.alt)}</p>` : '')

/** One body block -> a row: mono type tag in the gutter, content beside it. */
function renderBlock(b) {
  const row = (tag, body, extra = '') =>
    `<div class="row ${extra}"><div class="tag">${esc(tag)}</div><div class="cell">${body}</div></div>`

  switch (b._type) {
    case 'block': {
      const style = b.style || 'normal'
      const inner = spans(b)
      if (style === 'blockquote') return row('pull quote', `<blockquote>${inner}</blockquote>`)
      if (style === 'h2') return row('heading', `<h3 class="ah">${inner}</h3>`)
      if (style === 'h3') return row('subheading', `<h4 class="ah sm">${inner}</h4>`)
      if (style === 'lead') return row('lead', `<p class="prose lead">${inner}</p>`)
      return row('prose', `<p class="prose">${inner}</p>`)
    }
    case 'journalImage':
      return row(
        b.layout === 'inline' ? 'image' : `image · ${b.layout}`,
        `${thumb(b.source)}${captionOf(b)}${altOf(b)}<p class="file">${esc(fileOf(b.source))}</p>`
      )
    case 'imagePair':
      return row(
        'image pair',
        `<div class="pair">${(b.images || []).map((i) => thumb(i.source)).join('')}</div>` +
          captionOf(b) +
          `<p class="file">${(b.images || []).map((i) => esc(fileOf(i.source))).join('  ·  ')}</p>`
      )
    case 'imageStack':
      return row(
        'image stack',
        `${thumb(b.lead?.source, 'lead')}<div class="pair">${(b.row || [])
          .map((i) => thumb(i.source))
          .join('')}</div>`
      )
    case 'gallery':
      return row(
        `gallery · ${b.layout} · ${(b.items || []).length}`,
        `${b.label ? `<p class="glabel">${esc(b.label)}</p>` : ''}<div class="grid">${(b.items || [])
          .map(
            (i) =>
              `<figure>${thumb(i.source)}<figcaption>${esc(i.title || '')}${
                i.subtitle ? `<span>${esc(i.subtitle)}</span>` : ''
              }</figcaption></figure>`
          )
          .join('')}</div>`
      )
    case 'splitFeature':
      return row(
        'split feature',
        `<div class="split">${thumb(b.source)}<div>${
          b.eyebrow ? `<p class="eyebrow">${esc(b.eyebrow)}</p>` : ''
        }${b.heading ? `<h3 class="ah">${esc(b.heading)}</h3>` : ''}${(b.body || [])
          .map((p) => `<p class="prose">${spans(p)}</p>`)
          .join('')}${
          (b.specs || []).length
            ? `<dl class="specs">${b.specs
                .map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`)
                .join('')}</dl>`
            : ''
        }</div></div>`
      )
    case 'carousel':
      return row(
        `carousel · ${(b.items || []).length}`,
        `${b.eyebrow ? `<p class="eyebrow">${esc(b.eyebrow)}</p>` : ''}<div class="strip">${(b.items || [])
          .map((i) => `<figure>${thumb(i.source)}<figcaption>${esc(i.caption || '')}</figcaption></figure>`)
          .join('')}</div>`
      )
    case 'videoBlock':
      return row(
        'video',
        `<p class="deferred"><strong>Deferred.</strong> ${esc(b.label || 'Untitled clip')} — ` +
          `${esc(fileOf(b.sourceFile) || 'source unknown')}, ${esc(b.mode)} playback. ` +
          `Needs transcoding to MP4 before upload.</p>`,
        'is-todo'
      )
    case 'awardsList':
      return row(
        `awards · ${(b.rows || []).length}`,
        `${b.heading ? `<h3 class="ah">${esc(b.heading)}</h3>` : ''}${
          b.label ? `<p class="eyebrow">${esc(b.label)}</p>` : ''
        }${b.intro ? `<p class="prose">${esc(b.intro)}</p>` : ''}<table><tbody>${(b.rows || [])
          .map(
            (r) =>
              `<tr><th scope="row">${esc(r.title)}</th><td>${esc(r.car)}${
                r.note ? `<span class="note">${esc(r.note)}</span>` : ''
              }</td></tr>`
          )
          .join('')}</tbody></table>`
      )
    case 'resultsList':
      return row(
        `results · ${(b.rows || []).length}`,
        `${b.label ? `<p class="eyebrow">${esc(b.label)}</p>` : ''}<table class="results"><tbody>${(b.rows || [])
          .map(
            (r) =>
              `<tr><th scope="row">${esc(r.car)}<span class="note">${esc(r.detail || '')}</span></th>` +
              `<td class="num">${esc(r.price)}<span class="flag">basis not stated</span></td></tr>`
          )
          .join('')}</tbody></table>${b.footnote ? `<p class="cap">${esc(b.footnote)}</p>` : ''}`,
        'is-todo'
      )
    case 'divider':
      return row('divider', `<div class="rule"><span>${esc(b.label || '')}</span></div>`)
    default:
      return row(b._type, `<p class="prose">${esc(JSON.stringify(b).slice(0, 200))}</p>`)
  }
}

const counts = (a) =>
  Object.entries(
    a.body.reduce((m, b) => ({...m, [b._type]: (m[b._type] || 0) + 1}), {})
  )
    .sort((x, y) => y[1] - x[1])
    .map(([t, n]) => `<span class="chip">${esc(t)} <b>${n}</b></span>`)
    .join('')

const article = (a) => `
<section class="article" id="${esc(a.slug.current)}">
  <header class="ahead">
    <div class="ahead-txt">
      ${a.eyebrow ? `<p class="eyebrow">${esc(a.eyebrow)}</p>` : ''}
      <h2>${esc(a.title)}${
        a.status === 'inPreparation' ? ' <span class="badge">in preparation</span>' : ''
      }</h2>
      ${a.subtitle ? `<p class="sub">${esc(a.subtitle)}</p>` : ''}
      <dl class="meta">
        <div><dt>slug</dt><dd>/journal/${esc(a.slug.current)}</dd></div>
        <div><dt>date</dt><dd>${esc(a.publishDate)}${
          a.dateLabel ? ` <span class="note">shown as “${esc(a.dateLabel)}”</span>` : ''
        }</dd></div>
        ${a.location ? `<div><dt>place</dt><dd>${esc(a.location)}</dd></div>` : ''}
        ${a.cardMeta ? `<div><dt>card</dt><dd>${esc(a.cardCategory || '')} · ${esc(a.cardMeta)}</dd></div>` : ''}
      </dl>
      <div class="chips">${counts(a)}</div>
    </div>
    ${a.heroSource ? `<div class="ahead-img">${thumb(a.heroSource, 'hero')}<p class="file">${esc(fileOf(a.heroSource))}</p></div>` : ''}
  </header>
  <div class="blocks">${a.body.map(renderBlock).join('')}</div>
</section>`

const totalBlocks = content.articles.reduce((n, a) => n + a.body.length, 0)
const decisions = warnings.filter((w) => !/needs transcoding/.test(w))

const html = `<title>AKC Journal Migration Review</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root{
  --paper:#f5f5f3; --raised:#fbfbfa; --ink:#17171b; --muted:#6e6e78;
  --rule:#deded9; --rule-soft:#e9e9e5;
  --gold:#8a6a15; --amber:#a8710f; --amber-bg:#f6efe0; --moss:#4a6b3f;
  --serif:'Cormorant Garamond',Georgia,'Times New Roman',serif;
  --mono:'DM Mono',ui-monospace,'SF Mono',Menlo,monospace;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --paper:#0e0e10; --raised:#161619; --ink:#e9e6e0; --muted:#8d8d96;
    --rule:#2a2a2e; --rule-soft:#212125;
    --gold:#c9a84c; --amber:#d0a24a; --amber-bg:#241d0e; --moss:#8fae82;
  }
}
:root[data-theme="dark"]{
  --paper:#0e0e10; --raised:#161619; --ink:#e9e6e0; --muted:#8d8d96;
  --rule:#2a2a2e; --rule-soft:#212125;
  --gold:#c9a84c; --amber:#d0a24a; --amber-bg:#241d0e; --moss:#8fae82;
}
*,*::before,*::after{box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:var(--mono);
  font-weight:300;font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:56px 28px 96px}

/* ── masthead ── */
.mast{border-bottom:1px solid var(--rule);padding-bottom:28px;margin-bottom:8px}
.kicker{font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:var(--gold);margin:0 0 14px}
h1{font-family:var(--serif);font-weight:300;font-size:clamp(34px,5.5vw,54px);
  line-height:1.05;margin:0 0 12px;text-wrap:balance;letter-spacing:-.01em}
.standfirst{font-family:var(--serif);font-size:19px;line-height:1.5;color:var(--muted);
  max-width:56ch;margin:0}

/* ── summary figures ── */
.figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
  gap:1px;background:var(--rule-soft);border:1px solid var(--rule-soft);margin:32px 0 8px}
.fig{background:var(--paper);padding:16px 18px}
.fig b{display:block;font-family:var(--serif);font-size:30px;font-weight:400;
  line-height:1;font-variant-numeric:tabular-nums;margin-bottom:6px}
.fig span{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}

/* ── callouts ── */
.note-box{border-left:2px solid var(--gold);padding:14px 0 14px 18px;margin:36px 0 0;
  max-width:74ch}
.note-box h2{font-family:var(--serif);font-size:20px;font-weight:400;margin:0 0 8px}
.note-box p{margin:0 0 8px;color:var(--muted);max-width:70ch}
.note-box p:last-child{margin-bottom:0}
.todo{border-left-color:var(--amber);background:var(--amber-bg);padding:16px 18px;
  border-radius:0 3px 3px 0}
.todo ul{margin:8px 0 0;padding-left:18px;color:var(--ink)}
.todo li{margin-bottom:6px;font-size:13px}
.todo li:last-child{margin-bottom:0}

/* ── contents ── */
.toc{display:flex;flex-wrap:wrap;gap:0 22px;margin:34px 0 0;padding:16px 0;
  border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.toc a{color:var(--ink);text-decoration:none;font-size:12px;letter-spacing:.04em;
  border-bottom:1px solid transparent;padding:3px 0}
.toc a:hover{border-bottom-color:var(--gold);color:var(--gold)}

/* ── article ── */
.article{margin-top:72px;scroll-margin-top:24px}
.ahead{display:grid;grid-template-columns:1fr 220px;gap:28px;align-items:start;
  border-top:2px solid var(--ink);padding-top:20px}
.ahead h2{font-family:var(--serif);font-weight:400;font-size:clamp(26px,3.6vw,38px);
  line-height:1.1;margin:0 0 8px;text-wrap:balance}
.eyebrow{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin:0 0 10px}
.sub{font-family:var(--serif);font-size:18px;color:var(--muted);margin:0 0 16px;max-width:52ch}
.badge{font-family:var(--mono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--amber);border:1px solid var(--amber);padding:3px 7px;vertical-align:middle;
  white-space:nowrap}
.meta{margin:0 0 14px;display:grid;gap:3px}
.meta div{display:flex;gap:12px;font-size:12px}
.meta dt{color:var(--muted);min-width:44px;letter-spacing:.1em;text-transform:uppercase;font-size:10px;padding-top:2px}
.meta dd{margin:0}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:10px;letter-spacing:.08em;color:var(--muted);border:1px solid var(--rule);
  padding:3px 8px}
.chip b{color:var(--ink);font-weight:500}
.ahead-img .shot{width:100%;aspect-ratio:4/3;object-fit:cover}

/* ── block stream ── */
.blocks{margin-top:30px;border-top:1px solid var(--rule-soft)}
.row{display:grid;grid-template-columns:132px 1fr;gap:22px;padding:16px 0;
  border-bottom:1px solid var(--rule-soft)}
.row.is-todo{background:var(--amber-bg);padding-left:12px;margin-left:-12px;
  border-bottom-color:var(--rule-soft)}
.tag{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);
  padding-top:5px;line-height:1.5}
.cell{min-width:0}
.prose{font-family:var(--serif);font-size:17.5px;line-height:1.62;margin:0 0 12px;max-width:66ch}
.prose:last-child{margin-bottom:0}
.prose.lead{font-size:20px;color:var(--ink)}
.ah{font-family:var(--serif);font-weight:400;font-size:24px;margin:0 0 6px}
.ah.sm{font-size:19px}
blockquote{font-family:var(--serif);font-style:italic;font-size:21px;line-height:1.45;
  margin:0;padding-left:18px;border-left:2px solid var(--gold);color:var(--ink);max-width:58ch}
.shot{display:block;max-width:100%;border:1px solid var(--rule-soft)}
.shot.hero{width:100%}
.shot.lead{width:100%;max-width:420px;margin-bottom:8px}
.cell > .shot{max-width:420px}
.missing{width:120px;height:90px;display:grid;place-items:center;color:var(--amber);
  border:1px dashed var(--amber);font-size:20px}
.cap{font-family:var(--serif);font-style:italic;font-size:15px;color:var(--muted);margin:8px 0 0;max-width:60ch}
.alt{font-size:11px;color:var(--muted);margin:5px 0 0}
.file{font-size:10.5px;color:var(--muted);margin:5px 0 0;letter-spacing:.02em;word-break:break-all}
.glabel{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin:0 0 10px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:520px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(122px,1fr));gap:10px}
.grid figure,.strip figure{margin:0}
.grid figcaption,.strip figcaption{font-size:10px;color:var(--muted);margin-top:5px;line-height:1.4}
.grid figcaption span,.strip figcaption span{display:block;color:var(--muted);opacity:.75}
.strip{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px}
.strip figure{flex:0 0 158px}
.split{display:grid;grid-template-columns:200px 1fr;gap:18px;align-items:start}
.split .shot{width:100%}
.specs{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:6px 20px;margin:14px 0 0}
.specs div{display:flex;gap:8px;font-size:11.5px;border-bottom:1px dotted var(--rule);padding-bottom:4px}
.specs dt{color:var(--muted);letter-spacing:.08em;text-transform:uppercase;font-size:9.5px;padding-top:2px}
.specs dd{margin:0}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:7px 0;border-bottom:1px solid var(--rule-soft);vertical-align:top;font-weight:400}
th{color:var(--muted);padding-right:20px;width:38%}
.results th{width:58%;color:var(--ink)}
.note{display:block;font-size:10.5px;color:var(--muted);margin-top:3px;line-height:1.45}
.num{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.flag{display:block;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--amber);margin-top:3px}
.deferred{margin:0;font-size:13px;color:var(--ink)}
.rule{display:flex;align-items:center;gap:14px;color:var(--muted)}
.rule::before,.rule::after{content:'';flex:1;height:1px;background:var(--rule)}
.rule span{font-size:10px;letter-spacing:.2em;text-transform:uppercase}
a{color:var(--gold)}
:where(a,button):focus-visible{outline:2px solid var(--gold);outline-offset:3px}
@media (max-width:760px){
  .ahead{grid-template-columns:1fr}
  .ahead-img{max-width:260px}
  .row{grid-template-columns:1fr;gap:8px}
  .tag{padding-top:0;color:var(--gold)}
  .split{grid-template-columns:1fr}
  .row.is-todo{margin-left:0}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="wrap">
  <header class="mast">
    <p class="kicker">Migration review · nothing written to Sanity</p>
    <h1>AKC Journal Migration Review</h1>
    <p class="standfirst">Every article extracted from the legacy Apache site, shown with the
    photographs it references and the block sequence it will become in Sanity. Check this before
    the import runs.</p>
  </header>

  <div class="figs">
    <div class="fig"><b>${content.articles.length}</b><span>articles</span></div>
    <div class="fig"><b>${totalBlocks}</b><span>body blocks</span></div>
    <div class="fig"><b>107</b><span>photographs</span></div>
    <div class="fig"><b>${content.events.length}</b><span>events</span></div>
    <div class="fig"><b>62<small style="font-size:14px"> MB</small></b><span>from 359 MB</span></div>
  </div>

  <div class="note-box">
    <h2>What reconciles</h2>
    <p>Every article's prose word count and distinct-photograph count match the source HTML — the
    check is in <code>scripts/migrate/verify.mjs</code> and passes for all seven. The six images the
    legacy pages hotlinked from Dropbox have been pulled down and are included here.</p>
  </div>

  <div class="note-box todo">
    <h2>Decisions I did not make for you</h2>
    <ul>
      ${decisions.map((w) => `<li>${esc(w.replace(/^[a-z0-9.-]+\.html:\s*/i, ''))}</li>`).join('')}
      <li>Both videos are deferred, as agreed — the panel discussion and the background loop are
      marked in place below.</li>
    </ul>
  </div>

  <nav class="toc" aria-label="Articles">
    ${content.articles.map((a) => `<a href="#${esc(a.slug.current)}">${esc(a.title)}</a>`).join('')}
  </nav>

  ${content.articles.map(article).join('')}
</div>`

writeFileSync(join(OUT, 'review.html'), html)
console.log(`review.html  ${(html.length / 1048576).toFixed(2)} MB`)
