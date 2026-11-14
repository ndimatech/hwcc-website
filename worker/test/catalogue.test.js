import { test } from "node:test";
import assert from "node:assert/strict";
import { priceOrder, checkCustomer, SHOP } from "../src/catalogue.js";
import { signWebhook, verifyWebhook, MOCK_WEBHOOK_SECRET } from "../src/yoco.js";

test("prices come from the catalogue, not the browser", () => {
  const r = priceOrder([{ productId: "hoodie-elihle", colourId: "cream-maroon", size: "L", qty: 2, priceCents: 1 }], "deliver");
  assert.equal(r.subtotalCents, 90000);
  assert.equal(r.deliveryCents, 14900);
  assert.equal(r.totalCents, 104900);
});
test("collect is free; tee + sweater", () => {
  const r = priceOrder([{ productId: "tee-cross", colourId: "black-white", size: "4XL", qty: 1 }, { productId: "sweater-cross", colourId: "white-gold", size: "S", qty: 1 }], "collect");
  assert.equal(r.totalCents, 65000);
});
test("rejects unknown colour, size not offered, bad qty, bad fulfilment", () => {
  assert.equal(priceOrder([{ productId: "tee-cross", colourId: "pink-white", size: "M", qty: 1 }], "collect").error, "unknown_colour");
  assert.equal(priceOrder([{ productId: "hoodie-cross", colourId: "black-white", size: "4XL", qty: 1 }], "collect").error, "unknown_size");
  assert.equal(priceOrder([{ productId: "tee-cross", colourId: "black-white", size: "M", qty: 0 }], "collect").error, "invalid_quantity");
  assert.equal(priceOrder([{ productId: "tee-cross", colourId: "black-white", size: "M", qty: 1.5 }], "collect").error, "invalid_quantity");
  assert.equal(priceOrder([{ productId: "tee-cross", colourId: "black-white", size: "M", qty: 1 }], "teleport").error, "invalid_fulfilment");
  assert.equal(priceOrder([], "collect").error, "empty_cart");
});
test("closed shop refuses orders", () => {
  assert.equal(priceOrder([{ productId: "tee-cross", colourId: "black-white", size: "M", qty: 1 }], "collect", { ...SHOP, open: false, test: false }).error, "shop_closed");
  assert.equal(priceOrder([{ productId: "tee-cross", colourId: "black-white", size: "M", qty: 1 }], "collect", { ...SHOP, open: false, test: true }).error, undefined);
});
test("every catalogue image and size list is sane", () => {
  for (const p of SHOP.products) {
    assert.ok(p.priceCents > 0 && p.sizes.length && p.colours.length, p.id);
    assert.equal(new Set(p.colours.map((c) => c.id)).size, p.colours.length, p.id + " duplicate colour id");
  }
});
test("customer checks", () => {
  const ok = { name: "Thandi M", phone: "082 123 4567", email: "t@example.com", fulfilment: "collect" };
  assert.ok(checkCustomer(ok).customer);
  assert.equal(checkCustomer({ ...ok, phone: "12345" }).error, "invalid_phone");
  assert.equal(checkCustomer({ ...ok, phone: "+27 82 123 4567" }).error, undefined);
  assert.equal(checkCustomer({ ...ok, email: "nope" }).error, "invalid_email");
  assert.equal(checkCustomer({ ...ok, fulfilment: "deliver", address: { street: "1 Main", city: "Springs", province: "Gauteng", postalCode: "156" } }).error, "invalid_postal_code");
  assert.ok(checkCustomer({ ...ok, fulfilment: "deliver", address: { street: "1 Main", city: "Springs", province: "Gauteng", postalCode: "1575" } }).address);
});
test("webhook signatures verify and reject tampering or old timestamps", async () => {
  const ts = String(Math.floor(Date.now() / 1000)), body = '{"a":1}';
  const sig = await signWebhook(MOCK_WEBHOOK_SECRET, "msg_1", ts, body);
  const h = (s, t = ts) => new Headers({ "webhook-id": "msg_1", "webhook-timestamp": t, "webhook-signature": s });
  assert.equal(await verifyWebhook(MOCK_WEBHOOK_SECRET, h(sig), body), true);
  assert.equal(await verifyWebhook(MOCK_WEBHOOK_SECRET, h(sig), '{"a":2}'), false);
  assert.equal(await verifyWebhook(MOCK_WEBHOOK_SECRET, h(sig, String(Number(ts) - 600)), body), false);
});

test("R10 payment-test item: only in test mode, never once open", () => {
  const testItem = { id: "payment-test", testOnly: true, name: "Payment test", kind: "Test", priceCents: 1000, sizes: ["One size"], colours: [{ id: "test", name: "Test" }] };
  const shop = { ...SHOP, products: [...SHOP.products.filter((p) => !p.testOnly), testItem] };
  const item = [{ productId: "payment-test", colourId: "test", size: "One size", qty: 1 }];
  assert.equal(priceOrder(item, "collect", { ...shop, open: false, test: true }).totalCents, 1000);
  assert.equal(priceOrder(item, "collect", { ...shop, open: true, test: true }).error, "unknown_product");
  assert.equal(priceOrder(item, "collect", { ...shop, open: true, test: false }).error, "unknown_product");
});
