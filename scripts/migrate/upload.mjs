/**
 * Uploads the prepared assets and writes the Journal documents into Sanity.
 *
 * DRY RUN BY DEFAULT. Nothing is written without --commit:
 *
 *   node --env-file=.env.local scripts/migrate/upload.mjs            # plan only
 *   node --env-file=.env.local scripts/migrate/upload.mjs --commit   # write
 *
 * Safe to re-run. Assets are content-addressed by Sanity, so re-uploading the
 * same bytes returns the existing asset rather than duplicating it, and the
 * documents use deterministic _ids with createOrReplace.
 *
 * This writes to the same dataset that serves the live auctions site. It only
 * ADDS journal* documents and image assets — no existing document is read,
 * modified or deleted.
 */
import {readFileSync, writeFileSync, existsSync, createReadStream} from 'node:fs'
import {join, resolve} from 'node:path'
import {createClient} from '@sanity/client'

const OUT = resolve(import.meta.dirname, 'out')
const COMMIT = process.argv.includes('--commit')

const token = process.env.SANITY_API_TOKEN
if (!token) {
  console.error('SANITY_API_TOKEN missing. Run with: node --env-file=.env.local ...')
  process.exit(1)
}

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '6cff5w27',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token,
  useCdn: false,
})

const content = JSON.parse(readFileSync(join(OUT, 'content.json'), 'utf8'))
const prepared = JSON.parse(readFileSync(join(OUT, 'prepared.json'), 'utf8'))

/* ── Assets ────────────────────────────────────────────────────────────── */

const assetRefs = new Map() // source id -> Sanity asset _id

/**
 * Uploaded asset ids are written to disk as they land. A hundred-file upload
 * over a home connection will drop occasionally — this one died at 100/107
 * with ECONNRESET — and losing the whole run to a transient socket error is
 * pointless when Sanity content-addresses assets anyway.
 */
const REFS_FILE = join(OUT, 'asset-refs.json')

function loadRefs() {
  if (!existsSync(REFS_FILE)) return
  const saved = JSON.parse(readFileSync(REFS_FILE, 'utf8'))
  for (const [k, v] of Object.entries(saved)) assetRefs.set(k, v)
}

function saveRefs() {
  writeFileSync(REFS_FILE, JSON.stringify(Object.fromEntries(assetRefs), null, 2))
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Transient network faults are the norm at this volume, not the exception. */
async function withRetry(label, fn, attempts = 4) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      const transient =
        /ECONNRESET|ETIMEDOUT|ENOTFOUND|EPIPE|socket hang up|fetch failed/i.test(
          `${err.message} ${err.cause?.code ?? ''}`
        )
      if (!transient || i === attempts) throw err
      const wait = 1000 * 2 ** (i - 1)
      process.stdout.write(`\n  ${label}: ${err.cause?.code ?? err.message} — retry ${i}/${attempts - 1} in ${wait / 1000}s\n`)
      await sleep(wait)
    }
  }
}

async function uploadAll() {
  if (COMMIT) loadRefs()

  let n = 0
  let fresh = 0
  let reused = 0

  for (const p of prepared) {
    n++
    if (!COMMIT) {
      assetRefs.set(p.id, `image-DRYRUN-${n}`)
      continue
    }
    if (assetRefs.has(p.id)) {
      reused++
      continue
    }

    const asset = await withRetry(p.file, () =>
      client.assets.upload('image', createReadStream(p.path), {
        filename: p.file,
        // Sanity dedupes on content hash; this label just makes the origin
        // legible in the Studio's media browser.
        label: 'legacy-journal',
      })
    )
    assetRefs.set(p.id, asset._id)
    saveRefs()
    fresh++
    process.stdout.write(`\ruploaded ${n}/${prepared.length}  ${p.file.slice(0, 44).padEnd(46)}`)
  }

  if (COMMIT) {
    process.stdout.write('\n')
    console.log(`            ${fresh} uploaded, ${reused} already present`)
  }
}

/* ── Source paths -> image refs ────────────────────────────────────────── */

const missing = new Set()

function imageRef(sourceId) {
  const ref = assetRefs.get(sourceId)
  if (!ref) {
    missing.add(sourceId)
    return null
  }
  return {_type: 'image', asset: {_type: 'reference', _ref: ref}}
}

/**
 * Walks the extracted tree swapping every `source` path for a real image
 * field. The extractor deliberately left paths in place so this step could be
 * re-run without re-parsing the HTML.
 */
