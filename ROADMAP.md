# BrickTrack — Launch Roadmap
### Web App: Current State → Shippable Product
**Target: End of May 2026 (earlier if possible)**

---

## Executive Summary

BrickTrack is a LEGO set tracking, rating, and discovery platform (Letterboxd for LEGO). The core product — search, collections, reviews, lists, and SEO — is fully functional. This roadmap covers the remaining work to go from development state to a polished, monetizable, user-ready web app with low ongoing maintenance costs.

**Current state:** ~80% feature-complete. Auth, search, collections, reviews, lists, themes, SEO all working.
**Remaining work:** Polish, security hardening, real price data, email automation, design pass, and launch prep.

---

## What's Already Built & Working

| Area | Status |
|------|--------|
| User registration & login (JWT) | Done |
| LEGO set database (10k+ sets via Rebrickable) | Done |
| Search with filters (theme, year, pieces, rating) | Done |
| Collections (owned + wishlist) | Done |
| Custom lists (create, share, reorder) | Done |
| Reviews & ratings (0.5-5 stars) | Done |
| Public user profiles | Done |
| Email signup capture | Done |
| Affiliate click tracking | Done |
| SEO (sitemaps, OG images, meta tags) | Done |
| GA4 analytics | Done |
| Mobile-responsive layout | Done |
| Dark mode support | Done |
| Backend test suite (16 test files) | Done |
| Render + Vercel deployment config | Done |

---

## Phase 1: Security & Auth Hardening (Week 1)
**Priority: Critical — must ship before any real users**

### 1.1 Password Reset Flow
- Add `POST /auth/forgot-password` endpoint (generates reset token, stores in DB)
- Add `POST /auth/reset-password` endpoint (validates token, updates password)
- Frontend `/forgot-password` and `/reset-password` pages
- Send reset email via transactional email service (see 3.1)
- Tokens expire after 1 hour

### 1.2 Email Verification
- Add `is_email_verified` field to users table
- Send verification email on registration
- Add `GET /auth/verify-email?token=...` endpoint
- Soft-gate: allow usage but show banner until verified
- Resend verification option in account settings

### 1.3 Admin Auth Protection
- Add `is_admin` field to users table
- Protect `/admin/*` endpoints with admin check middleware
- Create simple admin dashboard page (set refresh trigger, user count, email signups)

### 1.4 Rate Limiting
- Add rate limiting middleware (slowapi or custom)
- Auth endpoints: 5 requests/minute per IP
- API endpoints: 60 requests/minute per user
- Prevent abuse of search/suggest endpoints

### 1.5 Input Sanitization Audit
- Review all user-facing inputs (review text, list names, usernames)
- Ensure HTML/XSS prevention on all text fields
- Validate email format server-side

---

## Phase 2: UI/UX Polish & Design Pass (Weeks 2-3)
**Priority: High — directly impacts user retention and perception**

### 2.1 Home Page Redesign
- Hero section with value proposition and CTA
- Trending/popular sets section with better visual hierarchy
- "Why BrickTrack?" feature highlights (track collection, compare prices, get alerts)
- Social proof section (total reviews, active users, sets tracked)
- Clean, modern aesthetic matching top consumer apps

### 2.2 Set Detail Page Final Polish
- Image gallery with zoom (if multiple images available)
- Better review UX (helpful votes, sort by date/rating)
- Related sets recommendations (same theme, similar piece count)
- Price history placeholder (show "Coming soon" until real data)
- Share button (copy link, social share)

### 2.3 Collection UX Improvements
- Collection stats dashboard (total pieces, total sets, theme distribution)
- Visual grid/list toggle for collection view
- "Add to collection" quick action from any set card
- Export collection as CSV/shareable link
- Import sets by number (bulk add)

### 2.4 Global Design System
- Consistent spacing, typography, and color palette across all pages
- Loading skeletons for all data-fetching states
- Empty states with helpful CTAs (no reviews yet, empty collection, etc.)
- Error states with retry actions
- Toast notifications for user actions (added to collection, review posted, etc.)
- Smooth page transitions

### 2.5 Mobile Polish Pass
- Test and fix all pages at 375px and 768px breakpoints
- Bottom navigation bar for mobile (Home, Search, Collection, Profile)
- Touch-friendly tap targets (minimum 44px)
- Swipe gestures for collection management

### 2.6 Onboarding Flow
- First-time user experience after signup
- "Pick your favorite themes" step (personalizes discover page)
- "Add your first sets" guided flow
- Tooltip hints for key features

---

## Phase 3: Email & Notifications (Week 3)
**Priority: High — drives retention and monetization**

### 3.1 Transactional Email Setup
- Integrate email service (Resend, SendGrid, or AWS SES)
- Email templates: welcome, password reset, email verification
- Sender domain setup (SPF, DKIM, DMARC)
- Unsubscribe link in all emails

