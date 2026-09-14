import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyEmail,
  detectDispatchSource,
  extractInboxIdentifiers,
  projectKey,
} from "../lib/integrations/email-classify.ts";

test("files invitation to bid, quoted, and approved quote mail into the right groups", () => {
  assert.equal(
    classifyEmail({ subject: "Invitation to Bid · Store 219 bollard replacement" }),
    "invitation_to_bid"
  );
  assert.equal(classifyEmail({ subject: "RFP for dock gate", snippet: "Please bid this job" }), "invitation_to_bid");
  assert.equal(classifyEmail({ subject: "Quote submitted · WO-45821" }), "quoted");
  assert.equal(classifyEmail({ subject: "Quote approved · PO-99102", snippet: "Notice to proceed" }), "approved_quote");
  assert.equal(classifyEmail({ subject: "mHelpDesk · Work order assigned · Store 104" }), "work_order");
  assert.equal(classifyEmail({ subject: "Invoice INV-2041 remittance" }), "invoice");
});

test("detects mHelpDesk and Affiliate Connect sources from the mailbox", () => {
  assert.equal(detectDispatchSource({ from: "alerts@mhelpdesk.com", subject: "New job" }), "mhelpdesk");
  assert.equal(detectDispatchSource({ subject: "TrueSource Affiliate Connect · Ticket assigned" }), "truesource");
  assert.equal(detectDispatchSource({ from: "ap@customer.com", subject: "Quote approved" }), "gmail");
});

test("groups jobs by customer / store / location project", () => {
  assert.equal(
    projectKey({ customerName: "Bayou Retail Group", storeNumber: "104", locationName: "Canal Street Store" }),
    "Bayou Retail Group · Store 104 · Canal Street Store"
  );
});

test("extracts work order and store numbers from inbox text", () => {
  const ids = extractInboxIdentifiers("Work Order #: MHD-10418\nStore #: 104");
  assert.equal(ids.workOrderNumber, "MHD-10418");
  assert.equal(ids.storeNumber, "104");
});

test("search haystack for canal street finds that project, not the Kenner job", () => {
  const jobs = [
    {
      project: projectKey({ customerName: "Bayou Retail Group", storeNumber: "104", locationName: "Canal Street Store" }),
      wo: "MHD-10418",
    },
    {
      project: projectKey({ customerName: "Bayou Retail Group", storeNumber: "219", locationName: "Kenner Shopping Center" }),
      wo: "TS-21944",
    },
  ];
  const needle = "canal";
  const hits = jobs.filter((job) => `${job.project} ${job.wo}`.toLowerCase().includes(needle));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].wo, "MHD-10418");
});
