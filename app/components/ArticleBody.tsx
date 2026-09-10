import {PortableText, type PortableTextComponents} from '@portabletext/react'
import Photo from './Photo'
import GalleryRhythm from './GalleryRhythm'
import {WIDTHS, SIZES, type SanityImage} from '@/lib/image'
import type {PortableBlock} from '@/sanity/queries'
import styles from './ArticleBody.module.css'

type Img = {image?: SanityImage; alt?: string; caption?: string; layout?: string}

const FIGURE_CLASS: Record<string, string> = {
  inline: styles.figureInline,
  fullBleed: styles.figureFullBleed,
  cinema: styles.figureCinema,
  portrait: styles.figurePortrait,
  feature: styles.figureFeature,
}

/** Width ladder per layout — a full-bleed frame needs far more than an inline one. */
const FIGURE_WIDTHS: Record<string, readonly number[]> = {
  inline: WIDTHS.inline,
  fullBleed: WIDTHS.fullBleed,
  cinema: WIDTHS.fullBleed,
  portrait: WIDTHS.inline,
  feature: WIDTHS.fullBleed,
}

function Figure({value}: {value: Img}) {
  if (!value.image) return null
  const layout = value.layout || 'inline'
  return (
    <figure className={`${styles.figure} ${FIGURE_CLASS[layout] ?? styles.figureInline}`}>
      <Photo
        source={value.image}
        alt={value.alt || ''}
        widths={FIGURE_WIDTHS[layout] ?? WIDTHS.inline}
        sizes={layout === 'fullBleed' || layout === 'cinema' ? SIZES.full : SIZES.inline}
        className={styles.shot}
        fill={layout === 'fullBleed'}
      />
      {value.caption && <figcaption className={styles.caption}>{value.caption}</figcaption>}
    </figure>
  )
}

/** Basis is rendered beside every figure, so no bare number can be misread. */
const BASIS_LABEL: Record<string, string> = {
  hammer: 'Hammer',
  total: 'Total paid, incl. premium',
  estimate: 'Estimate',
  notSold: 'Not sold',
}

