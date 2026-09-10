# akc-journal

The main AutoKultureCollective site — `autokulturecollective.com`. Next.js 16
App Router, content in Sanity, deployed on Vercel.

Sibling to [`akc-site`](https://github.com/AKC-Auctions/akc-site), which serves
the auctions subdomain. Both read the same Sanity project (`6cff5w27`,
dataset `production`) so one Studio edits everything.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

No environment variables are needed to run the site. The Sanity project id and
dataset are public values inlined in `sanity/client.ts`, so Vercel needs no
configuration. `.env.local` is only read by the migration scripts, and only
because they write.

## Layout

| Path | What it is |
| --- | --- |
| `app/` | Routes. `/`, `/about`, `/journal/[slug]` |
| `app/components/ArticleBody.tsx` | Renders every Portable Text block type |
| `lib/image.ts` | Sanity CDN srcset ladders |
| `sanity/queries.ts` | All GROQ |
| `proxy.ts` | Nonce CSP. Next 16 renamed Middleware to Proxy |
| `scripts/migrate/` | One-time port from the old Apache site |
| `scripts/check-links.mjs` | Verifies no shared URL breaks |

## Things that will bite you

**Don't pass `{next: {revalidate}}` to `client.fetch`.** Inside Next 16 it
returns `null` rather than the document, silently 404ing every article. Use
route-level `export const revalidate` instead — that is what `akc-site` does
and what this repo now does.

**Don't delete the `redirects()` block in `next.config.ts`.** The old site
served `.html` URLs and those links were shared widely. Every one of them 308s
to its clean equivalent. Removing the block breaks all of them at once. Run
`node scripts/check-links.mjs <base-url>` after touching that file.

**Images bypass `next/image` deliberately.** They are served from Sanity's CDN
via hand-built `srcset` (`lib/image.ts`), which keeps transforms off Vercel's
image optimizer and its Hobby-plan quota. The two ESLint `no-img-element`
warnings in `Photo.tsx` are expected.

**Per-article reading scale is intentional.** The seven migrated pieces were
hand-built with different body sizes and measures. `density` on each article
preserves that: `standard` is 19px/740px, `generous` is 24px/660px (article IV
only). See the field description in the Studio.

## Deploying

DNS lives at Cloudflare and the domain carries Microsoft 365 email. Point the
`@` and `www` records at Vercel and **leave the nameservers alone** — moving
them to Vercel drops the MX, SPF and DKIM records and takes mail down with it.
Keep Cloudflare's proxy on DNS-only; orange-cloud in front of Vercel breaks
certificate issuance.

Verify before and after:

```bash
node scripts/check-links.mjs https://<project>.vercel.app   # before DNS
node scripts/check-links.mjs https://autokulturecollective.com  # after
```

## The migration

Run in order, from the legacy export in `../akc-journal-site/`:

```bash
node scripts/migrate/content.mjs   # HTML -> normalised JSON, reports anything unhandled
node scripts/migrate/verify.mjs    # reconciles word and image counts against the source
node scripts/migrate/prepare.mjs   # fetches Dropbox hotlinks, downscales originals
node --env-file=.env.local scripts/migrate/upload.mjs           # dry run
node --env-file=.env.local scripts/migrate/upload.mjs --commit  # writes
```

Re-runnable. Assets are content-addressed by Sanity and documents use
deterministic ids, so nothing duplicates.

### Known gaps

- **Videos are not migrated.** Article III's panel discussion and its
  background loop were 171MB of QuickTime mislabelled as MP4. Both blocks
  remain in the document, unpopulated, ready for an MP4 upload in the Studio.
- **Four auction prices in article III have no stated basis.** The legacy
  markup never said whether they were hammer or total paid, so `basis` was
  left unset rather than guessed. The Studio flags them until resolved.
- **Articles I and II disagree with their homepage cards** about the event
  month (Feb vs Jan). Both values were preserved; neither is authoritative.
- **No Privacy or Terms pages.** The legacy site had none. The footer omits
  the links rather than pointing at dead routes.
