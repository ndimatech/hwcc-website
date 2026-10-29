# Updating the HWCC website

Everything that changes lives in the **`_data/`** folder. You never need to touch `index.html` for normal updates.

| File | What's in it | How often |
| --- | --- | --- |
| `_data/sermons.yml` | Featured video, recent messages | **Weekly** |
| `_data/events.yml` | Upcoming events | When events are announced |
| `_data/church.yml` | Phone, email, service times, livestream, socials, next steps, giving | Rarely |
| `_data/ministries.yml` | Ministry descriptions and photos | Rarely |

Each change: edit the file on github.com → **Commit changes** → the live site updates in about 1 minute.

---

## Weekly sermon update (about 2 minutes, works on a phone)

1. Open the edit page for the sermons file (bookmark it):
   `https://github.com/ndimatech/hwcc-website/edit/main/_data/sermons.yml`
2. Copy an existing message block (4 lines) and paste it at the top of `messages:`:
   ```yaml
   messages:
     - title: New Message Title
       speaker: Ps Sphiwe Magcanya
       youtube: https://youtu.be/XXXXXXXXXXX
       date: 2026-10-18

     - title: Midwives of Purpose
       ...
   ```
3. Click **Commit changes…** → **Commit changes**.

The site shows the featured video (if one is set) as the big video, then the next 3 messages as "Recent messages".
If `featured:` is empty, the newest message becomes the big video automatically.

**Featuring a series or special message:** fill in the block under `featured:` (label, title, subtitle, youtube, optional image).
**Back to "newest message is the big video":** delete the lines under `featured:` so only `featured:` remains.

Any YouTube link works: `youtu.be/…`, `youtube.com/watch?v=…`, `youtube.com/live/…`, or a playlist link.

## Events

Add an event to `_data/events.yml`:
```yaml
- name: Youth Conference
  date: 2026-11-14
  time: "09:00"
  venue: HWCC, KwaThema
  description: One or two sentences.
  link:
```
The site shows the next 3 upcoming events. Past events hide themselves automatically.

---

## Rules that prevent 90% of mistakes

- **Spaces, not tabs.** Keep the indentation exactly as in the lines around it (2 spaces per level).
- **A space after every colon:** `title: Hello`, not `title:Hello`.
- **Quotes around times, phone numbers and account numbers:** `time: "18:00"`, `phone: "011 123 4567"`.
  Without quotes YAML can turn them into numbers (18:00 becomes 1080).
- **Dates as YYYY-MM-DD:** `2026-10-18`.
- A title containing a colon needs quotes: `title: "Faith: The Substance"`.

**If something goes wrong:** a broken edit never breaks the live site. GitHub keeps the previous version online
and emails you that the build failed. Open the repo's **Actions** tab, click the failed run, and it shows the
file and line number. Fix the line and commit again. Every change is kept in the history, so anything can be undone.

## Checking a change before committing (optional)

On a computer with Python:
```
pip install "python-liquid<2" pyyaml
python3 tools/build_preview.py
```
This builds `_preview/index.html` and a single-file `HWCC-homepage-preview.html` you can send to people.

---

## One-time setup on GitHub

1. Create a **public** repository (GitHub Pages is free for public repos), e.g. `hwcc-website`.
2. **Add file → Upload files**, drag in everything from this folder (including the `_data` folder), commit.
3. **Settings → Pages →** Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
4. After a minute the site is live. (Done: it now serves at `https://hiswordchristiancentre.co.za`.)

**Letting a church member post sermons themselves (optional):** Settings → Collaborators → add their GitHub account.
They can then use the same edit link, and you can see every change they make in the history.

## Launch day

_Launched 12 Oct 2026: domain connected, HTTPS enforced, all placeholders filled, Google listing on. Remaining: step 2 (domain verification)._

1. In `_config.yml`, change `preview: true` to `preview: false` (lets Google list the site).
2. Verify the domain first (stops anyone else's GitHub site from claiming it): your GitHub account
   **Settings → Pages → Add a domain** → enter `hiswordchristiancentre.co.za` → add the TXT record it shows at
   the domain's DNS provider → **Verify**.
3. Custom domain (`hiswordchristiancentre.co.za`): Settings → Pages → Custom domain → enter the domain → Save.
   At the domain's DNS provider add:
   - `A` records for the bare domain: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` record: `www` → `ndimatech.github.io`

   **Do not change the MX records.** They deliver the church's email.
4. When the certificate is ready, tick **Enforce HTTPS** on the Pages settings page.
5. In `_data/church.yml`, empty fields still show a yellow placeholder. Fill them or remove those
   items before launch, then delete the `.tbc { … }` rule near the top of `assets/css/style.css`.

## Changing photos

Upload to `assets/img/` (WebP or JPG). To replace an existing photo, upload a file with the **same name**.
Banner photo: at least 2400 px wide. Others: about 1200 px on the long side. Use original files, not
WhatsApp or social-media copies.
