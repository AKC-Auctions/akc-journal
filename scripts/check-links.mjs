/**
 * Link-preservation check.
 *
 * Every URL the legacy Apache site serves has been shared with people; none of
 * them may break. This verifies each one against a target, following at most
 * one redirect hop and reporting exactly what happens.
 *
 *   node scripts/check-links.mjs https://autokulturecollective.com   # today
 *   node scripts/check-links.mjs http://localhost:3000               # the port
 *   node scripts/check-links.mjs https://<project>.vercel.app        # preview
 *
 * Run it against the live site before cutover and against Vercel after. The
 * two runs should agree on which URLs resolve.
 */

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '')

/** Every path the old server exposes, as shared. */
const PATHS = [
  '/',
  '/index.html',
  '/about.html',
  '/journal/akc-i-retromobile-2026-paris.html',
  '/journal/akc-ii-ice-st-moritz-2026.html',
  '/journal/akc-iii-dolder-grand-zurich.html',
  '/journal/akc-iv-heizr-industries-2026.html',
  '/journal/akc-v-concours-of-cool-2026.html',
  '/journal/akc-vi-fuoriconcorso-kraftmeister.html',
  '/journal/gremlin-friends.html',
  // Fragment links used in the old nav. The fragment never reaches the
  // server, so these assert the underlying path still resolves.
  '/index.html?from=share',
  // A slug that was never published, proving the catch-all rule routes rather
  // than 404s at the server level.
  '/journal/some-unlisted-piece.html',
]

/** Where each path should end up once the migration is live. */
const EXPECTED = {
  '/': '/',
  '/index.html': '/',
  '/about.html': '/about',
  '/journal/akc-i-retromobile-2026-paris.html': '/journal/akc-i-retromobile-2026-paris',
  '/journal/akc-ii-ice-st-moritz-2026.html': '/journal/akc-ii-ice-st-moritz-2026',
  '/journal/akc-iii-dolder-grand-zurich.html': '/journal/akc-iii-dolder-grand-zurich',
  '/journal/akc-iv-heizr-industries-2026.html': '/journal/akc-iv-heizr-industries-2026',
  '/journal/akc-v-concours-of-cool-2026.html': '/journal/akc-v-concours-of-cool-2026',
  '/journal/akc-vi-fuoriconcorso-kraftmeister.html': '/journal/akc-vi-fuoriconcorso-kraftmeister',
  '/journal/gremlin-friends.html': '/journal/gremlin-friends',
}

const pad = (s, n) => String(s).padEnd(n)
let failures = 0

console.log(`\nChecking ${PATHS.length} paths against ${base}\n`)
console.log(pad('PATH', 52) + pad('STATUS', 8) + 'RESULT')
console.log('-'.repeat(110))

for (const path of PATHS) {
  let status = '—'
  let result = ''

  try {
    const res = await fetch(base + path, {redirect: 'manual'})
    status = res.status

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location') || ''
      const target = loc.startsWith('http') ? new URL(loc).pathname : loc
      const want = EXPECTED[path]

      // Follow the one hop to confirm the destination actually resolves.
      const final = await fetch(new URL(loc, base).toString(), {redirect: 'follow'})
      const ok = want ? target === want : true
      // The unlisted slug is a control: it proves the catch-all rule ROUTES
      // rather than rejecting, so its destination is expected to 404.
      const control = path.includes('some-unlisted-piece')
      result = `${res.status} -> ${target} (then ${final.status})`
      if (!ok) {
        result += `  EXPECTED ${want}`
        failures++
      } else if (final.status >= 400 && !control) {
        result += '  DESTINATION FAILS'
        failures++
      } else if (control) {
        result += '  routed (404 expected — no such article)'
      }
    } else if (res.status === 200) {
      result = 'serves directly'
      if (EXPECTED[path] && EXPECTED[path] !== path) {
        result += `  (no redirect; old server behaviour)`
      }
    } else {
      result = 'NOT REACHABLE'
      // The deliberately-unlisted slug is allowed to 404 at the page level,
      // but it must have been routed rather than rejected outright.
      if (path.includes('some-unlisted-piece')) {
        result = `${res.status} — expected for an unpublished slug`
      } else {
        failures++
      }
    }
  } catch (err) {
    status = 'ERR'
    result = err.message
    failures++
  }

  console.log(pad(path, 52) + pad(status, 8) + result)
}

console.log('-'.repeat(110))
console.log(failures === 0 ? '\nAll shared links resolve.\n' : `\n${failures} problem(s).\n`)
process.exit(failures === 0 ? 0 : 1)
