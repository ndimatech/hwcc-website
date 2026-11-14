// Yoco Checkout API client, plus a mock used when no secret key is configured.
// Docs: https://developer.yoco.com/guides/online-payments

const API = "https://payments.yoco.com/api";
export const MOCK_WEBHOOK_SECRET = "whsec_" + btoa("hwcc-shop-local-mock-secret-32by!");

// Which payment mode the checkout runs in:
//   "live" - a Yoco key is configured (Yoco's own test keys count: Yoco decides test vs live).
//   "mock" - a built-in test checkout, only when ALLOW_MOCK_PAYMENTS = "1" (set on the command line for
//            local testing; never in wrangler.toml).
//   "off"  - neither. Checkouts fail safely with "payment_unavailable".
export function paymentMode(env) {
  if (env.YOCO_SECRET_KEY) return "live";
  return env.ALLOW_MOCK_PAYMENTS === "1" ? "mock" : "off";
}

export function isMock(env) {
  return paymentMode(env) === "mock";
}

function requireLive(env) {
  if (paymentMode(env) !== "live") throw new Error("Payments are not configured (no YOCO_SECRET_KEY)");
}

export function webhookSecret(env) {
  const mode = paymentMode(env);
  if (mode === "live") return env.YOCO_WEBHOOK_SECRET || null;
  return mode === "mock" ? MOCK_WEBHOOK_SECRET : null;
}

export async function createCheckout(env, { amountCents, orderId, metadata, successUrl, cancelUrl, failureUrl, lineItems }) {
  if (!isMock(env)) requireLive(env);
  if (isMock(env)) {
    const id = "ch_mock_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    return { id, redirectUrl: `/mock-yoco/${id}` };
  }
  const res = await fetch(`${API}/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.YOCO_SECRET_KEY}`,
      "Idempotency-Key": orderId, // one checkout per order, safe to retry
    },
    body: JSON.stringify({
      amount: amountCents,
      currency: "ZAR",
      successUrl, cancelUrl, failureUrl,
      metadata: metadata || { orderId },
      lineItems,
    }),
  });
  if (!res.ok) throw new Error(`Yoco checkout failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, redirectUrl: data.redirectUrl };
}

// Full refund of a checkout (Yoco's Checkout API does not support partial refunds).
export async function refundCheckout(env, checkoutId, idempotencyKey) {
  if (isMock(env)) return { status: "succeeded", mock: true };
  requireLive(env);
  const res = await fetch(`${API}/checkouts/${checkoutId}/refund`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.YOCO_SECRET_KEY}`, "Idempotency-Key": idempotencyKey },
  });
  if (!res.ok) throw new Error(`Yoco refund failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---- Webhook signatures (Standard Webhooks, as Yoco documents) ----

function b64ToBytes(b64) {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToB64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

async function hmac(secret, content) {
  const key = await crypto.subtle.importKey(
    "raw", b64ToBytes(secret.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return bytesToB64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(content)));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signWebhook(secret, id, timestamp, rawBody) {
  return "v1," + (await hmac(secret, `${id}.${timestamp}.${rawBody}`));
}

// Returns true only if the signature matches and the timestamp is within 3 minutes.
export async function verifyWebhook(secret, headers, rawBody, nowMs = Date.now()) {
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!secret || !id || !ts || !sigHeader) return false;
  if (Math.abs(nowMs / 1000 - Number(ts)) > 180) return false;
  const expected = await hmac(secret, `${id}.${ts}.${rawBody}`);
  return sigHeader.split(" ").some((part) => {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    return safeEqual(sig, expected);
  });
}
