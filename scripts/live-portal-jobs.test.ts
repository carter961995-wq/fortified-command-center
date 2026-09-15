import test from "node:test";
import assert from "node:assert/strict";
import { classifyEmail, looksLikeOperationalEmail } from "../lib/integrations/email-classify.ts";
import { isPlaceholderInboxMessage, isPlaceholderIntakeRecord } from "../lib/integrations/placeholder-data.ts";
import {
  mapPortalJsonToJobs,
  normalizeMhelpdeskBaseUrl,
  normalizeTruesourceBaseUrl,
  portalRowToJob,
} from "../lib/integrations/portal-jobs.ts";

test("maps a live Affiliate Connect work order instead of sample store names", () => {
  const mapped = portalRowToJob(
    {
      workOrderNumber: "AC-88321",
      accountName: "Home Depot",
      storeNumber: "1844",
      location: {
        street: "2200 S Cooper St",
        city: "Arlington",
        state: "TX",
        postalCode: "76013",
      },
      description: "Dock gate will not close",
      nTE: 1500,
      siteContactName: "Night Manager",
      status: "Pending Acceptance",
    },
    { source: "truesource", email: "shop@fortifiedfence.com", index: 0 }
  );
  assert.ok(mapped);
  assert.equal(mapped.parsed.workOrderNumber, "AC-88321");
  assert.equal(mapped.parsed.customerName, "Home Depot");
  assert.equal(mapped.parsed.city, "Arlington");
  assert.equal(mapped.parsed.dneAmount, 1500);
  assert.match(mapped.sourceRef, /truesource-live-AC-88321/);
  assert.doesNotMatch(mapped.parsed.customerName ?? "", /Bayou Retail/);
});

test("walks Affiliate Connect list payloads into job drafts", () => {
  const jobs = mapPortalJsonToJobs(
    {
      data: [
        { workOrderNumber: "TS-9001", accountName: "Lowe's", description: "Fence panel down" },
        { workOrderNumber: "TS-9002", accountName: "Walmart", description: "Quote requested for bollards" },
      ],
      pagination: { totalCount: 2 },
    },
    { source: "truesource", email: "shop@fortifiedfence.com" }
  );
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].parsed.workOrderNumber, "TS-9001");
  assert.equal(jobs[1].parsed.description, "Quote requested for bollards");
});

test("treats canned demo work orders as placeholders", () => {
  assert.equal(
    isPlaceholderIntakeRecord({
      id: "abc",
      sourceRef: "mhelpdesk-wo-MHD-10418",
      from: "alerts@mhelpdesk.com",
      parsed: { workOrderNumber: "MHD-10418", customerName: "Bayou Retail Group" },
    }),
    true
  );
  assert.equal(
    isPlaceholderIntakeRecord({
      id: "real",
      sourceRef: "gmail-18c22",
      from: "dispatch@mhelpdesk.com",
      parsed: { workOrderNumber: "WO-77219", customerName: "Home Depot" },
    }),
    false
  );
  assert.equal(
    isPlaceholderInboxMessage({
      id: "demo-gmail-mhelpdesk",
      from: "alerts@mhelpdesk.com",
      workOrderNumber: "MHD-10418",
    }),
    true
  );
});

test("files RFQ mail as invitation to bid and as a job assignment", () => {
  assert.equal(classifyEmail({ subject: "RFQ · Store 310 dock gate" }), "invitation_to_bid");
  assert.equal(classifyEmail({ subject: "Request for quote", snippet: "Please price the bollard sleeves" }), "invitation_to_bid");
  assert.equal(
    looksLikeOperationalEmail({
      subject: "Request for quote · Store 219",
      from: "procurement@customer.com",
      snippet: "Please bid this job",
    }),
    true
  );
});

test("points logins at the real mHelpDesk and Affiliate Connect dashboards", () => {
  assert.equal(normalizeMhelpdeskBaseUrl("https://app.mhelpdesk.com"), "https://secure1.mhelpdesk.com");
  assert.equal(normalizeTruesourceBaseUrl("https://truesource.com"), "https://affiliateconnect.truesource.com");
  assert.equal(normalizeTruesourceBaseUrl("https://affiliateconnect.truesource.com"), "https://affiliateconnect.truesource.com");
});
