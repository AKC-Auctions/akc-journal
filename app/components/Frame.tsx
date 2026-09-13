import Photo from './Photo'
import type {SanityImage} from '@/lib/image'
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
  alt?: string
  caption?: string
  layout?: string
  align?: string
}

/**
 * Renders whichever source the block carries.
 *
 * Uploaded images go through Photo, which builds a Sanity CDN srcset and a
 * blur-up placeholder. External images can do neither — there is no transform
 * pipeline behind a plain bucket — so they are served exactly as uploaded,
 * with width and height applied when the editor supplied them so the page can
 * still reserve space and avoid a layout jump.
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
    return (
      <div
        className={`${styles.frame} ${className}`}
        style={ratio && !fill ? {aspectRatio: String(ratio)} : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={`${styles.img} ${fill || ratio ? styles.cover : ''}`}
          src={value.url}
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
