import {NextResponse} from 'next/server'
import type {NextRequest} from 'next/server'

/**
 * Nonce-based CSP.
 *
 * Next.js 16 renamed Middleware to Proxy; the file must be `proxy.ts` at the
 * project root. Behaviour is unchanged from the Middleware equivalent on the
 * auctions site — a per-request nonce is threaded through request headers so
 * Server Components can read it via next/headers, and Next's own injected
 * <script> tags pick it up because it appears in this response's CSP header.
 *
 * Every external origin the site loads from a browser:
 * - Sanity's CDN, for all photography (img-src) and the journal video assets
 *   (media-src). Nothing else is fetched cross-origin.
 * - Fonts are self-hosted by next/font at build time, so neither
 *   fonts.googleapis.com nor fonts.gstatic.com needs listing — unlike the
 *   legacy static site, which pulled both at runtime.
 * - No analytics, no third-party scripts, no iframes.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  /**
   * React's development build calls eval() for its debugging features, and the
   * dev server pushes updates over a websocket. Both are blocked by the policy
   * below, which left `next dev` rendering a half-hydrated page. Neither is
   * needed by the production build, so the allowance is scoped to dev rather
   * than weakening what actually ships.
   */
  const isDev = process.env.NODE_ENV === 'development'

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "img-src 'self' data: https://cdn.sanity.io",
    "media-src 'self' https://cdn.sanity.io",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({request: {headers: requestHeaders}})
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    /*
     * Run on every route except static assets and image-optimizer requests,
     * which don't render HTML and don't need a nonce.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
