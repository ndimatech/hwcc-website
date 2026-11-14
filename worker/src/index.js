// His Word Christian Centre shop checkout (Cloudflare Worker).
// The website (GitHub Pages) shows the shop; this worker prices orders, opens Yoco's checkout,
// confirms payment from Yoco's signed webhook (never from the return link), and emails the order.
//
// Routes:
//   POST /api/checkout        start an order -> { orderId, redirectUrl }
//   GET  /api/orders/:id      order status for the "thank you" message
//   POST /api/yoco/webhook    Yoco payment events (signed)
//   /mock-yoco/...            test checkout, only when ALLOW_MOCK_PAYMENTS = "1" (local testing)
import { priceOrder, checkCustomer } from "./catalogue.js";
import { paymentMode, isMock, webhookSecret, createCheckout, refundCheckout, verifyWebhook, signWebhook } from "./yoco.js";
import { orderAlert, receipt, send, orderNo } from "./mail.js";

const STALE_CLAIM_MS = 5 * 60 * 1000;
const DEFAULT_SITE = "https://hiswordchristiancentre.co.za";

function site(env) { return (env.SITE_URL || DEFAULT_SITE).replace(/\/$/, ""); }
function allowedOrigins(env) {
  return [site(env), "https://www.hiswordchristiancentre.co.za", ...String(env.EXTRA_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean)];
}
function cors(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" };
}
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname, m = request.method;
    const ch = cors(request, env);
    try {
      if (m === "OPTIONS") return new Response(null, { status: 204, headers: ch });
      if (p === "/api/checkout" && m === "POST") return withCors(await createOrder(request, env), ch);
      const om = p.match(/^\/api\/orders\/([0-9a-f-]{36})$/);
      if (om && m === "GET") return withCors(await orderStatus(om[1], env), ch);
      if (p === "/api/yoco/webhook" && m === "POST") return handleWebhook(request, env);
      if (p.startsWith("/mock-yoco/")) return mockYoco(request, env, url);
      if (p === "/") return new Response("His Word Christian Centre shop checkout.", { headers: { "Content-Type": "text/plain" } });
      return json({ error: "not_found" }, 404);
    } catch (err) {
      console.error(err);
      return withCors(json({ error: "server_error" }, 500), ch);
    }
  },
};

