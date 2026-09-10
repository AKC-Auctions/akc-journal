import Link from 'next/link'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'

export const metadata = {title: 'Page not found'}

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        style={{
          maxWidth: 740,
          margin: '0 auto',
          padding: '140px 36px 120px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            marginBottom: 20,
          }}
        >
          404
        </p>
        <h1
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 'clamp(32px, 6vw, 56px)',
            fontWeight: 300,
            lineHeight: 1.05,
            marginBottom: 20,
          }}
        >
          That page isn’t here
        </h1>
        <p style={{color: 'var(--muted)', fontSize: 18, lineHeight: 1.7, marginBottom: 36}}>
          It may have moved when the site did. The Journal is the best place to pick up
          from.
        </p>
        <Link
          href="/#journal"
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--white)',
            textDecoration: 'none',
            borderBottom: '1px solid var(--gold)',
            paddingBottom: 2,
          }}
        >
          Go to the Journal →
        </Link>
      </main>
      <SiteFooter />
    </>
  )
}
