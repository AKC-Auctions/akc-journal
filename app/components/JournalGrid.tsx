import Link from 'next/link'
import Photo from './Photo'
import {WIDTHS, SIZES} from '@/lib/image'
import type {JournalCard} from '@/sanity/queries'
import styles from './JournalGrid.module.css'

/**
 * The journal tile grid, used on the homepage and at the foot of every
 * article. Card copy is stored per article rather than derived from the
 * headline — the legacy tiles used their own shorter wording and their own
 * date, and both are worth keeping editable.
 */
export default function JournalGrid({cards}: {cards: JournalCard[]}) {
  if (!cards?.length) return null

  return (
    <div className={styles.grid}>
      {cards.map((card) => {
        const image = card.cardImage?.asset ? card.cardImage : card.heroImage
        const title = card.cardTitle || card.title
        return (
          <Link key={card.slug} href={`/journal/${card.slug}`} className={styles.card}>
            {image?.asset && (
              <Photo
                source={image}
                alt={card.cardImage?.alt || card.heroImage?.alt || ''}
                widths={WIDTHS.card}
                sizes={SIZES.card}
                className={styles.photo}
                fill
              />
            )}
            <div className={styles.overlay}>
              {card.status === 'inPreparation' && (
                <span className={styles.badge}>In preparation</span>
              )}
              {card.cardCategory && <span className={styles.category}>{card.cardCategory}</span>}
              <h3 className={styles.title}>{title}</h3>
              {card.cardMeta && <p className={styles.meta}>{card.cardMeta}</p>}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
