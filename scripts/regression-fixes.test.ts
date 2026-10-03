import test from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { businessToday, calendarDate, formatDate, scheduleBucket } from "../lib/business.ts";
import { invoicePdfLines, renderInvoicePdf } from "../lib/invoice-pdf.ts";
import { acceptJobIntake } from "../lib/integrations/accept-intake.ts";
import { stampLoganApproval } from "../lib/integrations/dispatch-approval.ts";
import { releaseReviewedDispatch } from "../lib/integrations/dispatch-monitor.ts";
import { parseJobAssignmentText, updateJobIntakeRecord, upsertJobIntakeFromSource } from "../lib/integrations/job-intake.ts";
import { saveLocalUpload, readLocalUpload } from "../lib/local-uploads.ts";
import { parseAdjustmentMoney, parsePositiveMoney } from "../lib/money.ts";
import { createNote, deleteNote, listNotes, updateNote } from "../lib/notepad-store.ts";
import { recordPayment } from "../lib/payments.ts";
import { createLocalDataClient, resetLocalDataStoreForTests } from "../src/lib/demo-client.ts";

async function withDataDir<T>(fn: (dir: string) => Promise<T>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fortified-regression-"));
  const previousDir = process.env.FORTIFIED_USER_DATA_DIR;
  const previousDemo = process.env.NEXT_PUBLIC_DEMO_MODE;
  const previousGemini = process.env.GEMINI_API_KEY;
  process.env.FORTIFIED_USER_DATA_DIR = dir;
  process.env.NEXT_PUBLIC_DEMO_MODE = "false";
  delete process.env.GEMINI_API_KEY;
  resetLocalDataStoreForTests({ seed: false });
  try {
    return await fn(dir);
  } finally {
    process.env.FORTIFIED_USER_DATA_DIR = previousDir;
    process.env.NEXT_PUBLIC_DEMO_MODE = previousDemo;
    if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGemini;
    await rm(dir, { recursive: true, force: true });
  }
}

function pdfPlainText(bytes: Buffer) {
  const marker = Buffer.from("stream\n");
  const end = Buffer.from("\nendstream");
  const chunks: string[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const start = bytes.indexOf(marker, offset);
    if (start < 0) break;
    const dataStart = start + marker.length;
    const stop = bytes.indexOf(end, dataStart);
    if (stop < 0) break;
    const slice = bytes.subarray(dataStart, stop);
    try {
      chunks.push(inflateSync(slice).toString("latin1"));
    } catch {
      chunks.push(slice.toString("latin1"));
    }
    offset = stop + end.length;
  }
  const raw = chunks.join("\n");
  return raw.replace(/<([0-9A-Fa-f]+)>/g, (_match, hex: string) => Buffer.from(hex, "hex").toString("latin1"));
}

test("calendar dates stay on their stored day in Central time", () => {
  assert.equal(calendarDate("2026-10-20"), "2026-10-20");
  assert.match(formatDate("2026-10-20"), /Oct 20, 2026/);
  assert.equal(scheduleBucket("2026-10-20", "2026-10-03"), "upcoming");
  assert.notEqual(scheduleBucket("2026-10-20", "2026-10-03"), "today");
  assert.equal(calendarDate("2026-10-03T05:00:00.000Z"), "2026-10-03");
  assert.equal(calendarDate("2026-10-03T04:59:00.000Z"), "2026-10-02");
  assert.equal(calendarDate("2026-03-08T06:00:00.000Z"), "2026-03-08");
  assert.equal(calendarDate("2026-03-08T05:59:00.000Z"), "2026-03-07");
  assert.equal(calendarDate("2026-11-01T06:00:00.000Z"), "2026-11-01");
  assert.equal(calendarDate("2026-11-01T04:59:00.000Z"), "2026-10-31");
  assert.equal(scheduleBucket("2026-10-03", "2026-10-03"), "today");
  assert.equal(scheduleBucket(null, "2026-10-03"), "unscheduled");
  assert.equal(businessToday(new Date("2026-10-03T05:00:00.000Z")), "2026-10-03");
});

