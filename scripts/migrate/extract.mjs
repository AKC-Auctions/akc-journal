/**
 * Legacy static site  ->  normalised JSON for the Sanity import.
 *
 * Read-only against the export in akc-journal-site. Writes two files to
 * scripts/migrate/out/:
 *
 *   content.json  the documents, with image fields holding a source PATH
 *                 rather than a Sanity asset ref; upload.mjs swaps those for
 *                 real refs once the assets exist.
 *   assets.json   every distinct image the content actually references.
 *
 * Anything the walker does not recognise is reported rather than dropped, so
 * a silently missing section is impossible.
 */
import {existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'

const SRC = 'C:/Users/Praveen/akc-journal-site/autokulturecollective'
const OUT = resolve(import.meta.dirname, 'out')

/** Stable keys, so re-running produces the same document rather than churn. */
let keySeed = 0
const key = (hint = '') =>
  createHash('sha1').update(`${hint}:${keySeed++}`).digest('hex').slice(0, 12)

const clean = (s) =>
  (s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const warnings = []
const warn = (file, msg) => warnings.push(`${file}: ${msg}`)

/** Assets referenced by content, keyed by their resolved source path. */
const assets = new Map()

/**
 * Resolves an <img src> to something the uploader can fetch. Local paths become
 * absolute file paths; the handful of Dropbox share links are kept as URLs and
 * flagged, since they are a live dependency on someone else's account.
 */
function resolveAsset(src, pageDir, file) {
  if (!src || src.startsWith('data:')) return null

  if (/^https?:\/\//.test(src)) {
    if (src.includes('dropbox.com')) {
      const id = 'dropbox:' + createHash('sha1').update(src).digest('hex').slice(0, 10)
      if (!assets.has(id)) assets.set(id, {id, kind: 'remote', url: src, from: file})
      return id
    }
    warn(file, `external image left unmigrated: ${src}`)
    return null
  }

  const abs = resolve(pageDir, src)
  if (!existsSync(abs)) {
    warn(file, `missing local image: ${src}`)
    return null
  }
  const id = abs.replace(/\\/g, '/').replace(SRC + '/', '')
  if (!assets.has(id)) assets.set(id, {id, kind: 'local', path: abs, from: file})
  return id
}

/* ── Inline text -> Portable Text spans ────────────────────────────────── */

const MARK_TAGS = {em: 'em', i: 'em', b: 'strong', strong: 'strong'}

/**
 * Walks inline nodes so italics, bold and links survive the move. The legacy
 * prose leans on <em> for emphasis and carries a few real links.
 */
function inlineSpans($, node, active = [], out = [], markDefs = []) {
  $(node)
    .contents()
    .each((_, n) => {
      if (n.type === 'text') {
        const text = (n.data || '').replace(/\u00a0/g, ' ')
        if (text.trim() === '' && out.length === 0) return
        out.push({_type: 'span', _key: key('span'), text, marks: [...active]})
        return
      }
      if (n.type !== 'tag') return

      const tag = n.tagName.toLowerCase()
      if (tag === 'br') {
        out.push({_type: 'span', _key: key('span'), text: '\n', marks: []})
        return
      }
      if (tag === 'a') {
        const href = $(n).attr('href')
        if (href && !href.startsWith('#')) {
          const defKey = key('link')
          markDefs.push({_type: 'link', _key: defKey, href: absoluteLink(href)})
          inlineSpans($, n, [...active, defKey], out, markDefs)
          return
        }
        inlineSpans($, n, active, out, markDefs)
        return
      }
      const mark = MARK_TAGS[tag]
      inlineSpans($, n, mark ? [...active, mark] : active, out, markDefs)
    })
  return {spans: out, markDefs}
}

/** Legacy pages link to their own .html siblings; point those at clean routes. */
function absoluteLink(href) {
  let h = href.trim()
  h = h.replace(/^https?:\/\/(www\.)?autokulturecollective\.com/, '')
  if (h === '' || h === '/') return '/'
  h = h.replace(/^\.\.\//, '/').replace(/^\.\//, '/')
  if (h.startsWith('journal/')) h = '/' + h
  h = h.replace(/index\.html/, '').replace(/\.html(#|$)/, '$1')
  if (h.startsWith('/#')) return h
  return h
}

function textBlock($, el, style = 'normal') {
  const {spans, markDefs} = inlineSpans($, el, [], [], [])
  const kept = spans.filter((s) => s.text !== '')
  if (kept.length === 0) return null
  if (kept.every((s) => s.text.trim() === '')) return null
  return {_type: 'block', _key: key('block'), style, markDefs, children: kept}
}

/* ── Image helpers ─────────────────────────────────────────────────────── */

/**
 * Pulls the real photograph out of a frame. Every legacy frame stacks a
 * blurred placeholder under the full image under a variety of class names;
 * the placeholder is always the one we throw away.
 */
function imageFrom($, scope, pageDir, file) {
  const imgs = $(scope)
    .find('img')
    .addBack('img')
    .toArray()
    .filter((el) => {
      const cls = $(el).attr('class') || ''
      // Article IV defers its hero with data-src and ships an empty src.
      const src = $(el).attr('src') || $(el).attr('data-src') || ''
      if (/blur/.test(cls)) return false
      if (/thumb/.test(cls)) return false
      if (!src || src.startsWith('data:')) return false
      return true
    })
  if (imgs.length === 0) return null
  const el = imgs[0]
  const assetId = resolveAsset($(el).attr('src') || $(el).attr('data-src'), pageDir, file)
  if (!assetId) return null
  const alt = clean($(el).attr('alt'))
  if (!alt) warn(file, `image without alt text: ${$(el).attr('src')}`)
  return {assetId, alt}
}

function captionFrom($, scope) {
  const c = $(scope).find('figcaption, .img-caption, .cinema-cap, .full-bleed-caption, .img-block-cap').first()
  return clean(c.text()) || null
}

const img = (assetId, alt, layout, caption) => ({
  _type: 'journalImage',
  _key: key('img'),
  source: assetId,
  alt: alt || '',
  layout,
  ...(caption ? {caption} : {}),
})

/** Purely structural or decorative wrappers that carry nothing to migrate. */
const SKIP = /\b(cur|cur-r|cursor|progress|mob-nav|section-gap|section-gap-sm|rule|hero-vignette|hero-ov|hero-overlay)\b/

/**
 * Scroll-animation wrappers. They carry no meaning, but they DO wrap real
 * content — articles I and II put every paragraph inside a bare `.rev` div —
 * so they must be walked through rather than skipped.
 */
const TRANSPARENT = /^(rev|fade|vis)(\s+(rev|fade|vis))*$/

/** The homepage tile list, repeated at the foot of a page. The layout rebuilds it. */
const REBUILT = /\b(sl|eg)\b/

/** src, or the deferred data-src that article IV ships instead. */
const imgSrc = ($, el) => $(el).attr('src') || $(el).attr('data-src') || ''

/**
 * Matches `selector` but drops any hit that sits inside another hit.
 *
 * Frames are nested inconsistently — article VI wraps `.frame` in a `figure`,
 * so a naive `.find('figure, .frame')` returns each photograph twice and a
 * two-up pair silently becomes the same image side by side. Only the
 * outermost container of each frame is a real slot.
 */
function outermost($, $scope, selector) {
  const hits = $scope.find(selector).toArray()
  return hits.filter((el) => !hits.some((other) => other !== el && $.contains(other, el)))
}

/** Wrappers whose children are a run of prose rather than a block of their own. */
const PROSE = /\b(text|prose|article-body|page-body|journal|body)\b/

/**
 * Turns one top-level element into zero or more body blocks.
 * `next` lets a handler consume a following sibling — article III puts its
 * captions outside the image div rather than inside it.
 */
function handle($, el, ctx, next) {
  const $el = $(el)
  const cls = $el.attr('class') || ''
  const tag = el.tagName.toLowerCase()
  const {pageDir, file} = ctx
  const out = []

  if (['script', 'style', 'nav', 'footer'].includes(tag)) return {blocks: out}
  if (SKIP.test(cls)) return {blocks: out}
  if (REBUILT.test(cls)) return {blocks: out}

  // Walk straight through animation wrappers to whatever they hold.
  if (TRANSPARENT.test(cls.trim())) {
    $el.children().each((_, child) => {
      out.push(...handle($, child, ctx, null).blocks)
    })
    // A `.rev` that wraps text directly rather than an element still counts.
    if (out.length === 0 && clean($el.text())) {
      const b = textBlock($, el)
      if (b) out.push(b)
    }
    return {blocks: out}
  }

  const consumeCaption = () => {
    if (next && $(next).is('p.img-caption')) {
      const c = clean($(next).text())
      return {caption: c, consumed: true}
    }
    return {caption: null, consumed: false}
  }

  const single = (layout) => {
    const im = imageFrom($, el, pageDir, file)
    if (!im) return {blocks: out}
    let caption = captionFrom($, el)
    let consumed = false
    if (!caption) ({caption, consumed} = consumeCaption())
    out.push(img(im.assetId, im.alt, layout, caption))
    return {blocks: out, consumed}
  }

  const pair = () => {
    const frames = outermost($, $el, '.frame, .gi, figure')
    const picked = (frames.length >= 2 ? frames : $el.children().toArray())
      .map((f) => imageFrom($, f, pageDir, file))
      .filter(Boolean)
    if (picked.length < 2) {
      warn(file, `image pair with ${picked.length} usable image(s) — emitted individually`)
      picked.forEach((p) => out.push(img(p.assetId, p.alt, 'inline', null)))
      return {blocks: out}
    }
    let caption = captionFrom($, el)
    let consumed = false
    if (!caption) ({caption, consumed} = consumeCaption())
    out.push({
      _type: 'imagePair',
      _key: key('pair'),
      images: picked.slice(0, 2).map((p) => img(p.assetId, p.alt, 'inline', null)),
      ...(caption ? {caption} : {}),
    })
    return {blocks: out, consumed}
  }

  // ── Section-scale blocks ──
  if (/\bfull-bleed\b/.test(cls)) return single('fullBleed')
  if (/\bcinema\b/.test(cls)) return single('cinema')
  if (/\bimg-block\b/.test(cls)) return single('feature')
  if (/\binline-img\b/.test(cls)) return single('inline')
  if (/\bportrait\b/.test(cls)) return single('portrait')
  if (/\b(pair|split-imgs|gal-pair)\b/.test(cls)) return pair()

  if (/\baudi-stack\b/.test(cls)) {
    const lead = imageFrom($, $el.children().first(), pageDir, file)
    const row = $el
      .find('.audi-row')
      .children()
      .toArray()
      .map((f) => imageFrom($, f, pageDir, file))
      .filter(Boolean)
    if (lead) {
      out.push({
        _type: 'imageStack',
        _key: key('stack'),
        lead: img(lead.assetId, lead.alt, 'inline', null),
        row: row.map((r) => img(r.assetId, r.alt, 'inline', null)),
      })
    }
    return {blocks: out}
  }

  if (/\bsplit\b/.test(cls) && !/\bsplit-imgs\b/.test(cls)) {
    const im = imageFrom($, $el.find('.split-img'), pageDir, file)
    const body = $el
      .find('.split-body p')
      .toArray()
      .map((p) => textBlock($, p))
      .filter(Boolean)
    const specs = $el
      .find('.split-spec div')
      .toArray()
      .map((d) => ({
        _type: 'spec',
        _key: key('spec'),
        label: clean($(d).find('dt').text()),
        value: clean($(d).find('dd').text()),
      }))
      .filter((s) => s.label || s.value)
    out.push({
      _type: 'splitFeature',
      _key: key('split'),
      ...(im ? {source: im.assetId, alt: im.alt} : {}),
      eyebrow: clean($el.find('.split-eyebrow').text()) || null,
      heading: clean($el.find('.split-h').text()) || null,
      imageSide: 'left',
      body,
      specs,
    })
    return {blocks: out}
  }

  if (/\bcarousel-block\b/.test(cls)) {
    const items = outermost($, $el, '.c-item, .frame, figure, .gi')
      .map((f) => {
        const im = imageFrom($, f, pageDir, file)
        if (!im) return null
        const title = clean($(f).find('.c-item-title').first().text())
        const sub = clean($(f).find('.c-item-sub').first().text())
        const caption = [title, sub].filter(Boolean).join(' · ') || captionFrom($, f)
        return img(im.assetId, im.alt, 'inline', caption)
      })
      .filter(Boolean)
    if (items.length) {
      out.push({
        _type: 'carousel',
        _key: key('carousel'),
        eyebrow: clean($el.find('.carousel-eyebrow').text()) || null,
        items,
      })
    } else {
      warn(file, 'carousel with no usable frames')
    }
    return {blocks: out}
  }

  if (/\bvideo-block\b/.test(cls)) {
    const src = $el.find('source').attr('src') || $el.find('video').attr('src')
    const isAmbient = $el.find('video').attr('autoplay') !== undefined
    out.push({
      _type: 'videoBlock',
      _key: key('video'),
      sourceFile: src ? resolve(pageDir, src).replace(/\\/g, '/') : null,
      label: clean($el.find('.video-label').text()) || null,
      mode: isAmbient ? 'ambient' : 'controls',
    })
    if (src) warn(file, `video needs transcoding before upload: ${src}`)
    return {blocks: out}
  }

  if (/\b(awards|winners)\b/.test(cls)) {
    const rows = $el
      .find('.award-row, .result')
      .toArray()
      .map((r) => {
        const $r = $(r)
        const title = clean($r.find('.award-title, dt').first().text())
        const carEl = $r.find('.award-car, dd').first()
        const note = clean(carEl.find('.award-sub, span').first().text())
        const car = clean(carEl.clone().find('.award-sub, span').remove().end().text())
        return {_type: 'award', _key: key('award'), title, car, ...(note ? {note} : {})}
      })
      .filter((r) => r.title || r.car)
    out.push({
      _type: 'awardsList',
      _key: key('awards'),
      label: clean($el.find('.awards-label').text()) || null,
      heading: clean($el.find('h2').first().text()) || null,
      intro: clean($el.find('.winners-intro').text()) || null,
      rows,
    })
    return {blocks: out}
  }

  if (/\bresults-block\b/.test(cls)) {
    const rows = $el
      .find('.result-item')
      .toArray()
      .map((r) => {
        const $r = $(r)
        const price = clean($r.find('.result-price').text())
        const currency = (price.match(/\b(CHF|EUR|GBP|USD)\b/) || [])[1] || null
        // Deliberately no `basis`. The legacy markup never states whether a
        // figure is hammer or total paid, and guessing is exactly the error
        // the auctions-site audit called out. Reported instead.
        if (price) warn(file, `price needs an explicit basis: ${clean($r.find('.result-car').text())} — ${price}`)
        return {
          _type: 'result',
          _key: key('result'),
          car: clean($r.find('.result-car').text()),
          detail: clean($r.find('.result-detail').html()?.replace(/<br\s*\/?>/gi, '\n') || ''),
          price,
          ...(currency ? {currency} : {}),
        }
      })
      .filter((r) => r.car)
    out.push({
      _type: 'resultsList',
      _key: key('results'),
      label: clean($el.find('.results-header').text()) || null,
      rows,
      footnote: clean($el.find('.results-footer').text()) || null,
    })
    return {blocks: out}
  }

  if (/\b(gal-section|gallery-section|gallery-block|gal-stack)\b/.test(cls)) {
    // Both naming conventions for "a two-up row inside the gallery".
    const hasRows = $el.find('.gi-row, .gal-pair').length > 0
    const items = outermost($, $el, '.gi, .gal-item, .c-item, figure')
      .map((g) => {
        const $g = $(g)
        const full = $g.find('.gi-full, .img-main, img').toArray().find((i) => {
          const c = $(i).attr('class') || ''
          const s = imgSrc($, i)
          return !/blur|thumb/.test(c) && s && !s.startsWith('data:')
        })
        if (!full) return null
        const assetId = resolveAsset(imgSrc($, full), pageDir, file)
        if (!assetId) return null
        return {
          _type: 'galleryItem',
          _key: key('gi'),
          source: assetId,
          alt: clean($(full).attr('alt')),
          title:
            clean($g.find('.gct, .gal-item-title, .c-item-title').first().text()) || null,
          subtitle:
            clean($g.find('.gcs, .gal-item-sub, .c-item-sub, .c-item-cap').first().text()) || null,
        }
      })
      .filter(Boolean)
    if (items.length) {
      out.push({
        _type: 'gallery',
        _key: key('gallery'),
        label: clean($el.find('.gal-label, .gallery-eyebrow, .gallery-sub, .sl').first().text()) || null,
        layout: hasRows ? 'rhythm' : 'grid',
        items,
      })
    } else {
      warn(file, 'gallery section produced no frames')
    }
    return {blocks: out}
  }

  if (/\bdivider\b/.test(cls)) {
    out.push({
      _type: 'divider',
      _key: key('divider'),
      label: clean($el.find('.divider-mark').text()) || null,
    })
    return {blocks: out}
  }

  if (/\b(pull|pullquote|pull-text)\b/.test(cls)) {
    const b = textBlock($, el, 'blockquote')
    if (b) out.push(b)
    return {blocks: out}
  }

  if (/\barticle-end\b/.test(cls)) {
    return {blocks: out} // colophon; rebuilt by the layout
  }

  // `section.feature` is a heading + framed image + prose. It decomposes into
  // blocks we already have rather than needing a type of its own.
  if (/\bfeature\b/.test(cls) && tag === 'section') {
    const h = $el.find('h2').first()
    if (h.length) {
      const b = textBlock($, h[0], 'h2')
      if (b) out.push(b)
    }
    const fig = $el.find('figure').first()
    if (fig.length) {
      const im = imageFrom($, fig, pageDir, file)
      if (im) out.push(img(im.assetId, im.alt, 'feature', captionFrom($, fig)))
    }
    $el.find('p').each((_, p) => {
      const b = textBlock($, p)
      if (b) out.push(b)
    })
    return {blocks: out}
  }

  // ── Prose containers ──
  if (PROSE.test(cls) || tag === 'article') {
    $el.children().each((_, child) => {
      const ctag = child.tagName.toLowerCase()
      const ccls = $(child).attr('class') || ''
      if (SKIP.test(ccls) || ['script', 'style'].includes(ctag)) return
      // Article hero furniture lives inside `.body` on articles I and II.
      if (/\b(ey|sub|meta)\b/.test(ccls) || ctag === 'h1') return

      if (ctag === 'p') {
        const style = /\b(intro|lead)\b/.test(ccls) ? 'lead' : 'normal'
        const b = textBlock($, child, style)
        if (b) out.push(b)
        return
      }
      if (['h2', 'h3'].includes(ctag)) {
        const b = textBlock($, child, ctag)
        if (b) out.push(b)
        return
      }
      const nested = handle($, child, ctx, null)
      out.push(...nested.blocks)
    })
    return {blocks: out}
  }

  if (tag === 'figure') return single(/\bsmall\b/.test(cls) ? 'portrait' : 'inline')
  if (tag === 'p') {
    const b = textBlock($, el)
    if (b) out.push(b)
    return {blocks: out}
  }
  if (['h2', 'h3'].includes(tag)) {
    const b = textBlock($, el, tag)
    if (b) out.push(b)
    return {blocks: out}
  }

  if (clean($el.text()) || $el.find('img').length) {
    warn(file, `unhandled <${tag} class="${cls}"> — ${clean($el.text()).slice(0, 60)}`)
  }
  return {blocks: out}
}

export {handle, resolveAsset, imageFrom, captionFrom, textBlock, clean, key, warn, warnings, assets, SRC, OUT}