function hydrate(node) {
  if (Array.isArray(node)) return node.map(hydrate).filter((n) => n !== null)
  if (!node || typeof node !== 'object') return node

  const out = {}
  for (const [k, v] of Object.entries(node)) {
    if (k === 'source' && typeof v === 'string') {
      const img = imageRef(v)
      if (img) out.image = img
      continue
    }
    if (k === 'heroSource' && typeof v === 'string') {
      const img = imageRef(v)
      if (img) out.heroImage = img
      continue
    }
    if (k === 'cardSource' && typeof v === 'string') {
      const img = imageRef(v)
      if (img) out.cardImage = img
      continue
    }
    if (k === 'sourceFile') continue // video; handled separately once transcoded
    out[k] = hydrate(v)
  }
  return out
}

/** Alt text lives beside the image on the parent object in this schema. */
function foldAlt(doc) {
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object') return
    if (n.heroImage && n.heroAlt) {
      n.heroImage.alt = n.heroAlt
      delete n.heroAlt
    }
    if (n.cardImage && n.cardAlt) {
      n.cardImage.alt = n.cardAlt
      delete n.cardAlt
    }
    Object.values(n).forEach(walk)
  }
  walk(doc)
  return doc
}

/* ── Documents ─────────────────────────────────────────────────────────── */

function buildDocs() {
  const docs = []

  for (const a of content.articles) {
    const doc = foldAlt(hydrate(a))
    // Drop nulls so Sanity does not store empty keys.
    for (const k of Object.keys(doc)) if (doc[k] === null) delete doc[k]
    docs.push(doc)
  }

  const home = hydrate(content.home)
  docs.push({
    _id: 'homePage',
    _type: 'homePage',
    eyebrow: home.eyebrow,
    headline: htmlToBlocks(home.headlineHtml),
    standfirst: home.standfirst,
    established: home.established,
    places: home.places,
    tickerItems: home.tickerItems,
    aboutLabel: home.aboutLabel,
    aboutHeading: htmlToBlocks(home.aboutHeadingHtml),
    aboutBody: (home.aboutBody || []).map((t, i) => textToBlock(t, `ab${i}`)),
    seoDescription: home.seoDescription,
  })

  const about = foldAlt(hydrate(content.about))
  docs.push({
    _id: 'aboutPage',
    _type: 'aboutPage',
    eyebrow: about.eyebrow,
    title: about.title,
    heroImage: about.heroImage,
    body: (about.paragraphs || []).map((t, i) => textToBlock(t, `ap${i}`)),
    seoDescription: about.seoDescription,
  })

  content.events.forEach((e) => docs.push(e))
  return docs
}

/** Minimal HTML -> blocks, for the two headline fields that carry <em>. */
function htmlToBlocks(html) {
  if (!html) return []
  const children = []
  const re = /<em>(.*?)<\/em>|<br\s*\/?>|([^<]+)/gi
  let m
  let i = 0
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) {
      children.push({_type: 'span', _key: `h${i++}`, text: decode(m[1]), marks: ['em']})
    } else if (m[2] !== undefined) {
      const t = decode(m[2])
      if (t) children.push({_type: 'span', _key: `h${i++}`, text: t, marks: []})
    } else {
      children.push({_type: 'span', _key: `h${i++}`, text: '\n', marks: []})
    }
  }
  return [{_type: 'block', _key: 'hl', style: 'normal', markDefs: [], children}]
}

const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&rsquo;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')

const textToBlock = (text, k) => ({
  _type: 'block',
  _key: k,
  style: 'normal',
  markDefs: [],
  children: [{_type: 'span', _key: k + 's', text, marks: []}],
})

/* ── Run ───────────────────────────────────────────────────────────────── */

console.log(COMMIT ? 'COMMIT — writing to Sanity\n' : 'DRY RUN — nothing will be written\n')
console.log(`dataset     ${client.config().dataset} (project ${client.config().projectId})`)
console.log(`assets      ${prepared.length}`)

await uploadAll()

const docs = buildDocs()
console.log(`documents   ${docs.length}`)
for (const d of docs) {
  const label = d.title || d.name || d._id
  console.log(`  ${d._type.padEnd(16)} ${String(d._id).padEnd(38)} ${label ?? ''}`)
}

if (missing.size) {
  console.log(`\n${missing.size} image reference(s) had no prepared file:`)
  ;[...missing].slice(0, 10).forEach((m) => console.log('  ' + m))
}

if (!COMMIT) {
  console.log('\nRe-run with --commit to write.')
  process.exit(0)
}

const tx = docs.reduce((t, d) => t.createOrReplace(d), client.transaction())
await withRetry('document transaction', () => tx.commit())
console.log(`\nWrote ${docs.length} documents.`)
