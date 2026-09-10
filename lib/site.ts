/** Single source of truth for absolute URLs and brand strings. */
export const SITE_URL = 'https://autokulturecollective.com'

/** The auction reports live on their own subdomain, built from the akc-site repo. */
export const AUCTIONS_URL = 'https://auctions.autokulturecollective.com'

export const INSTAGRAM_URL = 'https://www.instagram.com/autokulturecollective'

export const CONTACT_EMAIL = 'hello@autokulture.co'

/**
 * NOTE — the two properties disagree on the brand's spelling. The auctions
 * site's lib/site.ts mandates the single word "AutoKultureCollective" and
 * says never to use the spaced form; this site's existing copy uses the
 * spaced "AutoKulture Collective" throughout its prose and footer.
 *
 * The migrated copy is left exactly as written rather than silently
 * re-branded. WORDMARK is the single-word form used for the logo and
 * metadata; PROSE_NAME is the spaced form the editorial copy uses.
 * Collapse these once the house style is settled.
 */
export const WORDMARK = 'AutoKultureCollective'
export const PROSE_NAME = 'AutoKulture Collective'

export const SITE_NAME = WORDMARK

export const DEFAULT_DESCRIPTION =
  'AutoKulture Collective documents the events, people, and stories behind ' +
  'European car culture — the auctions, the private viewings, and the ' +
  'gatherings most never get to see.'

export function absoluteUrl(path = '/') {
  return new URL(path, SITE_URL).toString()
}
