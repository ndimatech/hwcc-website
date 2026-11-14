// Order emails, sent through Resend (https://resend.com).
//   RESEND_API_KEY (secret)  - without it nothing is sent; each email is only logged.
//   ORDER_EMAIL              - who gets new-order alerts (comma-separate for more than one).
//   MAIL_FROM                - sender on the church's own domain once it is verified in Resend,
//                              e.g. "His Word Christian Centre <shop@hiswordchristiancentre.co.za>".
// Until MAIL_FROM is set, alerts go from Resend's test sender, which only delivers to the address
// the Resend account was opened with (so open it with admin@...), and buyer receipts are not sent.
const R = (c) => "R" + Math.round(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const orderNo = (n) => `HWCC-${n}`;
const join = (...xs) => xs.filter((x) => x !== null && x !== undefined && x !== false).join("\n").replace(/\n{3,}/g, "\n\n").trim();

function itemLines(o) {
  return JSON.parse(o.items_json).map((l) => `${l.qty} x ${l.name}, ${l.colour}, size ${l.size}  ${R(l.lineCents)}`);
}
function addressText(o) {
  const a = o.address_json ? JSON.parse(o.address_json) : null;
  return a ? [a.street, a.suburb, a.city, a.province, a.postalCode].filter(Boolean).join(", ") : null;
}
function totalsText(o) {
  return [
    `Items: ${R(o.subtotal_cents)}`,
    o.delivery_cents ? `Delivery: ${R(o.delivery_cents)}` : "Collect At Church: free",
    `Total paid: ${R(o.total_cents)}`,
  ];
}

export function orderAlert(o) {
  return {
    subject: `New shop order ${orderNo(o.order_no)}: ${R(o.total_cents)} from ${o.name}`,
    text: join(
      `New shop order, paid by card (Yoco).`, "",
      ...itemLines(o), "",
      ...totalsText(o), "",
      o.fulfilment === "deliver" ? `DELIVER to: ${addressText(o)}` : "COLLECT AT CHURCH",
      "",
      `Name: ${o.name}`,
      `Cellphone: ${o.phone}`,
      `Email: ${o.email}`,
      o.notes && `Notes: ${o.notes}`, "",
      `Order number: ${orderNo(o.order_no)} (the buyer has this on their receipt).`,
      `Made to order: the buyer was told about 2 weeks.`,
    ),
  };
}

export function receipt(o) {
  return {
    subject: `Your order ${orderNo(o.order_no)} from His Word Christian Centre`,
    text: join(
      `Hi ${o.name.split(" ")[0]},`, "",
      `Thank you for your order. Your payment of ${R(o.total_cents)} has been received.`, "",
      ...itemLines(o), "",
      ...totalsText(o), "",
      o.fulfilment === "deliver"
        ? `We'll courier it to: ${addressText(o)}`
        : `Collect it at His Word Christian Centre. We'll let you know when it's ready.`,
      `Everything is made to order, so please allow about 2 weeks.`, "",
      `Order number: ${orderNo(o.order_no)}`,
      `Questions? Reply to this email or contact the church office.`,
      `Returns and refunds: https://hiswordchristiancentre.co.za/returns.html`, "",
      `His Word Christian Centre`,
      `His Will. His Way. His Word.`,
    ),
  };
}

export async function send(env, orderId, to, { subject, text }, { needsOwnDomain = false } = {}) {
  const list = String(to || "").split(",").map((s) => s.trim()).filter(Boolean);
  let status;
  if (!env.RESEND_API_KEY) status = "not_sent: no RESEND_API_KEY";
  else if (!list.length) status = "not_sent: no recipient";
  else if (needsOwnDomain && !env.MAIL_FROM) status = "not_sent: MAIL_FROM not set (domain not verified yet)";
  else {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.MAIL_FROM || "HWCC shop <onboarding@resend.dev>",
          to: list, subject, text,
          ...(env.REPLY_TO ? { reply_to: env.REPLY_TO } : {}),
        }),
      });
      status = r.ok ? "sent" : `failed: ${r.status} ${(await r.text()).slice(0, 200)}`;
    } catch (err) {
      status = `failed: ${String(err).slice(0, 200)}`;
    }
  }
  await env.DB.prepare("INSERT INTO email_log (id, order_id, to_addr, subject, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), orderId, list.join(", "), subject, status, Date.now()).run().catch(console.error);
  return status;
}
