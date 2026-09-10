import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import SiteHeader from '@/app/components/SiteHeader'
import SiteFooter from '@/app/components/SiteFooter'
import ArticleBody from '@/app/components/ArticleBody'
import JournalGrid from '@/app/components/JournalGrid'
import Photo from '@/app/components/Photo'
import {getArticle, getArticleSlugs, getOtherArticles} from '@/sanity/queries'
import {urlFor} from '@/sanity/client'
import {WIDTHS, SIZES} from '@/lib/image'
import {PROSE_NAME} from '@/lib/site'
import styles from './article.module.css'

export const revalidate = 300

export async function generateStaticParams() {
  const slugs = await getArticleSlugs()
  return slugs.map(({slug}) => ({slug}))
}

export async function generateMetadata(
  props: PageProps<'/journal/[slug]'>
): Promise<Metadata> {
  const {slug} = await props.params
  const article = await getArticle(slug)
  if (!article) return {}

  const share = article.ogImage ?? article.heroImage
  const image = share?.asset
    ? urlFor(share).width(1200).height(630).fit('crop').auto('format').url()
    : undefined

  return {
    title: article.title,
    description: article.seoDescription,
    alternates: {canonical: `/journal/${slug}`},
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.seoDescription,
      url: `/journal/${slug}`,
      publishedTime: article.publishDate,
      images: image ? [{url: image, width: 1200, height: 630}] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.seoDescription,
      images: image ? [image] : undefined,
    },
  }
}

export default async function JournalArticlePage(props: PageProps<'/journal/[slug]'>) {
  const {slug} = await props.params
  const article = await getArticle(slug)
  if (!article) notFound()

  const others = await getOtherArticles(slug)
  const inPreparation = article.status === 'inPreparation'

  const meta = [article.dateLabel, article.location, article.author].filter(Boolean)

  return (
    // The reading scale each legacy article set for itself. See the `density`
    // field's note in the Studio for why these are not normalised.
    <div data-density={article.density ?? 'standard'}>
      <SiteHeader />

      {article.heroImage?.asset && !inPreparation && (
        <div className={styles.hero}>
          <Photo
            source={article.heroImage}
            alt={article.heroImage.alt || article.title}
            widths={WIDTHS.hero}
            sizes={SIZES.full}
            className={styles.heroPhoto}
            priority
            fill
          />
          <div className={styles.heroScrim} />
        </div>
      )}

      <main id="main-content">
        <article>
          <header className={styles.head}>
            {article.eyebrow && <p className={styles.eyebrow}>{article.eyebrow}</p>}
            <h1 className={styles.title}>{article.title}</h1>
            {article.subtitle && <p className={styles.subtitle}>{article.subtitle}</p>}
            <div className={styles.rule} />
            {meta.length > 0 && (
              <div className={styles.meta}>
                {meta.map((m, i) => (
                  <span key={i} style={{display: 'contents'}}>
                    {i > 0 && <span className={styles.metaDot} aria-hidden="true" />}
                    <span>{m}</span>
                  </span>
                ))}
              </div>
            )}
          </header>

          {inPreparation ? (
            <div className={styles.placeholder}>
              <ArticleBody body={article.body} />
            </div>
          ) : (
            <ArticleBody body={article.body} />
          )}

          {!inPreparation && (
            <div className={styles.end}>
              <span className={styles.endMark}>{PROSE_NAME}</span>
            </div>
          )}
        </article>

        {others.length > 0 && (
          <section className={styles.more} aria-labelledby="more-heading">
            <h2 id="more-heading" className={`sectionLabel ${styles.moreLabel}`}>
              From the Journal
            </h2>
            <JournalGrid cards={others} />
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