### 3.2 Deal Alerts (Email)
- "Notify me when this set goes on sale" button on set detail
- Store alert preferences per user per set
- Send email when price drops (once real price data exists)
- Weekly digest option: "Sets you're watching"

### 3.3 Retiring Soon Alerts
- "Alert me when sets I own/want are retiring" preference
- Weekly email: "These sets in your wishlist are retiring soon"
- Drives urgency and affiliate clicks

### 3.4 Review/Social Notifications
- Email when someone likes your review (future)
- Email when a list you follow gets updated (future)
- Keep these as Phase 2 stretch goals

---

## Phase 4: Price Data Integration (Weeks 4-5)
**Priority: High — core differentiator and monetization driver**

### 4.1 LEGO.com MSRP Data
- Pull RRP/MSRP from Rebrickable set data (already available in API)
- Store retail_price and retail_currency on Set model
- Display MSRP on set detail page

### 4.2 Amazon Product Advertising API
- Set up Amazon Associates account + PA-API access
- Build backend service to query Amazon for LEGO set prices
- Map LEGO set numbers to Amazon ASINs (build mapping table)
- Cache prices with 6-hour TTL
- Display Amazon price + "Buy on Amazon" affiliate link

### 4.3 Price Comparison Infrastructure
- Replace hardcoded offers.py with database-backed offers table
- Schema: set_num, store, price, currency, url, in_stock, last_checked
- Periodic refresh job (cron/scheduled task)
- Support multiple stores (Amazon, LEGO.com, Walmart, Target)

### 4.4 Price Display Enhancements
- "Best price" badge on set cards in search/browse
- Price comparison table on set detail
- "Price dropped!" indicators
- Affiliate disclosure clearly visible

### 4.5 Future: Price History (Post-Launch)
- Track price changes over time in a history table
- Simple line chart on set detail page
- "All-time low" and "average price" stats

---

## Phase 5: Performance & Reliability (Week 5)
**Priority: Medium — ensures good experience at scale**

### 5.1 Backend Performance
- Add Redis caching for hot endpoints (set detail, themes list, search)
- Database query optimization (check slow query log)
- Connection pooling tuning for PostgreSQL
- Gzip/Brotli compression on API responses

### 5.2 Frontend Performance
- Audit Core Web Vitals (LCP, CLS, FID)
- Lazy load below-fold components
- Image optimization audit (proper sizes, formats, lazy loading)
- Bundle size analysis and code splitting review
- Prefetch critical navigation paths

### 5.3 Error Monitoring
- Add Sentry (free tier) for frontend and backend error tracking
- Set up alerts for 5xx errors, slow responses
- Add health check endpoint monitoring (UptimeRobot free tier)

### 5.4 Database Maintenance
- Add database backup schedule (Render provides daily backups)
- Review and add missing database indexes
- Set up connection monitoring

---

## Phase 6: Launch Prep (Week 6)
**Priority: Critical — everything needed to go live**

### 6.1 Legal & Compliance
- Finalize privacy policy (GDPR-compliant: data collection, cookies, third-party sharing)
- Finalize terms of service
- Cookie consent banner (if serving EU users)
- Affiliate disclosure page (FTC compliance)
- LEGO trademark disclaimer ("LEGO is a trademark of the LEGO Group, which does not sponsor this site")

### 6.2 Domain & DNS
- Purchase and configure production domain
- Set up SSL certificate (auto via Vercel/Render)
- Configure custom domain on Vercel (frontend) and Render (API)
- Set up email sending domain (for transactional emails)

### 6.3 Production Environment
- Review all environment variables for production values
- Disable debug/dev flags (ALLOW_FAKE_AUTH, AUTH_DEBUG)
- Set production SECRET_KEY (strong, unique)
- Configure CORS for production domain only
- Enable HTTPS-only redirects

### 6.4 SEO Final Check
- Submit sitemap to Google Search Console
- Submit to Bing Webmaster Tools
- Verify robots.txt is correct for production domain
- Test OG images and meta tags with social media debuggers
- Add structured data (JSON-LD) for set pages (Product schema)

### 6.5 Analytics & Monitoring
- Verify GA4 tracking on production
- Set up Google Search Console
- Create GA4 goals/conversions (signup, affiliate click, review posted)
- Dashboard for key metrics

### 6.6 Content & Data
- Ensure set database is fully populated and current
- Create 5-10 curated featured lists (staff picks)
- Write compelling homepage copy
- Create a few seed reviews for popular sets (from your own accounts)

---

## Phase 7: Growth & Monetization (Post-Launch, Ongoing)
**Priority: Revenue generation and user growth**

### 7.1 Affiliate Revenue
- Apply to Amazon Associates program (need qualifying sales first)
- Apply to LEGO.com affiliate program (via Rakuten/CJ)
- Apply to Target, Walmart affiliate programs
- Track affiliate earnings and optimize placement

