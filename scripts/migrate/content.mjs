/**
 * Drives the extraction. Reads the legacy export, writes normalised documents
 * plus an asset manifest to scripts/migrate/out/. Read-only against the source
 * and against Sanity — nothing is uploaded here.
 *
 *   node --env-file=.env.local scripts/migrate/content.mjs
 */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs'
import {join, dirname} from 'node:path'
import * as cheerio from 'cheerio'
import {handle, imageFrom, clean, warn, warnings, assets, SRC, OUT} from './extract.mjs'

/**
 * Per-article facts that the markup states inconsistently or not at all.
 * publishDate is ISO for sorting; dateLabel preserves how each article
 * actually words its own date.
 */
const ARTICLES = [
  {
    file: 'akc-i-retromobile-2026-paris.html',
    slug: 'akc-i-retromobile-2026-paris',
    publishDate: '2026-01-15',
    dateLabel: 'Jan 2026',
    location: 'Paris',
  },
  {
    file: 'akc-ii-ice-st-moritz-2026.html',
    slug: 'akc-ii-ice-st-moritz-2026',
    publishDate: '2026-01-24',
    dateLabel: 'Jan 2026',
    location: 'St. Moritz',
  },
  {
    file: 'akc-iii-dolder-grand-zurich.html',
    slug: 'akc-iii-dolder-grand-zurich',
    publishDate: '2025-10-31',
    dateLabel: 'Oct 2025',
    location: 'Zürich',
  },
  {
    file: 'akc-iv-heizr-industries-2026.html',
    slug: 'akc-iv-heizr-industries-2026',
    publishDate: '2026-05-03',
    dateLabel: '3 May 2026',
    location: 'Metzingen',
    // The only article that genuinely set a larger body scale:
    // .prose p is clamp(20px,1.45vw,24px)/1.82 inside a 660px measure.
    density: 'generous',
  },
  {
    file: 'akc-v-concours-of-cool-2026.html',
    slug: 'akc-v-concours-of-cool-2026',
    publishDate: '2026-05-10',
    dateLabel: 'May 2026',
    location: 'Munich',
  },
  {
    file: 'akc-vi-fuoriconcorso-kraftmeister.html',
    slug: 'akc-vi-fuoriconcorso-kraftmeister',
    publishDate: '2026-05-24',
    dateLabel: 'May 2026',
    location: 'Lake Como',
  },
  {
    file: 'gremlin-friends.html',
    slug: 'gremlin-friends',
    publishDate: '2026-06-01',
    dateLabel: null,
    location: null,
    status: 'inPreparation',
  },
]

/**
 * First non-empty match. Line breaks become spaces rather than vanishing —
 * article IV's headline is "Car Culture,<br>Done Right." and would otherwise
 * read "Car Culture,Done Right."
 */
const first = ($, sels) => {
  for (const s of sels) {
    const el = $(s).first()
    if (!el.length) continue
    const html = (el.html() || '').replace(/<br\s*\/?>/gi, ' ')
    const t = clean($('<div>' + html + '</div>').text())
    if (t) return t
  }
  return null
}

/** The hero sits under four different shapes across the seven articles. */
function extractHero($, pageDir, file) {
  const scope = $('.hero-img, section.hero, header.article-hero, header.page-hero').first()
  const image = scope.length ? imageFrom($, scope, pageDir, file) : null
  return {
    image,
    eyebrow: first($, [
      '.ey',
      '.article-tag',
      '.page-eyebrow',
      '.hero-head .meta',
      '.hero-meta',
      '.hero-body .hero-meta',
    ]),
    title: first($, ['.hero-title', '.page-h1', 'h1']),
    subtitle: first($, ['.sub', '.hero-subtitle', '.subtitle', '.hero-sub']),
    byline: first($, ['.meta .mi:last-child']),
  }
}

/** Body elements to walk: everything that is not chrome. */
function bodyElements($) {
  return $('body')
    .children()
    .toArray()
    .filter((el) => {
      const tag = el.tagName.toLowerCase()
      if (['script', 'style', 'nav', 'footer'].includes(tag)) return false
      const cls = $(el).attr('class') || ''
      const id = $(el).attr('id') || ''
      if (/\b(cur|cur-r|cursor|progress)\b/.test(cls)) return false
      if (/mob-nav/.test(id) || /mob-nav/.test(cls)) return false
      // The hero is pulled out separately.
      if (/\b(hero-img|article-hero|page-hero)\b/.test(cls)) return false
      if (el.tagName === 'section' && /\bhero\b/.test(cls) && !/gal|split/.test(cls)) return false
      return true
    })
}

function extractArticle(meta) {
  const path = join(SRC, 'journal', meta.file)
  const html = readFileSync(path, 'utf8')
  const $ = cheerio.load(html)
  const pageDir = dirname(path)
  const ctx = {pageDir, file: meta.file}

  const hero = extractHero($, pageDir, meta.file)
  const els = bodyElements($)

  const body = []
  for (let i = 0; i < els.length; i++) {
    const el = els[i]
    const {blocks, consumed} = handle($, el, ctx, els[i + 1] || null)
    body.push(...blocks)
    if (consumed) i++ // a sibling caption was folded into the block above
  }

  // Articles I and II keep the hero furniture inside the first `.body`, so the
  // walker has already skipped it; nothing else should be lost.
  if (body.length === 0 && meta.status !== 'inPreparation') {
    warn(meta.file, 'produced an empty body')
  }

  return {
    _type: 'journalArticle',
    _id: `journal-${meta.slug}`,
    title: hero.title,
    slug: {_type: 'slug', current: meta.slug},
    status: meta.status || 'published',
    /**
     * Article VI is the exception worth naming: its body paragraphs carry no
     * font-size or line-height rule anywhere in the legacy CSS, so they fall
     * back to a 16px browser default in a face with a small x-height. That is
     * an oversight rather than a decision, so it inherits the standard scale
     * its sibling article V uses rather than having the bug preserved.
     */
    density: meta.density || 'standard',
    eyebrow: hero.eyebrow,
    subtitle: hero.subtitle,
    heroSource: hero.image?.assetId || null,
    heroAlt: hero.image?.alt || null,
    publishDate: meta.publishDate,
    dateLabel: meta.dateLabel,
    location: meta.location,
    author: 'Praveen · AKC',
    seoDescription: clean($('meta[name="description"]').attr('content')),
    body,
  }
}

