import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildBrandedWorkOrderText } from "../lib/integrations/branded-work-order.ts";
import { matchContractor, type ContractorCandidate, type DispatchRoute } from "../lib/integrations/contractor-match.ts";
import { approveContractorDispatch, dispatchIncomingWorkOrders, releaseReviewedDispatch, saveContractorDispatchDraft } from "../lib/integrations/dispatch-monitor.ts";
import { upsertJobIntakeFromSource } from "../lib/integrations/job-intake.ts";
import { subcontractorDneAmount } from "../lib/integrations/subcontractor-dne.ts";
import { collectFilesFromText, collectGmailFiles } from "../lib/integrations/intake-files.ts";
import { resetLocalDataStoreForTests } from "../src/lib/demo-client.ts";

const pelican: ContractorCandidate = {
  id: "sub-pelican",
  companyName: "Pelican Gate Services",
  email: "dispatch@pelicangate.test",
  phone: "504-555-0201",
  city: "Metairie",
  state: "LA",
  serviceStates: ["LA", "MS"],
  trades: ["gate", "fence"],
  preferred: true,
  status: "active",
};

const iron: ContractorCandidate = {
  id: "sub-iron",
  companyName: "Iron Parish Welding",
  email: "luis@ironparish.test",
  city: "Baton Rouge",
  state: "LA",
  serviceStates: ["LA"],
  trades: ["welding", "bollards"],
  preferred: true,
  status: "active",
};

const probation: ContractorCandidate = {
  id: "sub-probation",
  companyName: "Acadiana Fence Crew",
  email: "maya@acadianafence.test",
  city: "Lafayette",
  state: "LA",
  serviceStates: ["LA", "TX"],
  trades: ["fence"],
  preferred: false,
  status: "probation",
};

test("a location route overrides the general state crew", () => {
  const routes: DispatchRoute[] = [
    {
      id: "route-nola",
      label: "New Orleans gates",
      states: ["LA"],
      cities: ["New Orleans"],
      zipPrefixes: [],
      trades: ["gate"],
      subcontractorId: pelican.id,
      active: true,
    },
  ];
  const match = matchContractor(
    { city: "New Orleans", state: "Louisiana", zip: "70130", tradeType: "Gate" },
    routes,
    [pelican, iron, probation]
  );
  assert.equal(match?.contractor.id, pelican.id);
  assert.match(match?.reason || "", /New Orleans gates/);
});

test("preferred service-state coverage is used when no route matches", () => {
  const match = matchContractor(
    { city: "Jackson", state: "MS", tradeType: "gate" },
    [],
    [pelican, iron, probation]
  );
  assert.equal(match?.contractor.id, pelican.id);
});

test("a job outside every crew's states is left unassigned", () => {
  const match = matchContractor({ city: "Dallas", state: "TX", tradeType: "fence" }, [], [pelican, iron, probation]);
  assert.equal(match, null);
});

test("gmail attachments and picture links are collected with the job", () => {
  const files = collectGmailFiles(
    {
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "text/plain", body: { data: "aGVsbG8" } },
        { mimeType: "image/jpeg", filename: "dock-before.jpg", body: { attachmentId: "att-1", size: 1200 } },
      ],
    },
    "msg-1"
  );
  assert.equal(files.length, 1);
  assert.equal(files[0].name, "dock-before.jpg");
  assert.equal(files[0].attachmentId, "att-1");
  const links = collectFilesFromText("Photo https://files.example.com/site/after.png and scope.pdf.txt no");
  assert.equal(links[0].name, "after.png");
});

