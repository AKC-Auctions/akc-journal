import type {Metadata} from 'next'
import {headers} from 'next/headers'
import {Cormorant_Garamond, DM_Mono, Playfair_Display} from 'next/font/google'
import './globals.css'
import {DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL, WORDMARK, absoluteUrl} from '@/lib/site'

/**
 * The legacy pages pulled these from fonts.googleapis.com on every load.
 * next/font self-hosts them at build time instead, which is why the CSP in
 * proxy.ts needs no font or style allowance for Google's domains.
 */
const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
})

/** Header wordmark only — the lockup is shared with the auctions site. */
const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${WORDMARK} — European car culture, documented`,
    template: `%s | ${WORDMARK}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {canonical: '/'},
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_GB',
    url: '/',
    title: `${WORDMARK} — European car culture, documented`,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${WORDMARK} — European car culture, documented`,
    description: DEFAULT_DESCRIPTION,
  },
}

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': absoluteUrl('/#organization'),
      name: WORDMARK,
      url: SITE_URL,
    },
    {
      '@type': 'WebSite',
      '@id': absoluteUrl('/#website'),
      url: SITE_URL,
      name: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      publisher: {'@id': absoluteUrl('/#organization')},
      inLanguage: 'en-GB',
    },
  ],
}

export default async function RootLayout({children}: LayoutProps<'/'>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html
      lang="en-GB"
      className={`${cormorant.variable} ${dmMono.variable} ${playfair.variable}`}
    >
      <body>
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{__html: JSON.stringify(orgJsonLd)}}
        />
        <a href="#main-content" className="skipLink">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  )
}
