import test from "node:test";
import assert from "node:assert/strict";
import {
  namesMatch,
  normalizePriority,
  normalizeSource,
  normalizeState,
  normalizeWorkOrderStatus,
} from "../lib/integrations/gpt-normalize.ts";

test("matches company names ignoring punctuation", () => {
  assert.equal(namesMatch("Bayou Retail Group", "bayou-retail group"), true);
  assert.equal(namesMatch("Bayou Retail Group", "Gulf Coast"), false);
});

test("normalizes dispatch fields from GPT language", () => {
  assert.equal(normalizePriority("ASAP emergency"), "emergency");
  assert.equal(normalizePriority("High"), "urgent");
  assert.equal(normalizeWorkOrderStatus("waiting on sub quote"), "Waiting on Sub Quote");
  assert.equal(normalizeSource("Home Depot ticket"), "Home Depot");
  assert.equal(normalizeState("Louisiana"), "LA");
});
