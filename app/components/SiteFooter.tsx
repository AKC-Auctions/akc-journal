import {AUCTIONS_URL, CONTACT_EMAIL, INSTAGRAM_URL, PROSE_NAME} from '@/lib/site'
import styles from './SiteFooter.module.css'

/**
 * Ported from the legacy footer. Every visible item is a working link —
 * no Privacy or Terms entries, because those pages do not exist on this site
 * yet; they are deliberately absent rather than rendered as dead links.
 */
export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.mark}>AKC</div>
      <div className={styles.right}>
        <a href={AUCTIONS_URL}>Auction Reports</a>
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
          Instagram
        </a>
        <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
        <p className={styles.copy}>
          © {new Date().getFullYear()} {PROSE_NAME}. Europe.
        </p>
      </div>
    </footer>
  )
}
