'use client'

import {useState, useRef, useEffect} from 'react'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {AUCTIONS_URL, INSTAGRAM_URL} from '@/lib/site'
import styles from './MobileNav.module.css'

const LINKS: {label: string; href: string; external?: boolean}[] = [
  {label: 'Home', href: '/'},
  {label: 'Journal', href: '/#journal'},
  {label: 'Events', href: '/#events'},
  {label: 'Reports', href: AUCTIONS_URL, external: true},
  {label: 'About', href: '/about'},
  {label: 'Instagram', href: INSTAGRAM_URL, external: true},
]

/**
 * Compact menu for viewports where the desktop nav is hidden.
 *
 * Carries over the dialog behaviour the auctions site implements: accessible
 * name, Escape and close-button dismissal, Tab contained while open, and
 * focus returned to the trigger on close. The legacy journal pages toggled a
 * class from an inline onclick with none of that, and one of them shipped no
 * close button at all.
 */
export default function MobileNav({triggerClassName = ''}: {triggerClassName?: string}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    if (!open) return

    // Move focus into the panel so the next Tab lands inside it.
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>('a[href], button')
      if (!focusable || focusable.length === 0) return
      const list = Array.from(focusable)
      const firstEl = list[0]
      const lastEl = list[list.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={triggerClassName}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <>
          <button className={styles.scrim} onClick={close} tabIndex={-1} aria-hidden="true" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            className={styles.panel}
          >
            <div className={styles.panelHead}>
              <span className={styles.mark}>
                <span className={styles.markStrong}>AutoKulture</span>
                <span className={styles.markLight}>Collective</span>
              </span>
              <button type="button" onClick={close} aria-label="Close navigation" className={styles.close}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {LINKS.map((l) =>
              l.external ? (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className={styles.link}
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === l.href ? 'page' : undefined}
                  className={styles.link}
                >
                  {l.label}
                </Link>
              )
            )}
          </div>
        </>
      )}
    </>
  )
}
