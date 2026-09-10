import type {MetadataRoute} from 'next'
import {getArticleSlugs} from '@/sanity/queries'
import {absoluteUrl} from '@/lib/site'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getArticleSlugs()

  // lastModified comes from each article's own publish date rather than the
  // build clock, so a rebuild doesn't claim every page changed.
  const entries: MetadataRoute.Sitemap = articles.map(({slug, publishDate}) => ({
    url: absoluteUrl(`/journal/${slug}`),
    lastModified: publishDate ? new Date(publishDate) : undefined,
    changeFrequency: 'yearly',
    priority: 0.8,
  }))

  const newest = articles
    .map((a) => a.publishDate)
    .filter(Boolean)
    .sort()
    .at(-1)

  return [
    {
      url: absoluteUrl('/'),
      lastModified: newest ? new Date(newest) : undefined,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {url: absoluteUrl('/about'), changeFrequency: 'yearly', priority: 0.5},
    ...entries,
  ]
}
