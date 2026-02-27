# Image rules

## Goals
- Fast LCP, no layout shift, consistent thumbnails across the app.
- Use Next.js image optimization wherever possible.

## Default components
- Prefer `next/image` for all set thumbnails and set hero images.
- Allow `<img>` ONLY when:
  - the URL is not from an allowed remote host (and we can’t/won’t add it), or
  - it’s inside `opengraph-image` / `ImageResponse` rendering, or
  - it’s truly decorative and extremely small (rare).

## Remote images
- All remote image hosts MUST be declared in `next.config.js` via `images.remotePatterns`.
- If a new host appears, add it + redeploy.

## Sizes (responsive hints)
Use these defaults:
- Card thumbnails in a grid (1 col mobile, 2 col sm, 3 col lg):
  - `sizes="(min-width: 1024px) 220px, (min-width: 640px) 50vw, 100vw"`
- Small thumbs (like 96px wide):
  - `sizes="96px"`
- Hero image (set detail):
  - `sizes="(min-width: 1024px) 600px, 100vw"`

## Layout rules (avoid CLS)
- Always reserve space:
  - Use `width/height` OR `fill` in a `relative` container with fixed dimensions/aspect ratio.
- Prefer a consistent aspect ratio for set thumbnails:
  - 4:3 or 1:1, whichever looks best across the app.

## Priority and loading
- Only the primary above-the-fold image gets `priority` (usually 1 per page).
- Everything else should be lazy-loaded (default behavior of `next/image`).

## Quality
- Default quality is fine; only tune if needed.
- If you do tune: thumbnails ~60–75, hero ~75–85.

## Fallback behavior
- If image URL is missing/empty, show a placeholder container (no broken image icon).
- If image load fails:
  - keep layout stable,
  - optionally swap to placeholder via `onError` (client components only).

## OG images
- OG route should always succeed:
  - try fetching set image (optional),
  - timeout quickly,
  - fall back to text-only OG if fetch fails.
- Standard OG size: 1200x630.