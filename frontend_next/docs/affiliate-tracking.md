# Affiliate links + tracking

This app uses a simple affiliate/link tracking layer so:
- outbound retailer clicks are consistent and measurable
- we can safely block unknown domains while testing
- we can attribute clicks by placement + set + offer rank

## Affiliate URL rules

All outbound retailer links must be built with:

- `buildAffiliateUrl(offer, opts)` in `frontend_next/lib/affiliate.ts`

### Allowed domains (strict allowlist)
For now we only allow clicks to these hosts:

- lego.com, www.lego.com  
- amazon.com, www.amazon.com  
- walmart.com, www.walmart.com  
- target.com, www.target.com  
- bestbuy.com, www.bestbuy.com  

If a URL’s hostname is not in the allowlist, `buildAffiliateUrl()` returns an empty string and the link should be hidden.

### Protocol rules
- Only `http:` and `https:` URLs are allowed.
- Non-http(s) URLs are rejected.

### Tracking params (UTM)
`buildAffiliateUrl()` appends these query params:

- `utm_source=legoapp`
- `utm_medium=affiliate`
- `utm_campaign=<placement>` (if provided)
- `utm_content=<setNum>` (if provided)
- `utm_term=<offerRank>` (if provided)

These UTMs work even before real affiliate programs are wired up.

## Event tracking (lib/events.ts)

All events are logged via `logEvent()` (currently `console.info`, later a real endpoint).

### affiliate_click
Fired when the user clicks an outbound retailer link.

Fields:
- `event`: `"affiliate_click"`
- `url`: string (final affiliate URL)
- `label?`: string (store label)
- `placement?`: string (e.g. `"set_detail_shop"`)
- `set_num?`: string
- `offer_rank?`: number
- `price?`: number
- `currency?`: string
- `ts`: number (Date.now())

### CTA events
We track CTA experiments with three events:
- `cta_impression`
- `cta_click`
- `cta_complete`

Fields:
- `event`: `"cta_impression" | "cta_click" | "cta_complete"`
- `cta_id`: `"hero_track" | "after_offers_alerts"`
- `variant`: `"A" | "B"`
- `placement`: `"set_hero" | "after_offers"`
- `set_num`: string
- `ts`: number (Date.now())

Notes:
- `cta_impression` should fire once per (cta_id, set_num, variant) per page view.
- `cta_click` fires when the CTA is clicked.
- `cta_complete` fires when the CTA flow completes (e.g. email saved / already subscribed).

### Offer clicks
Offer links (e.g., “View offer →”) should:
- use the URL returned by `buildAffiliateUrl()`
- open in a new tab with `target="_blank"` + `rel="noopener noreferrer"`
- fire an outbound click event (currently via `outboundClick()`)

Recommended payload fields:
- `url` (affiliate URL)
- `label` (store name)
- `placement` (e.g. `set_detail_shop`)
- `set_num`
- `offer_rank`
- `price`
- `currency`

### CTA experiment events (set page, after offers)
We track:
- `cta_impression`: once per (cta_id, set_num, variant)
- `cta_click`: when the CTA button is clicked
- `cta_complete`: when the user completes the CTA (email saved / already subscribed)

Current CTA:
- `cta_id`: `after_offers_alerts`
- `placement`: `after_offers`
- `variant`: `A` or `B` (force with `?cta=A` / `?cta=B`)

## How to test locally

1) Offers present:
- `http://localhost:3000/sets/10305-1?cta=A#shop`
- Click “View offer →”
  - opens a new tab
  - URL contains UTMs
  - click event logs

2) No offers:
- `http://localhost:3000/sets/21354-1?cta=B#shop`
- CTA renders and opens the email capture

3) Confirm events
- In dev logs/console you should see affiliate + CTA events firing once per interaction.