### 7.2 SEO Content Strategy
- Create themed landing pages ("Best Star Wars Sets 2026", "Sets Under $50")
- Blog/guides section for organic traffic
- User-generated content (reviews, lists) as SEO driver
- Internal linking strategy between related sets/themes

### 7.3 Social Media Presence
- Set up Instagram, Twitter/X, TikTok accounts
- Share new releases, retiring alerts, popular reviews
- Engage with LEGO community (Reddit r/lego, BrickLink forums)

### 7.4 User Growth Tactics
- Shareable collection/list pages with OG previews
- "Compare collections with friends" feature
- Referral program (future)
- Google/Facebook login (OAuth) for frictionless signup

### 7.5 Future Monetization Options
- Premium tier ($5/mo): advanced price alerts, price history, collection analytics, no ads
- Display ads on browse/search pages (non-intrusive, post-scale)
- Sponsored set placements (partner with LEGO stores)

---

## Timeline Summary

| Week | Dates | Focus | Deliverables |
|------|-------|-------|-------------|
| 1 | Mar 9-15 | Security & Auth | Password reset, email verification, admin auth, rate limiting |
| 2 | Mar 16-22 | Design Pass (Part 1) | Home page redesign, set detail polish, design system |
| 3 | Mar 23-29 | Design Pass (Part 2) + Email | Collection UX, mobile polish, onboarding, email setup |
| 4 | Mar 30 - Apr 5 | Price Data (Part 1) | MSRP from Rebrickable, Amazon PA-API setup, offers DB |
| 5 | Apr 6-12 | Price Data (Part 2) + Performance | Price display, caching, Core Web Vitals, error monitoring |
| 6 | Apr 13-19 | Launch Prep | Legal, domain, production config, SEO, content seeding |
| 7 | Apr 20-26 | **SOFT LAUNCH** | Invite friends/family, fix bugs, gather feedback |
| 8 | Apr 27 - May 3 | Bug Fixes & Polish | Address feedback, performance tuning |
| 9 | May 4-10 | **PUBLIC LAUNCH** | Submit to directories, social media, SEO push |
| 10+ | May 11+ | Growth & Monetization | Affiliate programs, content, social, iterate on feedback |

**Soft Launch: ~April 20** | **Public Launch: ~May 4** | **Buffer through May 31**

---

## Cost Estimates (Monthly)

| Service | Plan | Cost |
|---------|------|------|
| Render (Backend) | Starter | $7/mo |
| Render (PostgreSQL) | Starter | $7/mo |
| Vercel (Frontend) | Hobby (free) → Pro | $0-20/mo |
| Domain | Annual | ~$12/yr ($1/mo) |
| Resend (Email) | Free tier (3k emails/mo) | $0/mo |
| Sentry (Error monitoring) | Free tier | $0/mo |
| UptimeRobot (Monitoring) | Free tier | $0/mo |
| Google Analytics | Free | $0/mo |
| **Total (Launch)** | | **~$15-35/mo** |

Scale costs (1k+ users): Render Pro ($25/mo), Vercel Pro ($20/mo), Redis ($15/mo) = ~$75/mo

---

## Key Metrics to Track

| Metric | Target (Month 1) | Target (Month 3) |
|--------|-------------------|-------------------|
| Registered users | 100 | 500 |
| Monthly active users | 50 | 250 |
| Sets tracked (total across users) | 1,000 | 10,000 |
| Reviews written | 50 | 300 |
| Affiliate clicks/month | 200 | 1,000 |
| Email subscribers | 200 | 1,000 |
| Google organic visits/day | 10 | 100 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Amazon PA-API access denied | Start with MSRP display only; apply after qualifying sales |
| Low initial user growth | Focus on SEO long-tail content; engage Reddit/LEGO communities |
| Rebrickable API downtime | Local cache with 24h fallback; DB stores all set data |
| Cost overrun at scale | Free tiers cover first ~1k users; monetize before scaling |
| LEGO trademark issues | Clear disclaimer on every page; no official branding confusion |
| Data freshness | Automated daily refresh via cron; retirement date monitoring |

---

## Success Criteria for Launch

- [ ] All auth flows work (register, login, logout, password reset, email verify)
- [ ] Search returns relevant results with working filters
- [ ] Users can build and share collections/lists
- [ ] Reviews and ratings work end-to-end
- [ ] At least MSRP prices displayed on set pages
- [ ] Affiliate links track clicks correctly
- [ ] Email signups captured and welcome email sent
- [ ] All pages render correctly on mobile
- [ ] Core Web Vitals pass (LCP < 2.5s, CLS < 0.1)
- [ ] No console errors on any page
- [ ] Production environment secured (no dev flags, proper CORS)
- [ ] Legal pages complete and linked
- [ ] Sitemap submitted to Google Search Console

---

*Document generated March 5, 2026*
*BrickTrack — Track your LEGO collection, discover new sets, find the best prices.*