test("branded work order uses only explicitly selected details and the separate crew cap", () => {
  const text = buildBrandedWorkOrderText(
    {
      id: "job-1",
      status: "new",
      source: "mhelpdesk",
      sourceRef: "mhd-1",
      receivedAt: "2026-10-01T00:00:00.000Z",
      rawText: "raw",
      parsed: {
        customerName: "Bayou Retail Group",
        city: "New Orleans",
        state: "LA",
        tradeType: "Gate",
        workOrderNumber: "MHD-10418",
        purchaseOrderNumber: "PRIVATE-PO",
        description: "Gate operator reverse fault",
        dneAmount: 1200,
        jobDetails: "Operator reverses mid-cycle. DNE: $1,200.00. Photo attached.",
      },
      category: "work_order",
      notes: "",
      photoUrls: [],
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    {
      fortifiedWorkOrderNumber: "FFW-2026-0001",
      contractorName: "Pelican Gate Services",
      contractorEmail: "dispatch@pelicangate.test",
      reason: "Predetermined route covers New Orleans, LA.",
    },
    { subcontractorDne: 720, scope: "Adjust operator", site: "Approved jobsite", customerCleared: true }
  );
  assert.match(text, /FORTIFIED FENCE & WELD/);
  assert.match(text, /FFW-2026-0001/);
  assert.match(text, /Adjust operator|Approved jobsite/);
  assert.match(text, /Not to exceed: \$720\.00/);
  assert.doesNotMatch(text, /1,200|\$1200|operator reverse fault|PRIVATE-PO|MHD-10418|Predetermined route/);
});

test("subcontractor cap is explicit, positive, precise and strictly lower", () => {
  assert.equal(subcontractorDneAmount(2000), null);
  assert.equal(subcontractorDneAmount(850, 425), 425);
  assert.equal(subcontractorDneAmount(850, 850), null);
  assert.equal(subcontractorDneAmount(850, 851), null);
  assert.equal(subcontractorDneAmount(undefined, 400), null);
  assert.equal(subcontractorDneAmount(850, 0), null);
  assert.equal(subcontractorDneAmount(850, 100.001), null);
});


test("a new mHelpDesk assignment becomes a branded work order for the location contractor", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fortified-dispatch-"));
  const previousDir = process.env.FORTIFIED_USER_DATA_DIR;
  const previousDemo = process.env.NEXT_PUBLIC_DEMO_MODE;
  process.env.FORTIFIED_USER_DATA_DIR = dir;
  process.env.NEXT_PUBLIC_DEMO_MODE = "false";
  resetLocalDataStoreForTests({ seed: false });
  const sent: string[] = [];
  try {
    await upsertJobIntakeFromSource({
      source: "mhelpdesk",
      sourceRef: "mhelpdesk-live-MHD-10418",
      subject: "mHelpDesk · Work order assigned · Store 104",
      from: "alerts@mhelpdesk.com",
      rawText: `Customer: Bayou Retail Group
Store #: 104
Location: Canal Street Store
Address: 410 Canal St
City: New Orleans
State: LA
Zip: 70130
Work Order #: MHD-10418
Description: Gate operator reverse fault
Details: Operator reverses mid-cycle. Photo https://cdn.mhelpdesk.com/jobs/dock-before.jpg
DNE: $1200.00
Trade: Gate
Priority: Urgent`,
      files: [{ name: "dock-before.jpg", mimeType: "image/jpeg", source: "portal", sourceUrl: "https://cdn.mhelpdesk.com/jobs/dock-before.jpg" }],
    });
    await upsertJobIntakeFromSource({
      source: "gmail",
      sourceRef: "gmail-dallas",
      subject: "Work order assigned",
      from: "jobs@fortified.local",
      rawText: `Customer: Retail Facilities Group
City: Dallas
State: TX
Work Order #: WO-45821
Description: Repair damaged chain link
Trade: Fence`,
    });

    const result = await dispatchIncomingWorkOrders({
      contractors: [pelican, iron, probation],
      routes: [
        {
          id: "route-nola",
          label: "New Orleans gates",
          states: ["LA"],
          cities: ["New Orleans"],
          zipPrefixes: [],
          trades: ["gate"],
          subcontractorId: pelican.id,
          active: true,
        },
      ],
    });

    assert.equal(sent.length, 0);
    assert.equal(result.sent, 0);
    assert.equal(result.pendingReview, 1);
    assert.equal(result.needsContractor, 1);

    const store = JSON.parse(await readFile(path.join(dir, "job-intake.json"), "utf8")) as {
      records: Array<{
        id: string;
        parsed: { workOrderNumber?: string; dneAmount?: number | null };
        dispatch?: { status: string; contractorName?: string; fortifiedWorkOrderNumber?: string; documentPath?: string };
        emailDraft?: { to: string; subject: string; body: string; status: string; reviewedAt?: string; updatedAt: string };
        files?: unknown[];
      }>;
    };
    const nola = store.records.find((record) => record.parsed.workOrderNumber === "MHD-10418");
    const dallas = store.records.find((record) => record.parsed.workOrderNumber === "WO-45821");
    assert.equal(nola?.dispatch?.status, "pending_review");
    assert.equal(nola?.emailDraft?.status, "draft");
    assert.equal(nola?.parsed.dneAmount, 1200);
    assert.equal(nola?.emailDraft?.body, "");
    assert.equal(nola?.dispatch?.documentPath, undefined);
    assert.equal(nola?.dispatch?.contractorName, "Pelican Gate Services");
    assert.match(nola?.dispatch?.fortifiedWorkOrderNumber || "", /^FFW-/);
    assert.ok((nola?.files?.length ?? 0) >= 1);
    assert.equal(dallas?.dispatch?.status, "needs_contractor");

    const id = nola!.id;
    const safeCopy = { subcontractorDne: 720, scope: "Diagnose the operator and test the gate.", site: "Approved site", customerCleared: false };
    await assert.rejects(() => saveContractorDispatchDraft(id, { ...safeCopy, scope: "Customer NTE $1,200" }), /Remove pricing/);
    const drafted = await saveContractorDispatchDraft(id, safeCopy);
    await assert.rejects(() => approveContractorDispatch(id, drafted.emailDraft?.updatedAt), /customer permits/);
    const confirmed = await saveContractorDispatchDraft(id, { ...safeCopy, customerCleared: true });
    await assert.rejects(() => releaseReviewedDispatch(id, { sendEmail: async () => ({ id: "should-not-send" }) }), /Logan must approve/);
    await assert.rejects(() => approveContractorDispatch(id, "stale"), /draft changed/);
    await approveContractorDispatch(id, confirmed.emailDraft?.updatedAt);

    const released = await releaseReviewedDispatch(nola?.id || "", {
      sendEmail: async (input) => {
        sent.push(input.to);
        assert.match(input.subject, /FFW-/);
        assert.match(input.body, /FORTIFIED FENCE & WELD/);
        assert.match(input.body, /\$720\.00/);
        assert.doesNotMatch(input.body, /1,200|\$1200|dock-before|cdn\.|Operator reverses/);
        assert.ok(input.pdfPath);
        const pdf = await readFile(input.pdfPath);
        assert.ok(pdf.subarray(0, 4).toString() === "%PDF");
        assert.deepEqual(input.files, []);
        const writtenText = await readFile(input.pdfPath.replace(/\.pdf$/, ".txt"), "utf8");
        assert.equal(writtenText, input.body);
        return { id: "sent-1" };
      },
    });

    assert.equal(sent.length, 1);
    assert.equal(sent[0], "dispatch@pelicangate.test");
    assert.equal(released.record.dispatch?.status, "sent");

    const snapshot = JSON.parse(await readFile(path.join(dir, "local-records.json"), "utf8")) as {
      work_orders: Array<{ work_order_number: string; subcontractor_id: string; title: string; not_to_exceed_amount?: number; internal_notes?: string }>;
      work_order_photos: Array<{ caption?: string }>;
    };
    assert.equal(snapshot.work_orders.length, 1);
    assert.equal(snapshot.work_orders[0].subcontractor_id, null);
    assert.equal(snapshot.work_orders[0].not_to_exceed_amount, 1200);
    assert.match(snapshot.work_orders[0].internal_notes || "", /Subcontractor NTE \$720\.00/);
    assert.match(snapshot.work_orders[0].work_order_number, /^FFW-/);
    assert.equal(snapshot.work_order_photos[0].caption, "dock-before.jpg");
  } finally {
    process.env.FORTIFIED_USER_DATA_DIR = previousDir;
    process.env.NEXT_PUBLIC_DEMO_MODE = previousDemo;
    await rm(dir, { recursive: true, force: true });
  }
});