export const articleComponents: PortableTextComponents = {
  block: {
    normal: ({children}) => <p className={`${styles.copy} ${styles.p}`}>{children}</p>,
    lead: ({children}) => <p className={`${styles.copy} ${styles.lead}`}>{children}</p>,
    h2: ({children}) => <h2 className={`${styles.copy} ${styles.h2}`}>{children}</h2>,
    h3: ({children}) => <h3 className={`${styles.copy} ${styles.h3}`}>{children}</h3>,
    blockquote: ({children}) => <blockquote className={styles.pull}>{children}</blockquote>,
  },

  marks: {
    link: ({value, children}) => {
      const href: string = value?.href ?? '#'
      const external = /^https?:\/\//.test(href)
      return (
        <a
          href={href}
          {...(external ? {target: '_blank', rel: 'noopener noreferrer'} : {})}
        >
          {children}
        </a>
      )
    },
  },

  types: {
    journalImage: ({value}: {value: Img}) => <Figure value={value} />,

    imagePair: ({value}: {value: {images?: Img[]; caption?: string}}) => (
      <>
        <div className={styles.pair}>
          {(value.images || []).map((im, i) =>
            im.image ? (
              <Photo
                key={i}
                source={im.image}
                alt={im.alt || ''}
                widths={WIDTHS.pair}
                sizes={SIZES.pair}
              />
            ) : null
          )}
        </div>
        {value.caption && <p className={`${styles.copy} ${styles.caption}`}>{value.caption}</p>}
      </>
    ),

    imageStack: ({value}: {value: {lead?: Img; row?: Img[]}}) => (
      <div className={styles.stack}>
        {value.lead?.image && (
          <Photo
            source={value.lead.image}
            alt={value.lead.alt || ''}
            widths={WIDTHS.fullBleed}
            sizes={SIZES.full}
          />
        )}
        <div className={styles.stackRow}>
          {(value.row || []).map((im, i) =>
            im.image ? (
              <Photo
                key={i}
                source={im.image}
                alt={im.alt || ''}
                widths={WIDTHS.pair}
                sizes={SIZES.pair}
              />
            ) : null
          )}
        </div>
      </div>
    ),

    gallery: ({value}) => <GalleryRhythm value={value} />,

    splitFeature: ({value}) => (
      <section
        className={`${styles.split} ${value.imageSide === 'right' ? styles.splitRight : ''}`}
      >
        <div className={styles.splitImage}>
          {value.image && (
            <Photo
              source={value.image}
              alt={value.alt || ''}
              widths={WIDTHS.split}
              sizes={SIZES.split}
              aspect={3 / 4}
            />
          )}
        </div>
        <div>
          {value.eyebrow && <span className={styles.splitEyebrow}>{value.eyebrow}</span>}
          {value.heading && <h2 className={styles.splitHeading}>{value.heading}</h2>}
          {value.body && (
            <div className={styles.splitBody}>
              <PortableText value={value.body} />
            </div>
          )}
          {value.specs?.length > 0 && (
            <dl className={styles.specs}>
              {value.specs.map((s: {label: string; value: string}, i: number) => (
                <div key={i}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>
    ),

    carousel: ({value}) => (
      <section className={styles.carousel} aria-label={value.eyebrow || 'Photographs'}>
        {value.eyebrow && <span className={styles.galleryLabel}>{value.eyebrow}</span>}
        {/* Scrollable region gets keyboard access and an accessible name. */}
        <div className={styles.carouselTrack} tabIndex={0} role="group" aria-label="Scrollable photographs">
          {(value.items || []).map((im: Img, i: number) =>
            im.image ? (
              <figure key={i} className={styles.carouselItem}>
                <Photo
                  source={im.image}
                  alt={im.alt || ''}
                  widths={WIDTHS.carousel}
                  sizes={SIZES.carousel}
                  aspect={4 / 3}
                />
                {im.caption && <figcaption className={styles.caption}>{im.caption}</figcaption>}
              </figure>
            ) : null
          )}
        </div>
      </section>
    ),

    videoBlock: ({value}) => {
      if (!value.url) return null
      const ambient = value.mode === 'ambient'
      return (
        <figure className={styles.video}>
          <video
            controls={!ambient}
            autoPlay={ambient}
            muted={ambient}
            loop={ambient}
            playsInline
            preload="metadata"
          >
            <source src={value.url} type="video/mp4" />
          </video>
          {value.label && <figcaption className={styles.videoLabel}>{value.label}</figcaption>}
        </figure>
      )
    },

    awardsList: ({value}) => (
      <section className={styles.listBlock}>
        {value.label && <span className={styles.listLabel}>{value.label}</span>}
        {value.heading && <h2 className={styles.listHeading}>{value.heading}</h2>}
        {value.intro && <p className={styles.listIntro}>{value.intro}</p>}
        <dl>
          {(value.rows || []).map((r: {title: string; car: string; note?: string}, i: number) => (
            <div key={i} className={styles.awardRow}>
              <dt className={styles.awardTitle}>{r.title}</dt>
              <dd className={styles.awardCar}>
                {r.car}
                {r.note && <span className={styles.awardNote}>{r.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    ),

    resultsList: ({value}) => (
      <section className={styles.listBlock}>
        {value.label && <span className={styles.listLabel}>{value.label}</span>}
        {(value.rows || []).map(
          (
            r: {car: string; detail?: string; price?: string; basis?: string},
            i: number
          ) => (
            <div key={i} className={styles.resultRow}>
              <div>
                <p className={styles.resultCar}>{r.car}</p>
                {r.detail && <p className={styles.resultDetail}>{r.detail}</p>}
              </div>
              {r.price && (
                <p className={styles.resultPrice}>
                  {r.price}
                  <span className={styles.resultBasis}>
                    {r.basis ? BASIS_LABEL[r.basis] : 'Basis not stated'}
                  </span>
                </p>
              )}
            </div>
          )
        )}
        {value.footnote && <p className={styles.footnote}>{value.footnote}</p>}
      </section>
    ),

    divider: ({value}) => (
      <div className={styles.divider} role="separator">
        {value.label && <span className={styles.dividerMark}>{value.label}</span>}
      </div>
    ),
  },
}

export default function ArticleBody({body}: {body?: PortableBlock[]}) {
  if (!body?.length) return null
  return (
    <div className={styles.body}>
      <PortableText value={body} components={articleComponents} />
    </div>
  )
}
