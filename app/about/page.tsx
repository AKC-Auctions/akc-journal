import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {PortableText} from '@portabletext/react'
import SiteHeader from '@/app/components/SiteHeader'
import SiteFooter from '@/app/components/SiteFooter'
import Photo from '@/app/components/Photo'
import {getAboutPage} from '@/sanity/queries'
import {WIDTHS, SIZES} from '@/lib/image'
import styles from './about.module.css'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const about = await getAboutPage()
  return {
    title: about?.title ?? 'About',
    description: about?.seoDescription,
    alternates: {canonical: '/about'},
    openGraph: {title: about?.title, description: about?.seoDescription, url: '/about'},
  }
}

export default async function AboutPage() {
  const about = await getAboutPage()
  if (!about) notFound()

  return (
    <>
      <SiteHeader />

      <main id="main-content">
        {about.heroImage?.asset && (
          <div className={styles.hero}>
            <Photo
              source={about.heroImage}
              alt={about.heroImage.alt || ''}
              widths={WIDTHS.hero}
              sizes={SIZES.full}
              className={styles.heroPhoto}
              priority
              fill
            />
            <div className={styles.heroScrim} />
            <div className={styles.heroText}>
              {about.eyebrow && <p className={styles.eyebrow}>{about.eyebrow}</p>}
              <h1 className={styles.title}>{about.title}</h1>
            </div>
          </div>
        )}

        <div className={styles.body}>{about.body && <PortableText value={about.body} />}</div>
      </main>

      <SiteFooter />
    </>
  )
}