function withCors(res, headers) {
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

async function rateLimited(env, request) {
  if (!env.CHECKOUT_LIMITER) return false;
  const key = request.headers.get("CF-Connecting-IP") || "unknown";
  const { success } = await env.CHECKOUT_LIMITER.limit({ key });
  return !success;
}

// ---------- Orders ----------

async function createOrder(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "invalid_json" }, 400);
  const priced = priceOrder(body.items, body.fulfilment);
  if (priced.error) return json({ error: priced.error }, 400);
  const who = checkCustomer(body);
  if (who.error) return json({ error: who.error }, 400);
  if (await rateLimited(env, request)) return json({ error: "too_many_requests" }, 429);
  if (paymentMode(env) === "off") return json({ error: "payment_unavailable" }, 503);

  const now = Date.now(), id = crypto.randomUUID();
  // Order numbers count up from 1001.
  let orderNumber;
  for (let attempt = 0; attempt < 3 && !orderNumber; attempt++) {
    const row = await env.DB.prepare("SELECT COALESCE(MAX(order_no), 1000) + 1 AS n FROM orders").first();
    try {
      await env.DB.prepare(
        `INSERT INTO orders (id, order_no, status, items_json, subtotal_cents, delivery_cents, total_cents, fulfilment,
           name, phone, email, address_json, notes, created_at, updated_at)
         VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, row.n, JSON.stringify(priced.lines), priced.subtotalCents, priced.deliveryCents, priced.totalCents, body.fulfilment,
        who.customer.name, who.customer.phone, who.customer.email, who.address ? JSON.stringify(who.address) : null,
        who.customer.notes || null, now, now).run();
      orderNumber = row.n;
    } catch (err) {
      if (!String(err).includes("UNIQUE")) throw err; // two orders at the same moment: take the next number
    }
  }
  if (!orderNumber) return json({ error: "server_busy" }, 503);

  const back = `${site(env)}/?order=${id}`;
  const lineItems = priced.lines.map((l) => ({ displayName: `${l.name} (${l.colour}, ${l.size})`, quantity: l.qty, pricingDetails: { price: l.unitCents } }));
  if (priced.deliveryCents) lineItems.push({ displayName: "Courier delivery", quantity: 1, pricingDetails: { price: priced.deliveryCents } });
  let checkout;
  try {
    checkout = await createCheckout(env, {
      amountCents: priced.totalCents, orderId: id,
      metadata: { orderId: id, orderNo: orderNo(orderNumber) },
      successUrl: back, cancelUrl: `${back}&cancelled=1`, failureUrl: `${back}&failed=1`,
      lineItems,
    });
  } catch (err) {
    console.error(err);
    await env.DB.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(Date.now(), id).run();
    return json({ error: "payment_unavailable" }, 502);
  }
  await env.DB.prepare("UPDATE orders SET checkout_id = ?, updated_at = ? WHERE id = ?").bind(checkout.id, Date.now(), id).run();
  const redirectUrl = checkout.redirectUrl.startsWith("/") ? new URL(request.url).origin + checkout.redirectUrl : checkout.redirectUrl;
  return json({ orderId: id, orderNo: orderNo(orderNumber), redirectUrl, totalCents: priced.totalCents }, 201);
}

async function orderStatus(id, env) {
  const o = await env.DB.prepare("SELECT status, order_no, total_cents, fulfilment FROM orders WHERE id = ?").bind(id).first();
  if (!o) return json({ error: "not_found" }, 404);
  return json({ status: o.status, orderNo: orderNo(o.order_no), totalCents: o.total_cents, fulfilment: o.fulfilment });
}

// ---------- Yoco webhook ----------

async function handleWebhook(request, env) {
  const raw = await request.text();
  if (!(await verifyWebhook(webhookSecret(env), request.headers, raw))) return json({ error: "bad_signature" }, 401);
  return runEvent(env, request.headers.get("webhook-id"), JSON.parse(raw));
}

// Claims the event before acting on it, in one statement, so two copies can't both be processed.
async function runEvent(env, eventId, event) {
  const now = Date.now();
  const claim = await env.DB.prepare(
    `INSERT INTO processed_events (id, received_at, status) VALUES (?, ?, 'processing')
     ON CONFLICT(id) DO UPDATE SET received_at = excluded.received_at
     WHERE processed_events.status = 'processing' AND processed_events.received_at < ?`,
  ).bind(eventId, now, now - STALE_CLAIM_MS).run();
  if (claim.meta.changes !== 1) {
    const row = await env.DB.prepare("SELECT status FROM processed_events WHERE id = ?").bind(eventId).first();
    if (row?.status === "done") return json({ ok: true, duplicate: true });
    return json({ error: "in_progress" }, 409); // Yoco retries later
  }
  let result;
  try {
    result = await processEvent(env, event);
  } catch (err) {
    console.error("webhook processing failed", err);
    await env.DB.prepare("DELETE FROM processed_events WHERE id = ? AND status = 'processing'").bind(eventId).run();
    return json({ error: "processing_failed" }, 500);
  }
  await env.DB.prepare("UPDATE processed_events SET status = 'done' WHERE id = ?").bind(eventId).run();
  return json({ ok: true, result });
}

async function processEvent(env, event) {
  const meta = event.payload?.metadata || {};
  const o = await env.DB.prepare("SELECT * FROM orders WHERE checkout_id = ? OR id = ?").bind(meta.checkoutId || "", meta.orderId || "").first();
  if (!o) return "unknown_checkout";
  if (event.type === "refund.succeeded") {
    await env.DB.prepare("UPDATE orders SET refund_status = 'succeeded', updated_at = ? WHERE id = ?").bind(Date.now(), o.id).run();
    return "refund_recorded";
  }
  if (event.type !== "payment.succeeded") return "ignored";
  if (o.status === "paid") return "already_paid";
  const now = Date.now();
  if (event.payload?.amount === o.total_cents && (o.status === "pending" || o.status === "cancelled")) {
    // A "cancelled" order here means checkout creation looked failed but Yoco took the payment anyway: honour it.
    await env.DB.prepare("UPDATE orders SET status = 'paid', payment_id = ?, paid_at = ?, updated_at = ? WHERE id = ? AND status IN ('pending', 'cancelled')")
      .bind(event.payload?.id || null, now, now, o.id).run();
    await send(env, o.id, env.ORDER_EMAIL, orderAlert(o));
    await send(env, o.id, o.email, receipt(o), { needsOwnDomain: true });
    return "order_paid";
  }
  // Wrong amount: never keep money that doesn't match the order. Refund in full and tell the church.
  let refund = "failed";
  try { refund = (await refundCheckout(env, o.checkout_id, `refund-${o.id}`)).status || "pending"; } catch (err) { console.error(err); }
  await env.DB.prepare("UPDATE orders SET status = 'refunded', payment_id = ?, refund_status = ?, updated_at = ? WHERE id = ? AND status != 'paid'")
    .bind(event.payload?.id || null, refund, now, o.id).run();
  await send(env, o.id, env.ORDER_EMAIL, {
    subject: `Shop payment refunded: ${orderNo(o.order_no)} (${o.name})`,
    text: `A payment for order ${orderNo(o.order_no)} didn't match the order total, so it was refunded (refund status: ${refund}). Cellphone: ${o.phone}. If the refund failed, refund it in the Yoco app.`,
  });
  return "amount_mismatch_refunded";
}

