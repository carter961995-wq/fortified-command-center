import assert from "node:assert/strict";
import test from "node:test";
import {
  OPEN_INVOICE_STATUSES,
  PENDING_QUOTE_STATUSES,
  WORK_ORDER_VIEW_STATUSES,
  quoteNextAction,
  workOrderNextAction,
} from "../src/lib/operational-views.ts";

test("pending estimate queue includes site info, sub pricing, quote creation, and sent quotes", () => {
  assert.deepEqual([...WORK_ORDER_VIEW_STATUSES["pending-estimates"]], [
    "Needs Site Info",
    "Waiting on Sub Quote",
    "Quote Needed",
    "Quote Sent",
  ]);
});

test("dispatch queue only starts after approval", () => {
  assert.equal(WORK_ORDER_VIEW_STATUSES["subcontractor-dispatch"].includes("Quote Sent" as never), false);
  assert.equal(WORK_ORDER_VIEW_STATUSES["subcontractor-dispatch"].includes("Approved"), true);
});

test("invoice open statuses exclude draft, paid, and void", () => {
  assert.deepEqual([...OPEN_INVOICE_STATUSES], ["sent", "partially_paid", "overdue"]);
});

test("pending estimates are draft or sent", () => {
  assert.deepEqual([...PENDING_QUOTE_STATUSES], ["draft", "sent"]);
});

test("next action preserves approval gates", () => {
  assert.match(workOrderNextAction("Quote Sent"), /Await customer approval/i);
  assert.match(workOrderNextAction("Waiting on Sub Quote"), /before committing cost/i);
  assert.match(quoteNextAction("sent"), /do not dispatch/i);
});
