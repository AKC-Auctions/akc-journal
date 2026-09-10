/**
 * Builds tiny data-URI thumbnails for the review page, so the migrated content
 * can be checked against the images it actually references rather than a list
 * of filenames. Output is a single JSON map: source id -> data URI.
 */
import {readFileSync, writeFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import sharp from 'sharp'

const OUT = resolve(import.meta.dirname, 'out')
const prepared = JSON.parse(readFileSync(join(OUT, 'prepared.json'), 'utf8'))

const thumbs = {}
let bytes = 0

for (const p of prepared) {
  const buf = await sharp(p.path)
    .resize({width: 260, height: 260, fit: 'inside', withoutEnlargement: true})
    .jpeg({quality: 62, mozjpeg: true})
    .toBuffer()
  thumbs[p.id] = `data:image/jpeg;base64,${buf.toString('base64')}`
  bytes += thumbs[p.id].length
}

writeFileSync(join(OUT, 'thumbs.json'), JSON.stringify(thumbs))
console.log(`${prepared.length} thumbnails, ${(bytes / 1048576).toFixed(2)} MB of data URIs`)