// ---------- Test checkout (local testing only) ----------

async function mockYoco(request, env, url) {
  if (!isMock(env)) return json({ error: "not_found" }, 404);
  const mm = url.pathname.match(/^\/mock-yoco\/(ch_mock_\w+)(\/pay|\/cancel)?$/);
  if (!mm) return json({ error: "not_found" }, 404);
  const o = await env.DB.prepare("SELECT * FROM orders WHERE checkout_id = ?").bind(mm[1]).first();
  if (!o) return json({ error: "not_found" }, 404);
  const back = `${site(env)}/?order=${o.id}`;
  if (request.method === "GET" && !mm[2]) {
    const items = JSON.parse(o.items_json).map((l) => `<li>${l.qty} x ${l.name}, ${l.colour}, ${l.size}</li>`).join("");
    return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test checkout</title>
<body style="font-family:system-ui;max-width:420px;margin:40px auto;padding:0 16px">
<p style="background:#ffe08a;padding:8px 12px;border-radius:8px">TEST CHECKOUT: no card is charged.</p>
<h1>Pay R${(o.total_cents / 100).toFixed(2)}</h1><ul>${items}</ul>
<form method="post" action="/mock-yoco/${mm[1]}/pay"><button style="font-size:18px;padding:12px 20px">Pay (test)</button></form>
<form method="post" action="/mock-yoco/${mm[1]}/cancel"><button style="margin-top:12px">Cancel</button></form></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (request.method === "POST" && mm[2] === "/cancel") return Response.redirect(`${back}&cancelled=1`, 303);
  if (request.method === "POST" && mm[2] === "/pay") {
    const event = { id: "evt_mock_" + crypto.randomUUID().slice(0, 8), type: "payment.succeeded",
      payload: { id: "p_mock_" + crypto.randomUUID().slice(0, 8), amount: o.total_cents, currency: "ZAR", status: "succeeded", mode: "test", metadata: { checkoutId: mm[1] } } };
    const raw = JSON.stringify(event), msgId = "msg_" + crypto.randomUUID().slice(0, 12), ts = String(Math.floor(Date.now() / 1000));
    const sig = await signWebhook(webhookSecret(env), msgId, ts, raw);
    await handleWebhook(new Request(`${url.origin}/api/yoco/webhook`, { method: "POST", headers: { "webhook-id": msgId, "webhook-timestamp": ts, "webhook-signature": sig }, body: raw }), env);
    return Response.redirect(back, 303);
  }
  return json({ error: "not_found" }, 404);
}
