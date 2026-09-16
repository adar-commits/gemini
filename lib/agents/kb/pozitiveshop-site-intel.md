# Pozitiveshop site intel (crawl-backed)

Purpose: enrich understanding of customer phrasing and page intent for `pozitiveshop.co.il`.

Scope rule: intel-only enrichment. Do not treat this file as policy source-of-truth and do not change routing logic from this file alone.

Crawl date: 2026-09-07
Requested URLs: 172
Reachable pages: 94
Unavailable pages: 78

## High-signal crawl finding

Most provided `articles/*` URLs are unavailable on `pozitiveshop.co.il` (HTTP 404), while equivalent content intent appears under other site hubs (`blogs/*` and `pages/*`).

Operational guidance:

- If a user pastes a broken `pozitiveshop` `articles/*` link, do not assume the topic is invalid.
- Interpret the intent from the slug and answer from KB if the topic is known.
- When sharing a source link back, prefer working Pozitive hubs or the canonical policy pages.

## Unavailable patterns (do not rely on direct retrieval)

- `https://www.pozitiveshop.co.il/announcement_message/*` (all provided links returned 404)
- `https://www.pozitiveshop.co.il/articles/*` (all provided links returned 404)

## Active content hubs and intent mapping

Working hubs from crawl:

- `https://www.pozitiveshop.co.il/blogs/news`
- `https://www.pozitiveshop.co.il/blogs/pozitive-blog`
- `https://www.pozitiveshop.co.il/blogs/carpetshop-business-blog`

Intent mapping guidance:

- Old/shared article slugs (`trends`, `cleaning`, `moving`, `kids-room`, `types-of-carpets`, etc.) map to educational blog-intent, not service-status intent.
- Pozitive asks should prioritize pouf/beanbag context from `pozitive-products.md`.

## Canonical policy and FAQ anchors

Use these as stable sources when answering operational questions:

- FAQ: `https://www.pozitiveshop.co.il/pages/faq`
- Pozitive FAQ page alias: `https://www.pozitiveshop.co.il/pages/pozitive-faq`
- Tutorial videos: `https://www.pozitiveshop.co.il/pages/pozitive-tutorial-videos`
- Shipping policy: `https://www.pozitiveshop.co.il/policies/shipping-policy`
- Refund policy: `https://www.pozitiveshop.co.il/policies/refund-policy`
- Privacy policy: `https://www.pozitiveshop.co.il/policies/privacy-policy`
- Terms: `https://www.pozitiveshop.co.il/policies/terms-of-service`

## Canonical pages vs legacy/alias pages

Interpret these as same-intent entry points:

- `pages/main-faqs` and `pages/faq` -> FAQ intent.
- `pages/shipping-and-return-policy` -> legacy explainer; canonical legal source is `policies/shipping-policy` plus `policies/refund-policy`.
- `pages/accessibility` and `pages/הצהרת-נגישות-פוזיטיב` -> accessibility intent.
- `pages/terms-of-use`, `pages/terms-mailing-list`, and `policies/terms-of-service` -> legal/terms intent.
- `pages/privacy-statement-advertising-information` and `policies/privacy-policy` -> privacy intent.

## Branch and store intent signals

Working network pages include:

- `pages/סניפים-השטיח-האדום`
- `pages/סניפים-פוזיטיב`
- `pages/פוזיטיב-סניף-*`
- `pages/השטיח-האדום-סניף-*`

Interpretation guidance:

- Branch page mentions usually mean location, hours, or contact intent.
- Keep branch answers separate from return/cancellation policy unless user asks both.

## Campaign and regulation pages (high churn)

Crawl confirms many active campaign pages (`תקנון-*`, `הטבת-*`, `sale`, `online-only`, `summer`, `november`, `1+1`, `40%`, `50%`).

Guidance:

- Treat campaign pages as time-bound and high-churn.
- For "still active?" questions, prefer live campaign source; otherwise explicitly mark validity as date-dependent.

## Utility and feature intent pages

Working utility pages include:

- `pages/visualization-page` -> visualization intent.
- `pages/product-rug-size`, `pages/product-rug-size-pozitive`, `pages/rug-sizes` -> size guidance intent.
- `pages/quiz`, `pages/pick-your-style` -> guided style-selection intent.
- `pages/reviews`, `pages/packaging-reviews` -> reviews/social-proof intent.
- `cart` -> checkout/cart-support intent.
- `pages/list-remote-cities` -> remote-delivery-area clarification intent.

## Brand crossover signal

Multiple Pozitive pages render shared red-carpet content framing (titles and descriptions mention both brands). This is expected in the HoM shared ecosystem.

Guidance:

- Do not treat this as contradiction.
- Keep answers brand-aware by user context (if user asks about פופים/Pozitive, prioritize Pozitive product KB and Pozitive policy links).