test("payment amounts reject zero, negative, and non-finite values", async () => {
  await withDataDir(async () => {
    const client = createLocalDataClient({ seed: false });
    const invoice = await client.from("invoices").insert({
      customer_id: "11111111-1111-4111-8111-111111111111",
      invoice_number: "INV-REG-1",
      total_amount: 2000,
      amount_paid: 0,
      balance_due: 2000,
      status: "sent",
      due_date: "2026-11-01",
    }).select("id").maybeSingle();
    const invoiceId = String(invoice.data.id);
    for (const amount of ["-100", "0", "0.000", "NaN", "Infinity", "-Infinity", "1e2", "10.999", "abc"]) {
      const form = new FormData();
      form.set("amount", amount);
      const result = await recordPayment(client, invoiceId, "11111111-1111-4111-8111-111111111111", form);
      assert.equal(result.ok, false, amount);
    }
    const partial = new FormData();
    partial.set("amount", "500.5");
    assert.equal((await recordPayment(client, invoiceId, "11111111-1111-4111-8111-111111111111", partial)).ok, true);
    const afterPartial = await client.from("invoices").select("amount_paid, balance_due, status").eq("id", invoiceId).maybeSingle();
    assert.equal(afterPartial.data.amount_paid, 500.5);
    assert.equal(afterPartial.data.balance_due, 1499.5);
    const finalPayment = new FormData();
    finalPayment.set("amount", "1499.50");
    assert.equal((await recordPayment(client, invoiceId, "11111111-1111-4111-8111-111111111111", finalPayment)).ok, true);
    const paid = await client.from("invoices").select("status, balance_due").eq("id", invoiceId).maybeSingle();
    assert.equal(paid.data.balance_due, 0);
    assert.equal(paid.data.status, "paid");
    const payments = await client.from("payments").select("id").eq("invoice_id", invoiceId);
    assert.equal(payments.data.length, 2);
    assert.equal(parsePositiveMoney("-100").ok, false);
    assert.equal(parseAdjustmentMoney("-25.00").ok, true);
  });
});

test("lists page across the full job set and counts stay exact", async () => {
  await withDataDir(async () => {
    const client = createLocalDataClient({ seed: false });
    for (let index = 0; index < 1000; index += 1) {
      await client.from("work_orders").insert({
        title: `JOBTOKEN-${String(index).padStart(4, "0")}`,
        status: "New",
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
      });
    }
    const counted = await client.from("work_orders").select("id", { count: "exact", head: true }).not("status", "in", "(Closed,Cancelled)");
    assert.equal(counted.count, 1000);
    const page = await client.from("work_orders").select("title", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false }).range(50, 99);
    assert.equal(page.data.length, 50);
    assert.equal(page.count, 1000);
    const found = await client.from("work_orders").select("title", { count: "exact" }).or("title.ilike.%JOBTOKEN-0900%");
    assert.equal(found.count, 1);
    assert.equal(found.data[0].title, "JOBTOKEN-0900");
    const invoices = [];
    for (let index = 0; index < 12; index += 1) {
      invoices.push(client.from("invoices").insert({ invoice_number: `INV-${index}`, total_amount: 100, balance_due: 25, invoice_date: "2026-10-02" }));
    }
    await Promise.all(invoices);
    let total = 0;
    let from = 0;
    for (;;) {
      const batch = await client.from("invoices").select("total_amount").order("id", { ascending: true }).range(from, from + 4);
      for (const row of batch.data) total += Number(row.total_amount);
      if (batch.data.length < 5) break;
      from += 5;
    }
    assert.equal(total, 1200);
  });
});

test("accepting one intake twice creates one work order", async () => {
  await withDataDir(async () => {
    const store = await upsertJobIntakeFromSource({
      source: "manual",
      sourceRef: "po-scope-1",
      subject: "Assignment",
      rawText: `Work Order #: WO-45821
PO #: PO-99102
Scope:
Replace the south gate panel
and reset the operator.
NTE: $2,000.00`,
    });
    const record = store.record;
    assert.ok(record);
    assert.equal(record?.parsed.purchaseOrderNumber, "PO-99102");
    assert.equal(record?.parsed.workOrderNumber, "WO-45821");
    assert.match(record?.parsed.jobDetails || "", /south gate panel/);
    assert.match(record?.parsed.jobDetails || "", /reset the operator/);
    assert.equal(record?.parsed.dneAmount, 2000);
    const [first, second] = await Promise.all([
      acceptJobIntake(record!.id),
      acceptJobIntake(record!.id),
    ]);
    assert.equal(first.workOrderId, second.workOrderId);
    assert.equal(first.workOrderId.startsWith("local-"), false);
    const again = await acceptJobIntake(record!.id);
    assert.equal(again.created, false);
    const client = createLocalDataClient({ seed: false });
    const jobs = await client.from("work_orders").select("id, purchase_order_number, scope_summary, not_to_exceed_amount, customer_work_order_number").eq("purchase_order_number", "PO-99102");
    assert.equal(jobs.data.length, 1);
    assert.equal(jobs.data[0].customer_work_order_number, "WO-45821");
    assert.equal(jobs.data[0].not_to_exceed_amount, 2000);
    assert.match(jobs.data[0].scope_summary, /south gate panel/);
  });
});

