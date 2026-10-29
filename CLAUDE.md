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

