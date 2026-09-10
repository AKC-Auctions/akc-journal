import {urlFor} from '@/sanity/client'
import type {SanityImageSource} from '@sanity/image-url'

/**
 * Images are served straight from Sanity's CDN via srcset rather than through
 * next/image. Two reasons: it matches what the auctions site already does, and
 * it keeps every transform off Vercel's image optimizer, whose Hobby-plan
 * quota this site's photography volume would otherwise eat through.
 *
 * The legacy pages faked progressive loading by stacking a blurred base64
 * thumbnail under the real photograph. Sanity produces the same thing as LQIP
 * metadata, so that effect survives without hand-pasting data URIs.
 */

/** Width ladders per context. The point is to stop sending a 2400px hero to a phone. */
export const WIDTHS = {
  /** Journal tile on the homepage — a 3:4 portrait card. */
  card: [400, 640, 800, 1200],
  /** Full-viewport article and about heroes. */
  hero: [768, 1280, 1920, 2400],
  /** Frames set inside the text column. */
  inline: [640, 960, 1280, 1600],
  /** Edge-to-edge frames and cinema crops. */
  fullBleed: [768, 1280, 1920, 2400],
  /** Two-up rows and the paired gallery rhythm. */
  pair: [480, 800, 1200, 1600],
  /** The tall image beside a split feature. */
  split: [640, 960, 1280, 1600],
  /** Horizontally scrolling strip. */
  carousel: [480, 800, 1200],
} as const

/** Common `sizes` values, kept together so they stay consistent. */
export const SIZES = {
  full: '100vw',
  /** Four-up journal grid above lg, two-up at sm, one below. */
  card: '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw',
  /** The article text column is capped, so never request more than it can show. */
  inline: '(min-width: 900px) 760px, 100vw',
  /** Two frames side by side above md. */
  pair: '(min-width: 768px) 50vw, 100vw',
  /** Split feature: image takes half the viewport above md. */
  split: '(min-width: 768px) 50vw, 100vw',
  carousel: '(min-width: 768px) 40vw, 80vw',
} as const

export type SanityImage = {
  asset?: {
    _ref?: string
    _id?: string
    metadata?: {lqip?: string; dimensions?: {width: number; height: number; aspectRatio: number}}
  }
  hotspot?: unknown
  crop?: unknown
}

export type ResponsiveImage = {
  src: string
  srcSet: string
  sizes: string
  /** Base64 placeholder, when the asset's metadata was queried. */
  lqip?: string
  width?: number
  height?: number
}

/**
 * Builds a `srcSet` across the given widths. `aspect` (w/h) keeps every
 * candidate the same shape so the browser can swap between them without the
 * layout shifting; omit it to let the image keep its natural proportions.
 */
export function responsiveImage(
  source: SanityImage,
  opts: {widths: readonly number[]; sizes: string; aspect?: number}
): ResponsiveImage {
  const {widths, sizes, aspect} = opts

  const build = (w: number) => {
    // Explicit rather than relying on Sanity's unstated default — 75 is the
    // conventional sweet spot for photographic work.
    const b = urlFor(source as SanityImageSource).width(w).auto('format').quality(75)
    return (aspect ? b.height(Math.round(w / aspect)).fit('crop') : b).url()
  }

  const largest = widths[widths.length - 1]
  const dims = source.asset?.metadata?.dimensions

  return {
    src: build(largest),
    srcSet: widths.map((w) => `${build(w)} ${w}w`).join(', '),
    sizes,
    lqip: source.asset?.metadata?.lqip,
    width: dims?.width,
    height: dims?.height,
  }
}
