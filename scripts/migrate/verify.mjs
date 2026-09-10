/**
 * Migration check. Compares the extracted documents against the legacy HTML so
 * a silent loss shows up as a number rather than being noticed months later.
 *
 * Prose is compared on word count of the source's own body containers versus
 * the Portable Text blocks; images on the count of distinct photographs
 * referenced. Read-only.
 */
import {readFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import * as cheerio from 'cheerio'

const SRC = 'C:/Users/Praveen/akc-journal-site/autokulturecollective'
const OUT = resolve(import.meta.dirname, 'out')
const {articles} = JSON.parse(readFileSync(join(OUT, 'content.json'), 'utf8'))

const words = (s) => (s || '').split(/\s+/).filter(Boolean).length

/** Every span of text the block model holds, at any nesting depth. */
function blockText(blocks) {
  let out = ''
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (v && typeof v === 'object') {
      if (v._type === 'span' && typeof v.text === 'string') out += ' ' + v.text
      for (const [k, val] of Object.entries(v)) {
        if (k === 'text' && v._type === 'span') continue
        if (['caption', 'alt', 'title', 'subtitle', 'label', 'heading', 'intro',
             'eyebrow', 'car', 'detail', 'price', 'note', 'footnote', 'value'].includes(k)
            && typeof val === 'string') {
          out += ' ' + val
        } else walk(val)
      }
    }
  }
  walk(blocks)
  return out
}

/**
 * The containers the legacy pages actually put prose inside. `.page-body` is
 * matched on direct children only — the placeholder page repeats the journal
 * tile list inside one, and each tile's date is a <p> that is not prose.
 */
const PROSE_SEL =
  '.text p, .prose p, .article-body p, article.journal p, .page-body > p, .split-body p, .feature p'

let bad = 0
console.log(
  'article'.padEnd(38) + 'src words'.padStart(10) + 'out words'.padStart(10) +
  'src imgs'.padStart(9) + 'out imgs'.padStart(9) + '  status'
)

for (const a of articles) {
  const slug = a.slug.current
  const html = readFileSync(join(SRC, 'journal', `${slug}.html`), 'utf8')
  const $ = cheerio.load(html)

  const srcWords = words(
    $(PROSE_SEL).toArray().map((p) => $(p).text()).join(' ').replace(/\s+/g, ' ')
  )
  const outWords = words(blockText(a.body).replace(/\s+/g, ' '))

  // Distinct non-placeholder photographs in the source.
  const srcImgs = new Set(
    $('img').toArray()
      .filter((i) => {
        const c = $(i).attr('class') || ''
        const s = $(i).attr('src') || $(i).attr('data-src') || ''
        return !/blur|thumb|cimg/.test(c) && s && !s.startsWith('data:')
      })
      .map((i) => ($(i).attr('src') || $(i).attr('data-src')).split('/').pop())
  )
  const outImgs = new Set()
  const collect = (v) => {
    if (Array.isArray(v)) return v.forEach(collect)
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if ((k === 'source' || k === 'heroSource') && typeof val === 'string') {
          outImgs.add(val.split('/').pop())
        } else collect(val)
      }
    }
  }
  collect(a.body)
  if (a.heroSource) outImgs.add(a.heroSource.split('/').pop())

  // Prose within 2% is fine — entities and whitespace differ slightly.
  const proseOk = srcWords === 0 || outWords >= srcWords * 0.98
  const imgOk = outImgs.size >= srcImgs.size
  const status = proseOk && imgOk ? 'ok' : `MISMATCH${proseOk ? '' : ' prose'}${imgOk ? '' : ' images'}`
  if (!proseOk || !imgOk) bad++

  console.log(
    slug.padEnd(38) + String(srcWords).padStart(10) + String(outWords).padStart(10) +
    String(srcImgs.size).padStart(9) + String(outImgs.size).padStart(9) + '  ' + status
  )

  if (!imgOk) {
    const missing = [...srcImgs].filter((s) => ![...outImgs].some((o) => o === s))
    if (missing.length) console.log('      missing: ' + missing.slice(0, 8).join(', '))
  }
}

console.log(bad === 0 ? '\nAll articles reconcile.' : `\n${bad} article(s) need attention.`)
process.exit(bad === 0 ? 0 : 1)
