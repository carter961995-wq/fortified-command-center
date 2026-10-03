import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { userDataDir, withFileLock } from "../file-lock.ts";
import type { IntakeFile } from "./intake-files.ts";
import type { JobEmailDraft, JobIntakeRecord } from "./job-intake.ts";

export const DISPATCH_APPROVER = "Logan";

export type WorkOrderApproval = {
  id: string;
  workOrderId: string;
  subcontractorId: string;
  fingerprint: string;
  approvedBy: typeof DISPATCH_APPROVER;
  approvedAt: string;
  consumedAt?: string;
};

type ApprovalStore = { approvals: WorkOrderApproval[] };

function approvalPath() {
  return path.join(userDataDir(), "dispatch-approvals.json");
}

async function readStore(): Promise<ApprovalStore> {
  try {
    const parsed = JSON.parse(await readFile(approvalPath(), "utf8")) as ApprovalStore;
    return { approvals: Array.isArray(parsed.approvals) ? parsed.approvals : [] };
  } catch {
    return { approvals: [] };
  }
}

async function writeStore(store: ApprovalStore) {
  await mkdir(userDataDir(), { recursive: true });
  await writeFile(approvalPath(), JSON.stringify(store, null, 2));
}

export function emailDispatchFingerprint(record: JobIntakeRecord, draft: Pick<JobEmailDraft, "to" | "cc" | "subject" | "body">) {
  const files = [...(record.files ?? [])]
    .map((file: IntakeFile) => `${file.name}|${file.localPath ?? ""}|${file.sourceUrl ?? ""}`)
    .sort();
  return createHash("sha256")
    .update(
      JSON.stringify({
        jobId: record.id,
        to: draft.to.trim().toLowerCase(),
        cc: (draft.cc ?? "").trim().toLowerCase(),
        subject: draft.subject.trim(),
        body: draft.body.trim(),
        scope: [record.parsed.description, record.parsed.jobDetails, record.parsed.workOrderNumber, record.parsed.purchaseOrderNumber]
          .filter(Boolean)
          .join("\n"),
        files,
      })
    )
    .digest("hex");
}

export function stampLoganApproval(record: JobIntakeRecord, draft: JobEmailDraft): JobEmailDraft {
  const reviewedAt = new Date().toISOString();
  const next: JobEmailDraft = {
    ...draft,
    status: "approved",
    reviewedAt,
    approvedBy: DISPATCH_APPROVER,
    updatedAt: reviewedAt,
  };
  next.approvalFingerprint = emailDispatchFingerprint(record, next);
  return next;
}

export function approvalStillMatches(record: JobIntakeRecord, draft: JobEmailDraft) {
  if (draft.status !== "approved" || !draft.reviewedAt || draft.approvedBy !== DISPATCH_APPROVER || !draft.approvalFingerprint) {
    return false;
  }
  return draft.approvalFingerprint === emailDispatchFingerprint(record, draft);
}

export function workOrderDispatchFingerprint(input: {
  workOrderId: string;
  title: string;
  scope: string;
  subcontractorId: string;
  scheduledDate?: string | null;
  notToExceed?: unknown;
  attachmentIds?: string[];
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        workOrderId: input.workOrderId,
        title: input.title.trim(),
        scope: input.scope.trim(),
        subcontractorId: input.subcontractorId,
        scheduledDate: input.scheduledDate ?? "",
        notToExceed: input.notToExceed ?? "",
        attachmentIds: [...(input.attachmentIds ?? [])].sort(),
      })
    )
    .digest("hex");
}

export async function saveWorkOrderApproval(input: Omit<WorkOrderApproval, "id" | "approvedAt" | "approvedBy"> & { approvedBy?: string }) {
  if (input.approvedBy && input.approvedBy !== DISPATCH_APPROVER) {
    throw new Error("Logan must approve this dispatch.");
  }
  return withFileLock(`approval-${input.workOrderId}`, async () => {
    const store = await readStore();
    const approval: WorkOrderApproval = {
      id: randomUUID(),
      workOrderId: input.workOrderId,
      subcontractorId: input.subcontractorId,
      fingerprint: input.fingerprint,
      approvedBy: DISPATCH_APPROVER,
      approvedAt: new Date().toISOString(),
    };
    store.approvals.push(approval);
    await writeStore(store);
    return approval;
  });
}

export async function consumeWorkOrderApproval(approvalId: string, fingerprint: string) {
  return withFileLock(`consume-${approvalId}`, async () => {
    const store = await readStore();
    const approval = store.approvals.find((item) => item.id === approvalId);
    if (!approval || approval.approvedBy !== DISPATCH_APPROVER) {
      throw new Error("Logan must approve this dispatch before it is sent.");
    }
    if (approval.consumedAt) {
      throw new Error("This dispatch was already sent.");
    }
    if (approval.fingerprint !== fingerprint) {
      throw new Error("This job changed after approval. Logan must approve it again.");
    }
    approval.consumedAt = new Date().toISOString();
    await writeStore(store);
    return approval;
  });
}
