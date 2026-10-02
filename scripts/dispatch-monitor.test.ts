import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildBrandedWorkOrderText } from "../lib/integrations/branded-work-order.ts";
import { matchContractor, type ContractorCandidate, type DispatchRoute } from "../lib/integrations/contractor-match.ts";
import { dispatchIncomingWorkOrders } from "../lib/integrations/dispatch-monitor.ts";
import { collectFilesFromText, collectGmailFiles } from "../lib/integrations/intake-files.ts";
import { upsertJobIntakeFromSource } from "../lib/integrations/job-intake.ts";
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

test("branded work order carries Fortified identity, site, and contractor", () => {
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
        workOrderNumber: "MHD-10418",
        description: "Gate operator reverse fault",
        dneAmount: 1200,
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
    [{ name: "dock-before.jpg", source: "gmail" }]
  );
  assert.match(text, /FORTIFIED FENCE & WELD/);
  assert.match(text, /FFW-2026-0001/);
  assert.match(text, /Pelican Gate Services/);
  assert.match(text, /MHD-10418/);
  assert.match(text, /dock-before.jpg/);
  assert.match(text, /\$1,200\.00/);
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
      autoSend: true,
      sendEmail: async (input) => {
        sent.push(input.to);
        assert.match(input.subject, /FFW-/);
        assert.match(input.body, /FORTIFIED FENCE & WELD/);
        assert.ok(input.pdfPath);
        const pdf = await readFile(input.pdfPath);
        assert.ok(pdf.subarray(0, 4).toString() === "%PDF");
        return { id: "sent-1" };
      },
    });

    assert.equal(sent.length, 1);
    assert.equal(sent[0], "dispatch@pelicangate.test");
    assert.equal(result.sent, 1);
    assert.equal(result.needsContractor, 1);

    const store = JSON.parse(await readFile(path.join(dir, "job-intake.json"), "utf8")) as {
      records: Array<{ parsed: { workOrderNumber?: string }; dispatch?: { status: string; contractorName?: string; fortifiedWorkOrderNumber?: string }; files?: unknown[] }>;
    };
    const nola = store.records.find((record) => record.parsed.workOrderNumber === "MHD-10418");
    const dallas = store.records.find((record) => record.parsed.workOrderNumber === "WO-45821");
    assert.equal(nola?.dispatch?.status, "sent");
    assert.equal(nola?.dispatch?.contractorName, "Pelican Gate Services");
    assert.match(nola?.dispatch?.fortifiedWorkOrderNumber || "", /^FFW-/);
    assert.ok((nola?.files?.length ?? 0) >= 1);
    assert.equal(dallas?.dispatch?.status, "needs_contractor");

    const snapshot = JSON.parse(await readFile(path.join(dir, "local-records.json"), "utf8")) as {
      work_orders: Array<{ work_order_number: string; subcontractor_id: string; title: string }>;
      work_order_photos: Array<{ caption?: string }>;
    };
    assert.equal(snapshot.work_orders.length, 1);
    assert.equal(snapshot.work_orders[0].subcontractor_id, pelican.id);
    assert.match(snapshot.work_orders[0].work_order_number, /^FFW-/);
    assert.equal(snapshot.work_order_photos[0].caption, "dock-before.jpg");
  } finally {
    process.env.FORTIFIED_USER_DATA_DIR = previousDir;
    process.env.NEXT_PUBLIC_DEMO_MODE = previousDemo;
    await rm(dir, { recursive: true, force: true });
  }
});
