# HWCC website: notes for Claude

One-page Jekyll site for His Word Christian Centre (KwaThema), hosted on GitHub Pages from `main`.
Live at https://hiswordchristiancentre.co.za (custom domain via the CNAME file; HTTPS enforced). Verify changes in the
user's Chrome (the sandbox network can't reach the site).
Built and maintained by Ndimatech (Mubarak). Content lives in `_data/*.yml`; `index.html` is the Liquid template.
UPDATING.md is the human guide. Keep it in step with any change to the data format.

## Weekly sermon update (most common request)
- Add the new message at the TOP of `messages:` in `_data/sermons.yml` (title, speaker, youtube, date YYYY-MM-DD).
- Get the exact title from YouTube oEmbed (`https://www.youtube.com/oembed?url=<link>&format=json`). Strip channel
  suffixes like " | Sunday Service" and use Title Case. Fix obvious spelling only if YouTube's title confirms it.
- Store links without tracking params (`?si=…`).
- Lead pastor is written "Ps Sphiwe Magcanya". Other speakers as given.
- If YouTube names no speaker (e.g. just "| Sunday Service"), default to Ps Sphiwe Magcanya and say so in the reply so Mubarak can correct it (agreed 29 Oct 2026).
- Only change `featured:` when asked.

## Rules
- Quote times, phone and account numbers in YAML (unquoted 18:00 parses as a number).
- Never invent content (bank details, events, ministry text). Empty values render a yellow `.tbc` placeholder on purpose.
- Before committing, render-check with `python3 tools/build_preview.py` (needs `pip install "python-liquid<2" pyyaml`)
  and grep the output. Template features must stay within Liquid 4 / Jekyll 3.10 as used by GitHub Pages
  (no includes with Jekyll-only syntax unless verified on Pages).
- After pushing, confirm the Pages build succeeded.
- Launched 12 Oct 2026: `preview: false` (indexable). Setting it back to true adds noindex.
- SEO bits in index.html head: canonical, absolute og:url/og:image, Church JSON-LD built from church.yml. robots.txt + sitemap.xml at root.

## Domain / DNS (domains.co.za customer portal)
- Website: 4 A records on the bare domain → 185.199.108–111.153; `www` CNAME → ndimatech.github.io.
- Email is separate and must not be touched: MX → mx1.tld-mx.com; `mail` A → 169.239.218.79 (cPanel cp79);
  imap/pop/smtp/webmail/cpcalendars/cpcontacts CNAME → mail; SPF `v=spf1 +a:mail… +mx include:_spf.tld-mx.com ~all`.
- Rollback: bare-domain A → 169.239.219.58 (old hosting), `www` CNAME → hiswordchristiancentre.co.za.

## Analytics (GoatCounter, added 15 Oct 2026)
- Dashboard: https://hwcc.goatcounter.com (account on the church email). Script at the end of index.html; no cookies, so no consent banner.
- Clicks are counted with `data-goatcounter-click="name"` on links/buttons (call-us, whatsapp-us, email-us, plan-a-visit,
  watch-online / watch-live (set by main.js during service times), sermon: <title>, social-*, give-online, event-more-info: <name>).
  Tag any new important button the same way. count.js ignores localhost and file:// previews.

## Shop (merchandise, built Nov 2026; full price R11,000, care plan +R200/month)
- Catalogue: `_data/shop.json` (6 items, 34 colourways; T-shirt R250 S–4XL, sweater R400 and hoodie R450 S–2XL).
  Made to order, about 2 weeks. Collect at church free, or flat delivery R149 (South Africa; church's choice 14 Nov 2026).
  The site and the checkout BOTH read this file; prices in cents. `"open": false` hides the shop, empty `"api"` = "opens soon".
  `"test": true` (while closed) shows it only at `/?shoptest=1` (sessionStorage), with a TEST MODE note.
- Shop section sits ABOVE Give (14 Nov 2026, Mubarak). Shop is sand, Give MAROON when open (Mubarak wanted a clear split);
  Give stays sand while the shop is hidden (Liquid + shop.js test mode). CSS/JS links carry ?v=YYYYMMDDx: bump it when
  changing style.css, main.js or shop.js (GitHub Pages caches ~10 min; old shop.js once made the sections look merged). Shop menu link before Give (desktop, mobile, footer).
- Front-end: Shop section in index.html (cards rendered by Liquid), `assets/js/shop.js` (cart in localStorage, drawer,
  POST to the worker, return banner via `?order=<id>`). Images `assets/img/shop/` cropped from the church's AI mock-ups.
- Checkout: `worker/` = Cloudflare Worker `hwcc-website` (https://hwcc-website.round-paper-0c18.workers.dev, Workers Builds from
  this repo, root `worker`, deployed 14 Nov 2026) in the CHURCH's Cloudflare account, D1 `hwcc-shop`,
  Yoco Checkout API (code adapted from malhaya-website/src/yoco.js), signed webhook is the only proof of payment,
  events claimed once, wrong amount = automatic full refund + alert. Order numbers HWCC-1001 upwards.
  Emails via Resend: alerts to ORDER_EMAIL (admin@), buyer receipts only once MAIL_FROM is on a verified domain.
  Resend DNS records go on resend._domainkey + send subdomain only; never touch the main MX/SPF.
- 14 Nov 2026: Yoco TEST key + webhook set; first real test-card payment via /?shoptest=1 confirmed paid by webhook (HWCC-1002;
  1001 was an unpaid attempt). Test orders share the live D1. Resend alert email to admin@ works (HWCC-1003).
  Resend domain verified 14 Nov (records: TXT resend._domainkey,
  CNAME rsend + send → *.forge.rmta.net; existing _dmarc p=none); MAIL_FROM shop@, REPLY_TO admin@.
  Still to do: live key + webhook, small live buy + refund, CLEAR TEST ORDERS (Mubarak asked;
  SHOP-SETUP 5.3), then open.
  Cloudflare Workers Builds lost its GitHub link once (fixed by reconnecting); the D1 is `hwcc-shop`, the Worker `hwcc-website`.
- Mock payments only with `--var ALLOW_MOCK_PAYMENTS:1` (local). Never in wrangler.toml.
- Setup steps for Mubarak: SHOP-SETUP.md. Tests: `cd worker && npm test`; local e2e: wrangler dev + preview with data-api.
- Buyer updates (14 Nov 2026): church chose Option 1, the office WhatsApps/emails buyers by hand from the order alert (no
  Mark ready/sent buttons). Collection times still to come from the church.
- 14 Nov 2026: church approved the shop design; delivery anywhere in South Africa confirmed. Returns policy drafted
  (Claude Doc https://claude.ai/artifact/Q6yJVhNayRaeoDryX6HFWo): 7-day unworn return/exchange, 6-month faults (CPA s56),
  refunds to card within 30 days. Approved 14 Nov; live at /returns.html (noindex until the
  shop opens), linked from the shop note, cart drawer, footer (once open) and buyer receipt. Keep returns.html and the doc in step.
- Tag new shop buttons for GoatCounter; shop.js already counts shop-add, shop-checkout, shop-paid.

