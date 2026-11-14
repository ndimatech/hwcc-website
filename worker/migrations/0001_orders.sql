-- Shop orders. Amounts in cents.
CREATE TABLE orders (
  id             TEXT PRIMARY KEY,           -- random id (used in the return link)
  order_no       INTEGER NOT NULL UNIQUE,    -- shown to people: HWCC-1001
  status         TEXT NOT NULL,              -- pending | paid | refunded | cancelled
  items_json     TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  delivery_cents INTEGER NOT NULL,
  total_cents    INTEGER NOT NULL,
  fulfilment     TEXT NOT NULL,              -- collect | deliver
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,
  email          TEXT NOT NULL,
  address_json   TEXT,
  notes          TEXT,
  checkout_id    TEXT,
  payment_id     TEXT,
  refund_status  TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  paid_at        INTEGER
);
CREATE UNIQUE INDEX idx_orders_checkout ON orders(checkout_id);

-- Yoco webhook events, claimed before processing so each is handled exactly once.
CREATE TABLE processed_events (
  id          TEXT PRIMARY KEY,
  received_at INTEGER NOT NULL,
  status      TEXT NOT NULL                 -- processing | done
);

-- Emails sent (or that couldn't be sent), for checking. Kept 90 days.
CREATE TABLE email_log (
  id         TEXT PRIMARY KEY,
  order_id   TEXT,
  to_addr    TEXT,
  subject    TEXT,
  status     TEXT,
  created_at INTEGER NOT NULL
);
