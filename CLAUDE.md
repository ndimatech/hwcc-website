# HWCC website: notes for Claude

One-page Jekyll site for His Word Christian Centre (KwaThema), hosted on GitHub Pages from `main`.
Built and maintained by Ndimatech (Mubarak). Content lives in `_data/*.yml`; `index.html` is the Liquid template.
UPDATING.md is the human guide. Keep it in step with any change to the data format.

## Weekly sermon update (most common request)
- Add the new message at the TOP of `messages:` in `_data/sermons.yml` (title, speaker, youtube, date YYYY-MM-DD).
- Get the exact title from YouTube oEmbed (`https://www.youtube.com/oembed?url=<link>&format=json`). Strip channel
  suffixes like " | Sunday Service" and use Title Case. Fix obvious spelling only if YouTube's title confirms it.
- Store links without tracking params (`?si=…`).
- Lead pastor is written "Ps Sphiwe Magcanya". Other speakers as given.
- Only change `featured:` when asked.

## Rules
- Quote times, phone and account numbers in YAML (unquoted 18:00 parses as a number).
- Never invent content (bank details, events, ministry text). Empty values render a yellow `.tbc` placeholder on purpose.
- Before committing, render-check with `python3 tools/build_preview.py` (needs `pip install "python-liquid<2" pyyaml`)
  and grep the output. Template features must stay within Liquid 4 / Jekyll 3.10 as used by GitHub Pages
  (no includes with Jekyll-only syntax unless verified on Pages).
- After pushing, confirm the Pages build succeeded.
- `preview: true` in `_config.yml` adds noindex. Set it to false only on launch.
