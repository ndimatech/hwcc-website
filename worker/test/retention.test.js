import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanUp, RETENTION } from "../src/index.js";

test("retention matches privacy.html: 14 days unpaid, 120 days logs, 5 years paid", async () => {
  assert.deepEqual(RETENTION, { unpaidDays: 14, logDays: 120, paidYears: 5 });
  const calls = [];
  const env = { DB: { prepare: (sql) => ({ bind: (cutoff) => ({ run: async () => { calls.push([sql, cutoff]); return { meta: { changes: 0 } }; } }) }) } };
  const now = Date.UTC(2026, 10, 14);
  await cleanUp(env, now);
  const day = 86400000;
  assert.equal(calls.length, 4);
  assert.match(calls[0][0], /payment_id IS NULL/);
  assert.equal(calls[0][1], now - 14 * day);
  assert.equal(calls[1][1], now - 5 * 365 * day);
  assert.equal(calls[2][1], now - 120 * day);
});