/* ── Homepage: journal cards, ticker, events, about strip ──────────────── */

function extractHome() {
  const path = join(SRC, 'index.html')
  const html = readFileSync(path, 'utf8')
  const $ = cheerio.load(html)
  const pageDir = dirname(path)

  const cards = $('.eg .card')
    .toArray()
    .map((c) => {
      const $c = $(c)
      const href = $c.attr('href') || ''
      const slug = href.replace(/^.*journal\//, '').replace(/\.html$/, '')
      const im = imageFrom($, c, pageDir, 'index.html')
      return {
        slug,
        cardCategory: clean($c.find('.ct').text()) || null,
        cardTitle: clean($c.find('.ch').text()) || null,
        cardMeta: clean($c.find('.cm').text()) || null,
        cardSource: im?.assetId || null,
        cardAlt: im?.alt || null,
      }
    })
    .filter((c) => c.slug)

  const events = $('.evs .ei')
    .toArray()
    .map((e, i) => ({
      _type: 'eventEntry',
      _id: `event-${i + 1}`,
      dateLabel: clean($(e).find('.ed').text()),
      name: clean($(e).find('.en').text()),
      tag: clean($(e).find('.etg').text()) || 'Attended',
    }))
    .filter((e) => e.name)

  const headline = $('.ht').first()
  const home = {
    _type: 'homePage',
    _id: 'homePage',
    eyebrow: clean($('.hey').text()),
    headlineHtml: headline.html(),
    standfirst: clean($('.hs').text()),
    established: clean($('.hm span').first().text()),
    places: clean($('.hm span').last().text()),
    tickerItems: [
      ...new Set($('.mqi span').toArray().map((s) => clean($(s).text())).filter(Boolean)),
    ],
    aboutLabel: clean($('.al .sl').text()),
    aboutHeadingHtml: $('.al h2').html(),
    aboutBody: $('.ar p').toArray().map((p) => clean($(p).text())),
    seoDescription: clean($('meta[name="description"]').attr('content')),
  }

  return {home, cards, events}
}

function extractAbout() {
  const path = join(SRC, 'about.html')
  const html = readFileSync(path, 'utf8')
  const $ = cheerio.load(html)
  const pageDir = dirname(path)
  const im = imageFrom($, $('.about-hero').first(), pageDir, 'about.html')

  return {
    _type: 'aboutPage',
    _id: 'aboutPage',
    eyebrow: clean($('.about-hero-eyebrow').text()),
    title: clean($('.about-hero-h1').text()) || 'About AKC',
    heroSource: im?.assetId || null,
    heroAlt: im?.alt || null,
    paragraphs: $('.about-body p').toArray().map((p) => clean($(p).text())),
    seoDescription: clean($('meta[name="description"]').attr('content')),
  }
}

/* ── Run ───────────────────────────────────────────────────────────────── */

mkdirSync(OUT, {recursive: true})

const articles = ARTICLES.map(extractArticle)
const {home, cards, events} = extractHome()
const about = extractAbout()

// Fold the homepage card copy onto its article.
for (const card of cards) {
  const a = articles.find((x) => x.slug.current === card.slug)
  if (!a) {
    warn('index.html', `card links to an unknown article: ${card.slug}`)
    continue
  }
  Object.assign(a, {
    cardCategory: card.cardCategory,
    cardTitle: card.cardTitle,
    cardMeta: card.cardMeta,
    cardSource: card.cardSource,
    cardAlt: card.cardAlt,
    featured: true,
  })
  // The card and the article sometimes disagree about when the event was.
  const cardMonth = (card.cardMeta || '').match(/([A-Z][a-z]{2})\s+(\d{4})/)
  if (cardMonth && a.dateLabel && !a.dateLabel.includes(cardMonth[1])) {
    warn(
      'index.html',
      `card says "${card.cardMeta}" but ${a.slug.current} states "${a.dateLabel}" — both kept, needs a decision`
    )
  }
}
articles.forEach((a, i) => {
  if (a.featured === undefined) a.featured = false
  a.order = i + 1
})

const payload = {articles, home, about, events, assets: [...assets.values()]}
writeFileSync(join(OUT, 'content.json'), JSON.stringify(payload, null, 2))
writeFileSync(join(OUT, 'assets.json'), JSON.stringify([...assets.values()], null, 2))
writeFileSync(join(OUT, 'warnings.txt'), warnings.join('\n'))

const blockCount = articles.reduce((n, a) => n + a.body.length, 0)
console.log(`articles      ${articles.length}`)
console.log(`body blocks   ${blockCount}`)
console.log(`events        ${events.length}`)
console.log(`assets        ${assets.size}`)
console.log(`warnings      ${warnings.length}  -> out/warnings.txt`)
for (const a of articles) {
  const types = a.body.reduce((m, b) => ({...m, [b._type]: (m[b._type] || 0) + 1}), {})
  console.log(
    `  ${a.slug.current.padEnd(36)} ${String(a.body.length).padStart(3)} blocks  ` +
      Object.entries(types).map(([t, n]) => `${t}:${n}`).join(' ')
  )
}
