/**
 * Structural probe. Prints the top-level shape of each legacy journal page so
 * the extractor can be written against what is actually there rather than a
 * guess. Read-only; safe to re-run.
 */
import {readFileSync, readdirSync} from 'node:fs'
import {join} from 'node:path'
import * as cheerio from 'cheerio'

const SRC = 'C:/Users/Praveen/akc-journal-site/autokulturecollective'

const describe = (el, $) => {
  const tag = el.tagName
  const cls = ($(el).attr('class') || '').trim()
  const id = $(el).attr('id')
  const kids = $(el).children().length
  const text = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 48)
  return `${tag}${id ? '#' + id : ''}${cls ? '.' + cls.split(/\s+/).join('.') : ''}` +
    `  (${kids} kids)  ${text ? '“' + text + '”' : ''}`
}

const files = readdirSync(join(SRC, 'journal')).filter((f) => f.endsWith('.html'))

for (const f of files) {
  const html = readFileSync(join(SRC, 'journal', f), 'utf8')
  const $ = cheerio.load(html)
  console.log('\n' + '='.repeat(78))
  console.log(f)
  console.log('='.repeat(78))
  $('body').children().each((_, el) => {
    if (['script', 'style'].includes(el.tagName)) return
    console.log('  ' + describe(el, $))
    // One level down, for the wrappers that hold the run of prose.
    const cls = ($(el).attr('class') || '')
    if (/\b(body|text|page-body|article-body|prose)\b/.test(cls)) {
      $(el).children().each((__, k) => {
        if (['script', 'style'].includes(k.tagName)) return
        console.log('      └ ' + describe(k, $))
      })
    }
  })
}