test("HTML intake dedupes same sender/customer/order and holds an unmapped portal alias or withdrawal", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fortified-intake-fixtures-"));
  const previousDir = process.env.FORTIFIED_USER_DATA_DIR;
  process.env.FORTIFIED_USER_DATA_DIR = dir;
  try {
    const fixture = (ref: string, label = "Example Retail", order = "WO-501", from = "tenant-a@mhelp.co") => ({
      source: "gmail" as const, sourceRef: ref, from,
      subject: `New assignment | WO # ${order}`,
      rawText: `<table><tr><td>Job ID #:</td><td>1501</td></tr><tr><td>Customer:</td><td>${label}</td></tr><tr><td>Work Order #:</td><td>${order}</td></tr><tr><td>State:</td><td>LA</td></tr><tr><td>Trade:</td><td>Gate</td></tr><tr><td>Issue:</td><td>Adjust gate.</td></tr></table>`,
    });
    const first = await upsertJobIntakeFromSource(fixture("synthetic-1"));
    assert.equal(first.record.parsed.portalJobId, "1501");
    assert.equal(first.record.parsed.customerName, "Example Retail");
    assert.equal(first.record.parsed.workOrderNumber, "WO-501");
    assert.equal(first.record.parsed.dneAmount, null);
    assert.equal(first.record.emailDraft?.body, "");
    const replay = await upsertJobIntakeFromSource(fixture("synthetic-2"));
    assert.equal(replay.created, false);
    assert.equal(replay.record.id, first.record.id);
    assert.notEqual((await upsertJobIntakeFromSource(fixture("synthetic-3", "Example Retail", "WO-502"))).record.id, first.record.id);
    assert.notEqual((await upsertJobIntakeFromSource(fixture("synthetic-4", "Other Example"))).record.id, first.record.id);
    assert.notEqual((await upsertJobIntakeFromSource(fixture("synthetic-5", "Example Retail", "WO-501", "tenant-b@mhelp.co"))).record.id, first.record.id);
    const correction = await upsertJobIntakeFromSource({ ...fixture("synthetic-6"), subject: "CORRECTION - Disregard Work Order WO-501" });
    assert.match(correction.record.dispatchHold ?? "", /withdrawn/);
    const after = await upsertJobIntakeFromSource(fixture("synthetic-7"));
    assert.equal(after.record.id, first.record.id);
    assert.match(after.record.dispatchHold ?? "", /withdrawn/);
    const portal = await upsertJobIntakeFromSource({
      ...fixture("portal-1501"), source: "mhelpdesk", from: "login@example.test",
    });
    assert.notEqual(portal.record.id, first.record.id);
    assert.match(portal.record.dispatchHold ?? "", /account mapping/);
  } finally {
    if (previousDir === undefined) delete process.env.FORTIFIED_USER_DATA_DIR;
    else process.env.FORTIFIED_USER_DATA_DIR = previousDir;
    await rm(dir, { recursive: true, force: true });
  }
});

test("trusted Sent-folder corrections hold a crew dispatch without changing the job status", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fortified-withdrawal-"));
  const previousDir = process.env.FORTIFIED_USER_DATA_DIR;
  process.env.FORTIFIED_USER_DATA_DIR = dir;
  try {
    const existing = await upsertJobIntakeFromSource({
      source: "mhelpdesk", sourceRef: "portal-701", from: "tenant@example.test",
      subject: "Work order assigned", rawText: "Customer: Example Retail\nWork Order #: WO-701",
    });
    const correction = await upsertJobIntakeFromSource({
      source: "gmail", sourceRef: "synthetic-disregard", from: "owner@example.test",
      subject: "CORRECTION - Disregard Work Order WO-701", rawText: "Do not schedule this crew.",
      trustedDispatchCorrection: true,
    });
    assert.equal(correction.record.id, existing.record.id);
    assert.equal(correction.record.status, existing.record.status);
    assert.match(correction.record.dispatchHold ?? "", /crew dispatch was withdrawn/);
  } finally {
    if (previousDir === undefined) delete process.env.FORTIFIED_USER_DATA_DIR;
    else process.env.FORTIFIED_USER_DATA_DIR = previousDir;
    await rm(dir, { recursive: true, force: true });
  }
});
