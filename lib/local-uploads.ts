import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { userDataDir } from "./file-lock.ts";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type StoredUpload = {
  id: string;
  workOrderId: string;
  filename: string;
  mimeType: string;
  size: number;
  relativePath: string;
  createdAt: string;
};

type UploadIndex = { files: StoredUpload[] };

function indexPath() {
  return path.join(userDataDir(), "uploads", "index.json");
}

function safeFilename(name: string) {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^\.+/, "");
  if (!base || base === "." || base === ".." || base.includes("..")) return null;
  return base.slice(0, 120);
}

export function validateUpload(input: { filename: string; mimeType: string; size: number }) {
  const filename = safeFilename(input.filename);
  if (!filename) return { ok: false as const, error: "That file name is not allowed." };
  if (!ALLOWED_TYPES.has(input.mimeType)) return { ok: false as const, error: "Upload a JPEG, PNG, GIF, WebP, or PDF." };
  if (!Number.isFinite(input.size) || input.size <= 0) return { ok: false as const, error: "The file is empty." };
  if (input.size > MAX_UPLOAD_BYTES) return { ok: false as const, error: "Files must be 15 MB or smaller." };
  return { ok: true as const, filename };
}

async function readIndex(): Promise<UploadIndex> {
  try {
    const parsed = JSON.parse(await readFile(indexPath(), "utf8")) as UploadIndex;
    return { files: Array.isArray(parsed.files) ? parsed.files : [] };
  } catch {
    return { files: [] };
  }
}

export async function saveLocalUpload(input: { workOrderId: string; filename: string; mimeType: string; bytes: Uint8Array }) {
  const checked = validateUpload({ filename: input.filename, mimeType: input.mimeType, size: input.bytes.byteLength });
  if (!checked.ok) return checked;
  if (!/^[a-zA-Z0-9-]{8,}$/.test(input.workOrderId)) return { ok: false as const, error: "That work order cannot store files." };
  const id = randomUUID();
  const relativePath = path.join("uploads", input.workOrderId, id);
  const absolute = path.join(userDataDir(), relativePath);
  const root = path.resolve(userDataDir());
  if (!path.resolve(absolute).startsWith(root + path.sep)) return { ok: false as const, error: "That file path is not allowed." };
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, input.bytes);
  const stored: StoredUpload = {
    id,
    workOrderId: input.workOrderId,
    filename: checked.filename,
    mimeType: input.mimeType,
    size: input.bytes.byteLength,
    relativePath,
    createdAt: new Date().toISOString(),
  };
  const index = await readIndex();
  index.files.push(stored);
  await mkdir(path.dirname(indexPath()), { recursive: true });
  await writeFile(indexPath(), JSON.stringify(index, null, 2));
  const written = await readFile(absolute);
  if (written.byteLength !== input.bytes.byteLength) {
    return { ok: false as const, error: "The file was not stored." };
  }
  return { ok: true as const, file: stored, url: `/api/local-files/${id}` };
}

export async function readLocalUpload(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const index = await readIndex();
  const file = index.files.find((item) => item.id === id);
  if (!file) return null;
  const absolute = path.resolve(userDataDir(), file.relativePath);
  const root = path.resolve(userDataDir());
  if (!absolute.startsWith(root + path.sep)) return null;
  try {
    const bytes = await readFile(absolute);
    if (bytes.byteLength !== file.size) return null;
    return { file, bytes };
  } catch {
    return null;
  }
}
