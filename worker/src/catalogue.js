// Prices every order from _data/shop.json, the same file the website shows.
// Whatever the browser sends as a price is ignored.
import SHOP from "../../_data/shop.json" with { type: "json" };

export { SHOP };
export const MAX_QTY = 20;
export const MAX_LINES = 30;
export const PROVINCES = ["Gauteng", "Eastern Cape", "Free State", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];

export function priceOrder(items, fulfilment, shop = SHOP) {
  if (!shop.open && !shop.test) return { error: "shop_closed" };   // test: hidden ?shoptest=1 mode before launch
  if (!Array.isArray(items) || items.length === 0) return { error: "empty_cart" };
  if (items.length > MAX_LINES) return { error: "too_many_lines" };
  if (fulfilment !== "collect" && fulfilment !== "deliver") return { error: "invalid_fulfilment" };
  const lines = [];
  for (const it of items) {
    const p = shop.products.find((x) => x.id === it?.productId);
    if (!p) return { error: "unknown_product" };
    if (p.testOnly && (shop.open || !shop.test)) return { error: "unknown_product" };   // R10 payment test: test mode only
    const c = p.colours.find((x) => x.id === it.colourId);
    if (!c) return { error: "unknown_colour" };
    if (!p.sizes.includes(it.size)) return { error: "unknown_size" };
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return { error: "invalid_quantity" };
    lines.push({
      productId: p.id, colourId: c.id, size: it.size, qty,
      name: p.name, colour: c.name, unitCents: p.priceCents, lineCents: p.priceCents * qty,
    });
  }
  const subtotalCents = lines.reduce((s, l) => s + l.lineCents, 0);
  const deliveryCents = fulfilment === "deliver" ? shop.deliveryCents : 0;
  return { lines, subtotalCents, deliveryCents, totalCents: subtotalCents + deliveryCents };
}

const clean = (v, n) => String(v ?? "").trim().slice(0, n);

// Validates the buyer's details. Returns { error } or { customer, address }.
export function checkCustomer(body) {
  const customer = { name: clean(body?.name, 80), phone: clean(body?.phone, 20), email: clean(body?.email, 120).toLowerCase(), notes: clean(body?.notes, 400) };
  if (!customer.name || !customer.phone || !customer.email) return { error: "missing_details" };
  const digits = customer.phone.replace(/[\s()-]/g, "");
  if (!/^(\+?27|0)\d{9}$/.test(digits)) return { error: "invalid_phone" };
  // One address only: commas and semicolons would make the mailer send to a second address (14 Nov 2026).
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(customer.email)) return { error: "invalid_email" };
  if (body.fulfilment !== "deliver") return { customer, address: null };
  const a = body.address || {};
  const address = { street: clean(a.street, 120), suburb: clean(a.suburb, 60), city: clean(a.city, 60), province: clean(a.province, 30), postalCode: clean(a.postalCode, 4) };
  if (!address.street || !address.city) return { error: "missing_address" };
  if (!PROVINCES.includes(address.province)) return { error: "invalid_province" };
  if (!/^\d{4}$/.test(address.postalCode)) return { error: "invalid_postal_code" };
  return { customer, address };
}
