import {createClient} from '@sanity/client'
import {createImageUrlBuilder} from '@sanity/image-url'
import type {SanityImageSource} from '@sanity/image-url'

/**
 * Same project and dataset as the auctions site — one Studio edits both
 * properties. The id and dataset are public values (they appear in every
 * asset URL the browser requests), so they are inlined rather than being
 * read from the environment; that keeps Vercel deploys free of setup.
 *
 * The write token used by the migration scripts is NOT here. It lives in
 * .env.local and is only ever read by scripts/migrate/*.
 */
export const client = createClient({
  projectId: '6cff5w27',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
})

const builder = createImageUrlBuilder(client)

export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}
