export type IntakeFile = {
  name: string;
  mimeType?: string;
  source: "gmail" | "portal" | "email";
  attachmentId?: string;
  messageId?: string;
  sourceUrl?: string;
  localPath?: string;
  size?: number;
};

type GmailPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
};

const FILE_URL =
  /https?:\/\/[^\s<>"']+\.(?:jpe?g|png|gif|webp|pdf|docx?|xlsx?|csv|heic|zip)(?:\?[^\s<>"']*)?/gi;

export function fileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").filter(Boolean).pop() || "attachment";
    return decodeURIComponent(base).slice(0, 120);
  } catch {
    return "attachment";
  }
}

export function mimeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (/\.(jpe?g|heic)$/.test(lower)) return "image/jpeg";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

export function isImageFile(file: Pick<IntakeFile, "name" | "mimeType">) {
  return Boolean(file.mimeType?.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic)$/i.test(file.name));
}

export function collectGmailFiles(payload: GmailPart | undefined, messageId: string): IntakeFile[] {
  const files: IntakeFile[] = [];
  const walk = (part?: GmailPart) => {
    if (!part) return;
    const name = part.filename?.trim();
    if (name && (part.body?.attachmentId || part.body?.data)) {
      files.push({
        name,
        mimeType: part.mimeType || mimeFromName(name),
        source: "gmail",
        attachmentId: part.body?.attachmentId,
        messageId,
        size: part.body?.size,
      });
    }
    for (const child of part.parts ?? []) walk(child);
  };
  walk(payload);
  return mergeIntakeFiles([], files);
}

export function collectFilesFromText(text: string): IntakeFile[] {
  const files: IntakeFile[] = [];
  for (const match of text.matchAll(FILE_URL)) {
    const sourceUrl = match[0].replace(/[),.;]+$/, "");
    files.push({
      name: fileNameFromUrl(sourceUrl),
      mimeType: mimeFromName(sourceUrl),
      source: "email",
      sourceUrl,
    });
  }
  return mergeIntakeFiles([], files);
}

export function collectHtmlFileLinks(html: string): IntakeFile[] {
  const files: IntakeFile[] = [];
  const regex = /\b(?:href|src)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(regex)) {
    const url = match[1];
    if (!/^https?:\/\//i.test(url)) continue;
    if (!/\.(?:jpe?g|png|gif|webp|pdf|docx?|xlsx?|heic)(?:\?|$)/i.test(url) && !/attachment|download|photo|image|document/i.test(url)) {
      continue;
    }
    files.push({
      name: fileNameFromUrl(url),
      mimeType: mimeFromName(url),
      source: "portal",
      sourceUrl: url,
    });
  }
  return mergeIntakeFiles([], files);
}

export function mergeIntakeFiles(existing: IntakeFile[] = [], incoming: IntakeFile[] = []) {
  const keyOf = (file: IntakeFile) =>
    `${file.source}:${file.messageId || ""}:${file.attachmentId || file.sourceUrl || file.name}`.toLowerCase();
  const map = new Map<string, IntakeFile>();
  for (const file of [...existing, ...incoming]) {
    if (!file?.name) continue;
    const key = keyOf(file);
    const previous = map.get(key);
    map.set(key, previous ? { ...previous, ...file, localPath: file.localPath || previous.localPath } : file);
  }
  return [...map.values()];
}
