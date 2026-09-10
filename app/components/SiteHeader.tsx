'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import MobileNav from './MobileNav'
import {AUCTIONS_URL, INSTAGRAM_URL} from '@/lib/site'
import {useScrollFade} from '@/lib/useScrollFade'
import styles from './SiteHeader.module.css'

/**
 * Global header. Deliberately the same bar as the auctions site: navigation
 * and the compact-viewport trigger on the left, the AutoKultureCollective
 * wordmark on the right, obsidian ground, and the same fade-on-scroll.
 *
 * Two differences, both intentional:
 * - No "Auction Reports" tag beside the wordmark. That tag exists on the
 *   auctions site to mark it as the subdomain; this is the apex site, so the
 *   mark stands unqualified.
 * - The links are this site's own, plus a Reports link out to the auctions
 *   site — mirroring the Journal link the auctions header points back here.
 */
export default function SiteHeader() {
  const navOpacity = useScrollFade()
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className={styles.nav}
      style={{opacity: navOpacity, pointerEvents: navOpacity < 0.05 ? 'none' : undefined}}
    >
      <MobileNav triggerClassName={styles.trigger} />

      <div className={styles.links}>
        <Link href="/#journal">Journal</Link>
        <Link href="/#events">Events</Link>
        <a href={AUCTIONS_URL}>Reports</a>
        <Link href="/about" aria-current={pathname === '/about' ? 'page' : undefined}>
          About
        </Link>
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
          Instagram
        </a>
      </div>

      <Link href="/" aria-label="AutoKultureCollective home" className={styles.wordmark}>
        <span className={styles.mark}>
          <span className={styles.markStrong}>AutoKulture</span>
          <span className={styles.markLight}>Collective</span>
        </span>
      </Link>
    </nav>
  )
}
