/**
 * Prepares every referenced photograph for upload.
 *
 * Two jobs:
 *   1. Pull down the handful of images the legacy pages hotlink from Dropbox.
 *      Those are a live dependency on a personal account with no guarantee of
 *      staying reachable, and one of them already exists locally.
 *   2. Downscale the originals. The source files run to 30 megapixels and
 *      22 MB; the widest srcset this site ever asks for is 2400px. Sanity
 *      would serve resized derivatives either way, so shipping the originals
 *      only buys a slower upload and a larger bill.
 *
 * The full-resolution originals are NOT modified — they stay in the export and
 * in autokulturecollective.zip. This writes copies to out/assets/.
 *
 *   node scripts/migrate/prepare.mjs
 */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs'
import {join, resolve, extname, basename} from 'node:path'
import sharp from 'sharp'

const OUT = resolve(import.meta.dirname, 'out')
const DEST = join(OUT, 'assets')

/** Longest edge kept. Comfortably above the 2400px top of the hero ladder. */
const MAX_EDGE = 3000
const QUALITY = 82

const assets = JSON.parse(readFileSync(join(OUT, 'assets.json'), 'utf8'))
mkdirSync(DEST, {recursive: true})

const mb = (n) => (n / 1048576).toFixed(1)

/** Flatten a source id into a single safe filename. */
function destName(asset) {
  const raw = asset.kind === 'remote'
    ? (decodeURIComponent(asset.url).split('/').pop() || asset.id).split('?')[0]
    : asset.id
  const flat = raw.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '')
  const ext = extname(flat).toLowerCase()
  const stem = basename(flat, extname(flat))
  return `${stem}${['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg'}`
}

async function fetchRemote(url) {
  const res = await fetch(url, {redirect: 'follow'})
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 1024) throw new Error(`suspiciously small (${buf.length} bytes)`)
  return buf
}

let srcTotal = 0
let outTotal = 0
const manifest = []
const failures = []
const seen = new Set()

for (const asset of assets) {
  let name = destName(asset)
  // Two different sources can flatten to the same name; keep them distinct.
  while (seen.has(name)) name = name.replace(/(\.\w+)$/, '-2$1')
  seen.add(name)
  const outPath = join(DEST, name)

  try {
    let input
    if (asset.kind === 'remote') {
      process.stdout.write(`fetching ${name} ... `)
      input = await fetchRemote(asset.url)
      process.stdout.write(`${mb(input.length)} MB\n`)
    } else {
      input = readFileSync(asset.path)
    }
    srcTotal += input.length

    const image = sharp(input, {failOn: 'none'}).rotate() // honour EXIF orientation
    const meta = await image.metadata()
    const longest = Math.max(meta.width || 0, meta.height || 0)

    const pipeline =
      longest > MAX_EDGE
        ? image.resize({width: meta.width >= meta.height ? MAX_EDGE : null,
                        height: meta.height > meta.width ? MAX_EDGE : null,
                        withoutEnlargement: true})
        : image

    const buf = await pipeline.jpeg({quality: QUALITY, mozjpeg: true}).toBuffer()
    writeFileSync(outPath, buf)
    outTotal += buf.length

    manifest.push({
      id: asset.id,
      file: name,
      path: outPath,
      bytes: buf.length,
      width: Math.min(meta.width || 0, longest > MAX_EDGE ? MAX_EDGE : meta.width || 0),
      from: asset.kind,
    })
  } catch (err) {
    failures.push(`${asset.id}: ${err.message}`)
  }
}

writeFileSync(join(OUT, 'prepared.json'), JSON.stringify(manifest, null, 2))
writeFileSync(join(OUT, 'prepare-failures.txt'), failures.join('\n'))

console.log('')
console.log(`prepared    ${manifest.length} / ${assets.length}`)
console.log(`source      ${mb(srcTotal)} MB`)
console.log(`output      ${mb(outTotal)} MB`)
console.log(`saved       ${mb(srcTotal - outTotal)} MB (${((1 - outTotal / srcTotal) * 100).toFixed(0)}%)`)
if (failures.length) {
  console.log(`\nFAILED (${failures.length}):`)
  failures.forEach((f) => console.log('  ' + f))
}
