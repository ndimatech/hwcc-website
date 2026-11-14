# Shop checkout: one-time setup

The shop has two parts:

- **The shop on the website** (`_data/shop.json`, `assets/js/shop.js`), on GitHub Pages like the rest of the site.
- **The checkout** (`worker/`), a small Cloudflare Worker in the **church's** Cloudflare account. It recalculates
  every price from `_data/shop.json`, opens Yoco's checkout, confirms the payment from Yoco's signed webhook and
  emails the order.

Switches in `_data/shop.json`:
- `"open": false` hides the shop from the public.
- `"test": true` (while closed) lets you try it on the real site at **https://hiswordchristiancentre.co.za/?shoptest=1**
  (a "TEST MODE" note shows; nobody else sees the shop). The link is remembered until the browser tab is closed,
  so the return from Yoco's page still shows it.
- Empty `"api"` means "Pay" says payment opens soon.

Checkout address: **https://hwcc-website.round-paper-0c18.workers.dev** (Worker `hwcc-website`).

Do these in order. Never paste keys into chat, email or GitHub: they go into Cloudflare only.

## 1. Cloudflare account (church) (done 14 Nov 2026)
1. Sign up at dash.cloudflare.com with **admin@hiswordchristiancentre.co.za**.
2. **Storage & databases → D1 → Create** a database named `hwcc-shop`. Copy its **Database ID** and put it in
   `worker/wrangler.toml` (`database_id`), or send it to Mubarak/Claude to put in. It isn't secret.

## 2. Connect the code (done 14 Nov 2026)
1. **Workers & Pages → Create → Import a repository** → GitHub → `ndimatech/hwcc-website`
   (allow Cloudflare's GitHub app to see this repo).
2. Settings:
   - Project name: `hwcc-website` (must match `name` in `worker/wrangler.toml`)
   - Production branch: `main`
   - Root directory: `worker`
   - Build command: `npm ci`
   - Deploy command: `npm run deploy` (creates the order tables, then deploys)
3. After the first deploy, note the address: `https://hwcc-website.round-paper-0c18.workers.dev`.
   Opening it should show "His Word Christian Centre shop checkout."

## 3. Yoco (test first)
1. In the Yoco portal, open the online payments / payment gateway settings and copy the API keys.
   Start with the **test** secret key (`sk_test_…`).
2. Cloudflare: **Workers → hwcc-website → Settings → Variables and Secrets → Add**, type **Secret**:
   `YOCO_SECRET_KEY` = the test secret key. The name must be exactly `YOCO_SECRET_KEY` (done 14 Nov 2026, with the webhook).
3. Register the webhook (Yoco has no screen for this). On a computer, run, with your key in place of sk_test_YOUR_KEY:
   ```
   curl -X POST https://payments.yoco.com/api/webhooks \
     -H "Authorization: Bearer sk_test_YOUR_KEY" -H "Content-Type: application/json" \
     -d '{"name":"hwcc-shop","url":"https://hwcc-website.round-paper-0c18.workers.dev/api/yoco/webhook"}'
   ```
   The reply contains `"secret": "whsec_…"`. Add it as a Secret named `YOCO_WEBHOOK_SECRET`.
4. Test on https://hiswordchristiancentre.co.za/?shoptest=1 with Yoco's test card: pay, check the "Thank you" banner
   and the order email.

## 4. Order emails (Resend) (done 14 Nov 2026: domain verified, eu-west-1)
1. Sign up at resend.com with **admin@hiswordchristiancentre.co.za**. Create an API key and add it as a Secret
   named `RESEND_API_KEY`.
2. From then on, new-order emails reach admin@ (Resend's test sender only delivers to the account's own address).
3. Buyer receipts need the church's domain verified in Resend: **Domains → Add** `hiswordchristiancentre.co.za`, then
   add the records Resend shows at domains.co.za. They go on `resend._domainkey` and the `send` subdomain only.
   **Don't change the existing MX or SPF records on the main domain: they carry the church's email.**
   When Resend says Verified, set `MAIL_FROM` in `worker/wrangler.toml` (and `REPLY_TO`).

## 5. Going live
1. Replace `YOCO_SECRET_KEY` with the **live** key (`sk_live_…`).
2. Register the webhook again with the live key (step 3.3) and replace `YOCO_WEBHOOK_SECRET` with the new secret.
3. Make one small real purchase via `?shoptest=1`: the R10 "Payment test" item, Collect at church. Refund it in the Yoco app.
   Then clear the test orders so real ones start at HWCC-1001: Cloudflare → **Storage & databases → D1 → hwcc-shop →
   Console**, run `DELETE FROM orders; DELETE FROM processed_events; DELETE FROM email_log;`
4. Set `"open": true` in `_data/shop.json` (and `"test": false`), and delete the `payment-test` product. The Shop link appears in the menu.

## Changing products or prices
Edit `_data/shop.json` (prices in cents: R250 = `25000`). The website and the checkout both update on the next
commit. Product photos go in `assets/img/shop/` (4:3, about 1000 × 750).

## Local testing (developers)
```
cd worker && npm ci && npm run migrate:local && npm run dev    # test checkout on http://localhost:8787
python3 tools/build_preview.py                                 # then point data-api in _preview at :8787
npm test                                                       # pricing + webhook signature tests
```