test("an edited dispatch draft needs Logan's approval again and sends once", async () => {
  await withDataDir(async () => {
    const store = await upsertJobIntakeFromSource({
      source: "manual",
      sourceRef: "approve-once",
      subject: "Dispatch me",
      rawText: "Work Order #: WO-1\nDescription: Gate repair\nDNE: $2000",
    });
    const record = store.record;
    const sent: string[] = [];
    const sendEmail = async (input: { to: string }) => {
      sent.push(input.to);
      return { id: "mock-message" };
    };
    await assert.rejects(
      () => releaseReviewedDispatch(record.id, { sendEmail }),
      /not ready|Logan must approve/
    );
    const draft = {
      to: "crew@pelicangate.test",
      subject: "Work order",
      body: "Scope: replace the latch. Not to exceed: $1,000.00",
      status: "draft" as const,
      updatedAt: new Date().toISOString(),
    };
    const approved = stampLoganApproval({ ...record, emailDraft: draft }, draft);
    await updateJobIntakeRecord(record.id, {
      dispatch: {
        status: "pending_review",
        contractorEmail: "crew@pelicangate.test",
        contractorName: "Crew",
        updatedAt: new Date().toISOString(),
      },
      emailDraft: approved,
    });
    await releaseReviewedDispatch(record.id, { sendEmail });
    await releaseReviewedDispatch(record.id, { sendEmail });
    assert.deepEqual(sent, ["crew@pelicangate.test"]);
    const edited = { ...approved, body: "Scope: replace the whole gate.", status: "approved" as const };
    await updateJobIntakeRecord(record.id, {
      dispatch: {
        status: "pending_review",
        contractorEmail: "crew@pelicangate.test",
        updatedAt: new Date().toISOString(),
      },
      emailDraft: edited,
    });
    await assert.rejects(() => releaseReviewedDispatch(record.id, { sendEmail }), /approve it again|Logan must approve/);
    assert.equal(sent.length, 1);
  });
});

test("invoice pdf keeps every line item, scope line, and note", async () => {
  const items = Array.from({ length: 12 }, (_, index) => ({
    description: `Line item ${index + 1} with a long description that should wrap instead of being cut off at eighty characters for review`,
    total: 10 + index,
  }));
  const input = {
    invoiceNumber: "INV-LONG-1",
    invoiceDate: "2026-10-20",
    dueDate: "2026-11-03",
    terms: "Net 14",
    customerName: "Bayou Retail Group",
    contactName: "Nora Laurent",
    billingAddress: "410 Canal St\nSuite 900\nNew Orleans, LA 70130\nAccounts floor",
    billingEmail: "ap@bayou-retail.example",
    customerWorkOrder: "WO-45821",
    purchaseOrder: "PO-99102",
    locationLine: "Canal Street Store, 410 Canal St, New Orleans, LA 70130",
    title: "South gate repair",
    scope: "Replace the south gate panel\nand reset the operator\nthen photograph the finished latch\nand confirm the exit loop\nand leave the site secure",
    notes: "Call the store manager before arrival. Leave the completion form with the night lead.",
    subtotal: 200,
    tax: 0,
    totalDue: 200,
    items,
  };
  const lines = invoicePdfLines(input);
  assert.ok(lines.includes("PO-99102"));
  assert.ok(lines.includes("WO-45821"));
  assert.ok(lines.some((line) => line.includes("reset the operator")));
  assert.ok(lines.some((line) => line.includes("Line item 12")));
  assert.ok(lines.some((line) => line.includes("night lead")));
  const bytes = Buffer.from(await renderInvoicePdf(input));
  const text = pdfPlainText(bytes);
  assert.match(text, /INV-LONG-1/);
  assert.match(text, /PO-99102/);
  assert.match(text, /Line item 12/);
  assert.match(text, /night lead/);
  assert.match(text, /Page 1 of /);
});

test("local uploads and notes survive a fresh read", async () => {
  await withDataDir(async () => {
    const bytes = Uint8Array.from([1, 2, 3, 4, 255, 10]);
    const saved = await saveLocalUpload({
      workOrderId: "55555555-5555-4555-8555-555555555551",
      filename: "dock photo.png",
      mimeType: "image/png",
      bytes,
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    const loaded = await readLocalUpload(saved.file.id);
    assert.ok(loaded);
    assert.deepEqual(Array.from(loaded!.bytes), Array.from(bytes));
    const rejected = await saveLocalUpload({
      workOrderId: "55555555-5555-4555-8555-555555555551",
      filename: "../secret.txt",
      mimeType: "text/plain",
      bytes,
    });
    assert.equal(rejected.ok, false);
    const note = await createNote({ title: "Call Dana", body: "Confirm the dock gate." });
    const updated = await updateNote(note.id, { body: "Confirm the dock gate and PO-99102." });
    assert.match(updated?.body || "", /PO-99102/);
    const found = await listNotes("dana");
    assert.equal(found.length, 1);
    assert.equal(await deleteNote(note.id), true);
    assert.equal((await listNotes()).length, 0);
  });
});

test("parser keeps PO and multiline scope without inventing a description", async () => {
  delete process.env.GEMINI_API_KEY;
  const parsed = await parseJobAssignmentText({
    subject: "Assignment notice",
    body: "PO Number: PO-99102\nWork Order Number: WO-45821\nScope of work:\nPull the bent rail\nInstall a new bottom rail\nNTE: $850",
  });
  assert.equal(parsed.purchaseOrderNumber, "PO-99102");
  assert.equal(parsed.workOrderNumber, "WO-45821");
  assert.match(parsed.jobDetails || "", /Pull the bent rail/);
  assert.match(parsed.jobDetails || "", /bottom rail/);
  assert.equal(parsed.description, undefined);
  assert.equal(parsed.dneAmount, 850);
});
