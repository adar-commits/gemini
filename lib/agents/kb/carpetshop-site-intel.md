# Carpetshop site intel (crawl-backed)

Purpose: enrich understanding of customer phrasing and page intent from a broad crawl of carpetshop.co.il URLs.

Scope rule: this file adds contextual intel only. It does not change policy facts, routing rules, or deterministic tool behavior.

Crawl date: 2026-09-07
Requested URLs: 173
Reachable pages: 169 (HTTP 200 after proper URL encoding for Hebrew paths)
Unavailable pages: 4 (all under `pages/announcement-message/*`, HTTP 404)

## Unavailable URLs (do not rely on them)

- https://www.carpetshop.co.il/pages/announcement-message/09-06-2026-petah-tikva-opening-hours-announcement
- https://www.carpetshop.co.il/pages/announcement-message/announcementbar1
- https://www.carpetshop.co.il/pages/announcement-message/night-sale-extra-10-night-10
- https://www.carpetshop.co.il/pages/announcement-message/test

## Canonical hubs vs alternate entry pages

Use these mappings to interpret user references, then answer from existing policy/FAQ KB sections:

- `pages/faq` and `pages/main-faqs` -> same FAQ intent hub (ordering, delivery, care basics).
- `pages/pozitive-faq` -> Pozitive FAQ intent hub (poufs/beanbags), mapped to Pozitive KB.
- `pages/shipping-and-return-policy` and `pages/מדיניות-משלוחים` -> shipping/returns explainer pages; legal source remains `policies/shipping-policy` and `policies/refund-policy`.
- `pages/accessibility` and `pages/הצהרת-נגישות-פוזיטיב` -> accessibility intent.
- `pages/terms-of-use`, `policies/terms-of-service`, `pages/terms-mailing-list` -> terms/legal intent.
- `pages/privacy-statement-advertising-information` and `policies/privacy-policy` -> privacy/data usage intent.
- `pages/סניפים-השטיח-האדום` and `pages/סניפים-פוזיטיב` -> branch-hours listing intent.

## Branch/store intent signals from crawl

Single-branch pages exist and users may paste or cite them directly:

- `pages/השטיח-האדום-סניף-*` (red carpet branch pages)
- `pages/פוזיטיב-סניף-*` (Pozitive branch pages)

Interpretation guidance:

- A branch-page mention usually means location/hours/phone question, not returns-policy question.
- If user asks "הסניף הזה פתוח?" use branch/hours KB first.
- If user asks order status after mentioning a branch page, still route to order lookup flow.

## Time-bound campaign pages (high churn)

Crawl confirms many campaign regulation pages (`תקנון-*`, `הטבת-*`, `sale`, `night`, `online-only`, `summer`, `november`, `1+1`, `50%`, `40%`, etc.).

Guidance:

- Treat these pages as ephemeral campaign references.
- For "is this deal still active?" prefer live campaigns/API flow when available.
- If no live source is available, state that campaign validity is date-bound and must be confirmed.

## OOAK and premium collection intent signals

Users may reference these pages/slugs:

- `pages/ooak`, `pages/דף-לובי-ooak`
- `pages/ariana-rugs-intro`
- `pages/kazak-rugs-intro`
- `pages/super-zigler-rugs-intro`

Interpretation guidance:

- These are collection/story landing intents (often discovery or curation), not order-service intents.
- Keep factual answers high-level unless product page/order context is provided.

## B2B / designers / projects intent signals

Pages found:

- `pages/b2b`
- `pages/designers`
- `pages/projects`
- `pages/hom-business`
- `pages/נהלי-עבודה-מחלקת-אדריכלים-ומעצבים`

Interpretation guidance:

- Route these asks toward business collaboration / architect-designer support context.
- Do not mix with consumer shipping/refund answers unless explicitly asked.

## Content hubs and blog-intent vocabulary

Crawled content hubs:

- `blogs/news` (+ 70+ article pages)
- `blogs/carpetshop-business-blog`
- `blogs/pozitive-blog`

Common ask-intent vocabulary from article slugs/titles:

- Design trends: `trends`, `2022`, `2023`, `modern`, `style`, `design-in-*`, `white design`, `red`, `blue`, `yellow`, `gray`.
- Room-specific fit: `living-room`, `bedroom`, `kids-room`, `baby-room`, `office`, `laundry-room`, `balcony`.
- Care/maintenance: `cleaning`, `shaggy`, `wrinkles-and-folds`, `how-to-treat`.
- Lifecycle events: `moving`, `rent-apartment`, `spring`, `winter`, `shavuot`, `pesach`.
- Buying help: `how-to-choose`, `online-purchase-tips`, `types-of-carpets`, `types-of-weaving`, `test-yourself`.
- Material/craft education: `hand-made`, `machine weaving`, `persian`, `kilim`, `recycled carpets`.
- Pozitive content: `beanbags`, `kids beanbags`, `stripes trend`.

Use case:

- When users phrase open design questions with this language, prefer educational/helpful tone and then ground hard facts (delivery/returns/payments) from core policy KB.

## Utility/feature page signals

Frequently referenced utility pages from crawl:

- `pages/visualization-page` -> room visualization tool intent.
- `pages/product-rug-size`, `pages/rug-sizes`, `pages/product-rug-size-pozitive` -> size-guide intent.
- `pages/quiz`, `pages/pick-your-style` -> style recommendation / discovery intent.
- `pages/reviews`, `pages/packaging-reviews` -> social-proof intent.
- `cart` -> checkout/cart issue intent.
- `pages/search-results-page` -> site search intent.
- `pages/list-remote-cities` -> remote delivery-area clarification intent.

## URL encoding note (Hebrew paths)

Many Hebrew URLs require percent-encoding in crawlers. If an ingestion tool reports false negatives on Hebrew slugs, retry with encoded path before marking the page unavailable.
