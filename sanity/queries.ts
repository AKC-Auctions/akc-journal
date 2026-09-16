import {client} from './client'
import type {SanityImage} from '@/lib/image'

/**
 * Asset metadata is expanded on every image because the page renders a blurred
 * LQIP placeholder underneath each photograph while it loads — the effect the
 * legacy pages faked by hand-pasting base64 thumbnails into the markup — and
 * uses the intrinsic dimensions to reserve space so nothing shifts.
 */
const IMAGE = `{..., asset->{_id, metadata{lqip, dimensions}}}`

/** Every body block, with the images inside each type expanded. */
const BODY = `body[]{
  ...,
  _type == "journalImage" => {..., image${IMAGE}},
  _type == "imagePair"    => {..., images[]{..., image${IMAGE}}},
  _type == "imageStack"   => {..., lead{..., image${IMAGE}}, row[]{..., image${IMAGE}}},
  _type == "gallery"      => {..., items[]{..., image${IMAGE}}},
  _type == "carousel"     => {..., items[]{..., image${IMAGE}}},
  _type == "splitFeature" => {..., image${IMAGE}},
  _type == "highlightBox" => {..., image${IMAGE}},
  _type == "videoBlock"   => {..., poster${IMAGE}, "url": file.asset->url}
}`
// The spread carries the external-image fields (source, url, optimize, width,
// height) and the placement fields (layout, align) on every block, so only the
// uploaded-asset expansion needs naming above.

export type PortableBlock = {_type: string; _key: string; [k: string]: unknown}

export type JournalArticle = {
  _id: string
  title: string
  slug: string
  status: 'published' | 'inPreparation'
  density: 'standard' | 'generous'
  eyebrow?: string
  subtitle?: string
  heroImage?: SanityImage & {alt?: string}
  publishDate: string
  dateLabel?: string
  location?: string
  author?: string
  body?: PortableBlock[]
  seoDescription?: string
  ogImage?: SanityImage
}

export type JournalCard = {
  slug: string
  title: string
  cardCategory?: string
  cardTitle?: string
  cardMeta?: string
  cardImage?: SanityImage & {alt?: string}
  heroImage?: SanityImage & {alt?: string}
  status: string
}

const CARD_FIELDS = `
  "slug": slug.current,
  title,
  status,
  cardCategory,
  cardTitle,
  cardMeta,
  cardImage${IMAGE},
  heroImage${IMAGE}
`

export async function getArticle(slug: string): Promise<JournalArticle | null> {
  return client.fetch(
    `*[_type == "journalArticle" && slug.current == $slug][0]{
      _id, title, "slug": slug.current, status, density, eyebrow, subtitle,
      heroImage${IMAGE}, publishDate, dateLabel, location, author,
      seoDescription, ogImage${IMAGE},
      ${BODY}
    }`,
    {slug}
  )
}

export async function getArticleSlugs(): Promise<{slug: string; publishDate: string}[]> {
  return client.fetch(
    `*[_type == "journalArticle" && defined(slug.current)]{
      "slug": slug.current, publishDate
    }`,
    {}
  )
}

/** Cards for the homepage grid, in the order the homepage sets. */
export async function getJournalCards(): Promise<JournalCard[]> {
  return client.fetch(
    `*[_type == "journalArticle" && featured == true] | order(order asc, publishDate desc){${CARD_FIELDS}}`,
    {}
  )
}

/** Everything except the given slug — the "more from the Journal" strip. */
export async function getOtherArticles(slug: string): Promise<JournalCard[]> {
  return client.fetch(
    `*[_type == "journalArticle" && slug.current != $slug && status == "published"]
      | order(publishDate desc)[0...5]{${CARD_FIELDS}}`,
    {slug}
  )
}

export type HomePage = {
  eyebrow?: string
  headline?: PortableBlock[]
  standfirst?: string
  established?: string
  places?: string
  tickerItems?: string[]
  aboutLabel?: string
  aboutHeading?: PortableBlock[]
  aboutBody?: PortableBlock[]
  seoDescription?: string
}

export async function getHomePage(): Promise<HomePage | null> {
  return client.fetch(`*[_id == "homePage"][0]`, {})
}

export type AboutPage = {
  eyebrow?: string
  title: string
  heroImage?: SanityImage & {alt?: string}
  body?: PortableBlock[]
  seoDescription?: string
}

export async function getAboutPage(): Promise<AboutPage | null> {
  return client.fetch(
    `*[_id == "aboutPage"][0]{eyebrow, title, heroImage${IMAGE}, body, seoDescription}`,
    {}
  )
}

export type EventEntry = {
  _id: string
  name: string
  dateLabel: string
  tag?: string
  articleSlug?: string
}

export async function getEvents(): Promise<EventEntry[]> {
  return client.fetch(
    `*[_type == "eventEntry"] | order(sortDate desc){
      _id, name, dateLabel, tag, "articleSlug": article->slug.current
    }`,
    {}
  )
}
