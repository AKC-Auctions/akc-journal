import Photo from './Photo'
import {resizedImage, type SanityImage} from '@/lib/image'
import styles from './Photo.module.css'

/**
 * The shape every image-holding block shares in the CMS: either an uploaded
 * Sanity asset or a URL pointing at the R2 bucket behind
 * media.autokulturecollective.com.
 */
export type FrameValue = {
  source?: 'upload' | 'url'
  image?: SanityImage
  url?: string
  width?: number
  height?: number
  /** External images only. Unset counts as on — see below. */
  optimize?: boolean
  alt?: string
  caption?: string
  layout?: string
  align?: string
}

/**
 * Renders whichever source the block carries.
 *
 * Uploaded images go through Photo, which builds a Sanity CDN srcset and a
 * blur-up placeholder.
 *
 * External images get a srcset too, through Cloudflare's resizer on the media
 * host — without one, the original is what every phone downloads. An editor can
 * switch that off per image, for a file that has to arrive byte-for-byte (an
 * SVG, an animated GIF), and it is off by definition for any URL somewhere
 * other than the media host, which the resizer cannot transform. Either way the
 * URL is then served exactly as given, with the editor's width and height so
 * the page can still reserve space.
 */
export default function Frame({
  value,
  widths,
  sizes,
  aspect,
  priority = false,
  className = '',
  fill = false,
}: {
  value?: FrameValue
  widths: readonly number[]
  sizes: string
  aspect?: number
  priority?: boolean
  className?: string
  fill?: boolean
}) {
  if (!value) return null
  const alt = value.alt || ''

  if (value.source === 'url') {
    if (!value.url) return null
    const ratio = aspect ?? (value.width && value.height ? value.width / value.height : undefined)
    // Unset means resize: the switch was added after these blocks existed, and
    // the whole point of adding it was that an untouched external image should
    // stop being served full-size.
    const resized =
      value.optimize === false ? null : resizedImage(value.url, {widths, sizes, aspect: ratio})
    return (
      <div
        className={`${styles.frame} ${className}`}
        style={ratio && !fill ? {aspectRatio: String(ratio)} : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={`${styles.img} ${fill || ratio ? styles.cover : ''}`}
          src={resized ? resized.src : value.url}
          srcSet={resized?.srcSet}
          sizes={resized?.sizes}
          alt={alt}
          width={value.width}
          height={value.height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
        />
      </div>
    )
  }

  if (!value.image?.asset) return null
  return (
    <Photo
      source={value.image}
      alt={alt}
      widths={widths}
      sizes={sizes}
      aspect={aspect}
      priority={priority}
      className={className}
      fill={fill}
    />
  )
}
