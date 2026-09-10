import type {NextConfig} from 'next'

/**
 * Static, non-CSP security headers. Content-Security-Policy is set per request
 * in proxy.ts instead, since it carries a per-request nonce. Mirrors the
 * auctions site so both properties present the same posture.
 */
const securityHeaders = [
  {key: 'X-Frame-Options', value: 'DENY'},
  {key: 'X-Content-Type-Options', value: 'nosniff'},
  {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
  {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'},
  {key: 'Cross-Origin-Opener-Policy', value: 'same-origin'},
]

/**
 * The legacy site served every page with a .html suffix from Apache. Those
 * URLs are indexed and are linked from the auctions subdomain, so each one
 * gets an explicit 308 to its clean equivalent.
 *
 * Enumerated rather than pattern-matched: there are only nine of them, and a
 * mis-written pattern here would silently break inbound links and rankings.
 */
const legacyPages: Array<[string, string]> = [
  ['/index.html', '/'],
  ['/about.html', '/about'],
  ['/journal/akc-i-retromobile-2026-paris.html', '/journal/akc-i-retromobile-2026-paris'],
  ['/journal/akc-ii-ice-st-moritz-2026.html', '/journal/akc-ii-ice-st-moritz-2026'],
  ['/journal/akc-iii-dolder-grand-zurich.html', '/journal/akc-iii-dolder-grand-zurich'],
  ['/journal/akc-iv-heizr-industries-2026.html', '/journal/akc-iv-heizr-industries-2026'],
  ['/journal/akc-v-concours-of-cool-2026.html', '/journal/akc-v-concours-of-cool-2026'],
  ['/journal/akc-vi-fuoriconcorso-kraftmeister.html', '/journal/akc-vi-fuoriconcorso-kraftmeister'],
  ['/journal/gremlin-friends.html', '/journal/gremlin-friends'],
]

const nextConfig: NextConfig = {
  // Don't advertise the framework in every response.
  poweredByHeader: false,

  async headers() {
    return [{source: '/:path*', headers: securityHeaders}]
  },

  async redirects() {
    return [
      // Checked first, so the nine known URLs never depend on pattern matching.
      ...legacyPages.map(([source, destination]) => ({
        source,
        destination,
        permanent: true,
      })),

      // Belt and braces for any /journal/*.html that was shared but is not in
      // the list above — a renamed slug, or a link I never saw. Without this
      // such a URL would 404; with it, it at least reaches the right route.
      {
        source: '/journal/:slug([^/]+)\\.html',
        destination: '/journal/:slug',
        permanent: true,
      },

      // The old Cloudflare email-obfuscation endpoint. Nothing serves it off
      // Cloudflare, so anyone following a stale link lands on the About page
      // rather than a 404.
      {source: '/cdn-cgi/l/email-protection', destination: '/about', permanent: false},
    ]
  },
}

export default nextConfig
