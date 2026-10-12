# His Word Christian Centre — website

One-page site for His Word Christian Centre, KwaThema. Built by Ndimatech.
Hosted on GitHub Pages, which builds it with Jekyll automatically on every commit.

- **To update content** (sermons, events, contact details, giving): see **[UPDATING.md](UPDATING.md)**.
  All content lives in `_data/*.yml`.
- `index.html` — page template (Liquid). Only needed for design or layout changes.
- `assets/css/style.css` — styles (colours under `:root`). `assets/js/main.js` — menu, animations,
  "Watch live" timing, video player, past-event hiding.
- `tools/build_preview.py` — local preview without Jekyll, and builds the single-file preview to share.
