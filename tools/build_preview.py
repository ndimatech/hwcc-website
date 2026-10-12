#!/usr/bin/env python3
"""Build the site locally, without Jekyll, to check changes before pushing.

    pip install "python-liquid<2" pyyaml
    python3 tools/build_preview.py

Writes:
  _preview/index.html          — open with any local web server (python3 -m http.server -d _preview)
  HWCC-homepage-preview.html   — one self-contained file (images, fonts, CSS, JS inside) to send to people

GitHub Pages builds the real site with Jekyll; this script mirrors what Jekyll
does for this page (site.data, site.time, site.preview) closely enough to preview it.
"""
import base64, datetime as dt, pathlib, re, shutil, sys, zoneinfo
import yaml
from liquid import Environment

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load_site():
    data = {p.stem: yaml.safe_load(p.read_text(encoding="utf-8")) for p in sorted((ROOT / "_data").glob("*.yml"))}
    config = yaml.safe_load((ROOT / "_config.yml").read_text(encoding="utf-8")) or {}
    tz = zoneinfo.ZoneInfo(config.get("timezone", "Africa/Johannesburg"))
    site = dict(config)
    site["data"] = data
    site["time"] = dt.datetime.now(tz)
    return site


def render(site):
    src = (ROOT / "index.html").read_text(encoding="utf-8")
    src = re.sub(r"\A---\n.*?\n---\n", "", src, count=1, flags=re.S)  # strip front matter
    return Environment().from_string(src).render(site=site)


def inline(html):
    def b64(path, mime):
        return f"data:{mime};base64," + base64.b64encode((ROOT / path).read_bytes()).decode()

    css = (ROOT / "assets/css/style.css").read_text(encoding="utf-8")
    css = re.sub(r"url\('\.\./fonts/([^']+)'\)", lambda m: f"url('{b64('assets/fonts/' + m.group(1), 'font/woff2')}')", css)
    js = (ROOT / "assets/js/main.js").read_text(encoding="utf-8")
    html = re.sub(r'\s*<link rel="preload"[^>]*>', "", html)
    html = html.replace('<link rel="stylesheet" href="assets/css/style.css">', "<style>\n" + css + "\n</style>")
    html = html.replace('<script src="assets/js/main.js" defer></script>', "<script>\n" + js + "\n</script>")
    html = re.sub(r'(src|content|data-img)="(assets/img/[^"]+\.(webp|jpg|png))"',
                  lambda m: f'{m.group(1)}="{b64(m.group(2), "image/" + ("jpeg" if m.group(3) == "jpg" else m.group(3)))}"', html)
    html = html.replace('<link rel="icon" href="favicon.svg" type="image/svg+xml">',
                        '<link rel="icon" href="' + b64("favicon.svg", "image/svg+xml") + '">')
    if '<meta name="robots"' not in html:
        html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="robots" content="noindex, nofollow">', 1)
    html = html.replace("<title>His Word Christian Centre", "<title>PREVIEW · His Word Christian Centre", 1)
    return html


def main():
    site = load_site()
    html = render(site)
    out = ROOT / "_preview"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir()
    (out / "index.html").write_text(html, encoding="utf-8")
    shutil.copytree(ROOT / "assets", out / "assets")
    shutil.copy(ROOT / "favicon.svg", out / "favicon.svg")
    target = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "HWCC-homepage-preview.html"
    target.write_text(inline(html), encoding="utf-8")
    print(f"Built {out / 'index.html'} and {target}")


if __name__ == "__main__":
    main()
