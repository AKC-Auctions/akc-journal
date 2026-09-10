import Photo from './Photo'
import {WIDTHS, SIZES, type SanityImage} from '@/lib/image'
import styles from './ArticleBody.module.css'

type Item = {
  image?: SanityImage
  alt?: string
  title?: string
  subtitle?: string
}

type GalleryValue = {
  label?: string
  layout?: 'rhythm' | 'grid'
  items?: Item[]
}

/**
 * Groups frames into the legacy cadence: one wide frame, then a two-up row,
 * repeating. The old markup hard-coded that alternation as nested `.gi` and
 * `.gi-row` divs; here it comes from the item order, so an editor adding a
 * photograph in the Studio keeps the rhythm without touching markup.
 */
function intoRhythm(items: Item[]): Item[][] {
  const rows: Item[][] = []
  let i = 0
  while (i < items.length) {
    rows.push([items[i]])
    i += 1
    if (i < items.length) {
      rows.push(items.slice(i, i + 2))
      i += 2
    }
  }
  return rows
}

function Frame({item, wide}: {item: Item; wide: boolean}) {
  if (!item?.image) return null
  return (
    <figure className={styles.galleryItem}>
      <Photo
        source={item.image}
        alt={item.alt || item.title || ''}
        widths={wide ? WIDTHS.fullBleed : WIDTHS.pair}
        sizes={wide ? SIZES.full : SIZES.pair}
        aspect={wide ? 16 / 9 : 4 / 3}
      />
      {(item.title || item.subtitle) && (
        <figcaption className={styles.galleryCaption}>
          {item.title && <span className={styles.galleryTitle}>{item.title}</span>}
          {item.subtitle && <span className={styles.gallerySub}>{item.subtitle}</span>}
        </figcaption>
      )}
    </figure>
  )
}

export default function GalleryRhythm({value}: {value: GalleryValue}) {
  const items = (value.items || []).filter((i) => i?.image)
  if (items.length === 0) return null

  return (
    <section className={styles.gallery} aria-label={value.label || 'Gallery'}>
      {value.label && <span className={styles.galleryLabel}>{value.label}</span>}

      {value.layout === 'grid' ? (
        <div className={styles.galleryGrid}>
          {items.map((item, i) => (
            <Frame key={i} item={item} wide={false} />
          ))}
        </div>
      ) : (
        <div className={styles.galleryRhythm}>
          {intoRhythm(items).map((row, i) =>
            row.length === 1 ? (
              <Frame key={i} item={row[0]} wide />
            ) : (
              <div key={i} className={styles.galleryRow}>
                {row.map((item, j) => (
                  <Frame key={j} item={item} wide={false} />
                ))}
              </div>
            )
          )}
        </div>
      )}
    </section>
  )
}
