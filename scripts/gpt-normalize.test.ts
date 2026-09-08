import test from "node:test";
import assert from "node:assert/strict";
import { geodesicFeet, geodesicMeters } from "../lib/geo/geodesic.ts";
import {
  namesMatch,
  normalizeKnowledgeCategory,
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

test("maps SOP, guideline, and pricing language to Fence Bible categories", () => {
  assert.equal(normalizeKnowledgeCategory("Standard operating procedure"), "sop");
  assert.equal(normalizeKnowledgeCategory("dispatch playbook"), "sop");
  assert.equal(normalizeKnowledgeCategory("company guidelines"), "guideline");
  assert.equal(normalizeKnowledgeCategory("labor rates / NTE"), "pricing");
  assert.equal(normalizeKnowledgeCategory("phone script"), "script");
});

test("Vincenty distance is about 90 feet for a 90-foot east-west run in Baton Rouge", () => {
  const start = { lat: 30.4515, lng: -91.1871 };
  const metersNeeded = 90 / 3.280839895;
  const lngPerMeter = 1 / (111_320 * Math.cos((30.4515 * Math.PI) / 180));
  const end = { lat: 30.4515, lng: -91.1871 + metersNeeded * lngPerMeter };
  const feet = geodesicFeet(start, end);
  assert.ok(feet > 88 && feet < 92, `expected ~90ft, got ${feet}`);
});

test("Vincenty known Flannan-Isles check stays in kilometer range", () => {
  const meters = geodesicMeters({ lat: 50.0663, lng: -5.7147 }, { lat: 58.644, lng: -3.07 });
  assert.ok(meters > 960_000 && meters < 980_000, `got ${meters}`);
});
