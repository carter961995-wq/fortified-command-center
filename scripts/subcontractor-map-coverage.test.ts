import assert from "node:assert/strict";
import test from "node:test";
import { coverageMatch, hasRecordedMapCoordinates, matchesTradeFilter, recordedServiceRadius } from "../lib/subcontractor-map-coverage.ts";

const job = { state: "LA", lat: 31.3, lng: -92.4, hasRecordedCoordinates: true };
const crew = { state: "LA", lat: 31.31, lng: -92.41, hasRecordedCoordinates: true, status: "active", serviceStates: [] as string[], serviceRadius: 10 };

test("listed service state does not need an invented radius or base state", () => {
  assert.equal(coverageMatch({ ...crew, state: "MS", serviceStates: [" la "], serviceRadius: null, hasRecordedCoordinates: false }, job), "listed-state");
  assert.equal(coverageMatch({ ...crew, state: "LA", serviceRadius: null }, job), null);
});

test("radius matches use recorded coordinates, same state and recorded distances", () => {
  assert.equal(coverageMatch(crew, job), "same-state-radius");
  assert.equal(coverageMatch({ ...crew, serviceRadius: 0.1 }, job), null);
  assert.equal(coverageMatch({ ...crew, state: "MS" }, job), null);
  assert.equal(coverageMatch({ ...crew, hasRecordedCoordinates: false }, job), null);
  assert.equal(coverageMatch(crew, { ...job, hasRecordedCoordinates: false }), null);
  assert.equal(coverageMatch(crew, { ...job, state: "" }), null);
});

test("blocked, inactive, probation and unknown contractors are never routing candidates", () => {
  for (const status of ["blocked", "inactive", "probation", "unknown", ""]) {
    assert.equal(coverageMatch({ ...crew, status, serviceStates: ["LA"] }, job), null);
  }
});

test("unknown trades are not inferred from a job; explicit filter matches normalized recorded trade", () => {
  assert.equal(matchesTradeFilter([], ""), true);
  assert.equal(matchesTradeFilter([], "fence"), false);
  assert.equal(matchesTradeFilter([" Fence "], "fence"), true);
  assert.equal(matchesTradeFilter(["fence"], "welding"), false);
});

test("only recorded positive radii and plausible numeric coordinate pairs are valid", () => {
  for (const x of [undefined, null, "", " ", 0, -1, Infinity, "none", false]) assert.equal(recordedServiceRadius(x), null);
  assert.equal(recordedServiceRadius("12"), 12);
  assert.equal(hasRecordedMapCoordinates("31.3", "-92.4"), true);
  assert.equal(hasRecordedMapCoordinates(null, -92.4), false);
  assert.equal(hasRecordedMapCoordinates(0, 0), false);
  assert.equal(hasRecordedMapCoordinates(129, -92.4), false);
});
