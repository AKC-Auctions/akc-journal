import {responsiveImage, type SanityImage} from '@/lib/image'
import styles from './Photo.module.css'

/**
 * One photograph, served from Sanity's CDN via srcset.
 *
 * Not next/image: this matches what the auctions site already does, and it
 * keeps every transform off Vercel's image optimizer, whose Hobby-plan
 * transformation quota this site's photography volume would burn through.
 */
export default function Photo({
  source,
  alt,
  widths,
  sizes,
  aspect,
  priority = false,
  className = '',
  fill = false,
}: {
  source: SanityImage
  alt: string
  widths: readonly number[]
  sizes: string
  /** w/h. Locks every srcset candidate to one shape so nothing shifts. */
  aspect?: number
  /** Skip lazy-loading for the one image above the fold. */
  priority?: boolean
  className?: string
  /** Absolutely fill the frame rather than sizing to the image. */
  fill?: boolean
}) {
  if (!source?.asset) return null

  const img = responsiveImage(source, {widths, sizes, aspect})
  const ratio = aspect ?? (img.width && img.height ? img.width / img.height : undefined)

  return (
    <div
      className={`${styles.frame} ${className}`}
      style={ratio && !fill ? {aspectRatio: String(ratio)} : undefined}
    >
      {img.lqip && (
        // Decorative: the real photograph carries the alt text.
        <img className={styles.placeholder} src={img.lqip} alt="" aria-hidden="true" />
      )}
      <img
        className={`${styles.img} ${fill || ratio ? styles.cover : ''}`}
        src={img.src}
        srcSet={img.srcSet}
        sizes={img.sizes}
        alt={alt}
        width={img.width}
        height={img.height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
      />
    </div>
  )
}
