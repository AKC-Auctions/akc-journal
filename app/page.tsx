import type {Metadata} from 'next'
import Link from 'next/link'
import {PortableText} from '@portabletext/react'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'
import JournalGrid from './components/JournalGrid'
import {getHomePage, getJournalCards, getEvents} from '@/sanity/queries'
import {DEFAULT_DESCRIPTION} from '@/lib/site'
import styles from './home.module.css'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const home = await getHomePage()
  return {
    description: home?.seoDescription || DEFAULT_DESCRIPTION,
    alternates: {canonical: '/'},
  }
}

/** Headline and about-strip headings are rich text purely so an italic word
    can render in gold, as "gatherings" does. No block wrapper, no paragraph. */
const inlineOnly = {
  block: {normal: ({children}: {children?: React.ReactNode}) => <>{children}</>},
}

export default async function HomePage() {
  const [home, cards, events] = await Promise.all([
    getHomePage(),
    getJournalCards(),
    getEvents(),
  ])

  const ticker = home?.tickerItems ?? []

  return (
    <>
      <SiteHeader />

      <main id="main-content">
        <section className={styles.hero}>
          <div className={styles.heroGround} />
          <div className={styles.heroLine} />
          <div className={styles.heroGhost} aria-hidden="true">
            AKC
          </div>

          <div className={styles.heroInner}>
            {home?.eyebrow && <p className={styles.heroEyebrow}>{home.eyebrow}</p>}
            <h1 className={styles.heroTitle}>
              {home?.headline ? (
                <PortableText value={home.headline} components={inlineOnly} />
              ) : (
                'Inside the gatherings of European car culture'
              )}
            </h1>
            {home?.standfirst && <p className={styles.heroStandfirst}>{home.standfirst}</p>}
          </div>

          {(home?.established || home?.places) && (
            <div className={styles.heroMeta}>
              {home.established && <span>{home.established}</span>}
              <div className={styles.heroMetaRule} />
              {home.places && <span>{home.places}</span>}
            </div>
          )}
        </section>

        {ticker.length > 0 && (
          <div className={styles.ticker}>
            {/* Two identical groups so the loop is seamless; the duplicate is
                hidden from assistive tech rather than read out twice. */}
            <div className={styles.tickerTrack}>
              {[0, 1].map((n) => (
                <div key={n} className={styles.tickerGroup} aria-hidden={n === 1 || undefined}>
                  {ticker.map((item, i) => (
                    <span key={i} style={{display: 'contents'}}>
                      <span>{item}</span>
                      <div className={styles.tickerDot} aria-hidden="true" />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <section className={styles.section} id="journal" aria-labelledby="journal-heading">
          <h2 id="journal-heading" className={`sectionLabel ${styles.sectionHead}`}>
            Journal
          </h2>
          <JournalGrid cards={cards} />
        </section>

        <section className={styles.about} aria-labelledby="about-heading">
          <div>
            <h2 id="about-heading" className="sectionLabel">
              {home?.aboutLabel || 'What we are'}
            </h2>
            {home?.aboutHeading && (
              <p className={styles.aboutHeading}>
                <PortableText value={home.aboutHeading} components={inlineOnly} />
              </p>
            )}
          </div>
          <div className={styles.aboutBody}>
            {home?.aboutBody && <PortableText value={home.aboutBody} />}
            <Link href="/about" className={styles.aboutLink}>
              Read more →
            </Link>
          </div>
        </section>

        {events.length > 0 && (
          <section className={styles.section} id="events" aria-labelledby="events-heading">
            <h2 id="events-heading" className={`sectionLabel ${styles.sectionHead}`}>
              Events
            </h2>
            <div>
              {events.map((e) => {
                const inner = (
                  <>
                    <span className={styles.eventDate}>{e.dateLabel}</span>
                    <span className={styles.eventName}>{e.name}</span>
                    {e.tag && <span className={styles.eventTag}>{e.tag}</span>}
                  </>
                )
                return e.articleSlug ? (
                  <Link key={e._id} href={`/journal/${e.articleSlug}`} className={styles.event}>
                    {inner}
                  </Link>
                ) : (
                  <div key={e._id} className={styles.event}>
                    {inner}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </>
  )
}
