import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getJobIntakeRecord } from "../../../../lib/integrations/job-intake";

function dataRoot() {
  return path.resolve(
    process.env.FORTIFIED_USER_DATA_DIR ||
      process.env.FORTIFIED_INTEGRATION_DIR ||
      path.join(process.cwd(), ".fortified-data")
  );
}

function insideDataRoot(filePath: string) {
  const root = dataRoot();
  const target = path.resolve(filePath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const intakeId = url.searchParams.get("intakeId") || "";
  const record = await getJobIntakeRecord(intakeId);
  if (!record) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

  const document = url.searchParams.get("document") === "1";
  const fileIndex = Number(url.searchParams.get("file"));
  const target = document ? record.dispatch?.documentPath : record.files?.[fileIndex]?.localPath;
  if (!target || !insideDataRoot(target)) {
    return NextResponse.json({ ok: false, error: "File is not stored on this computer." }, { status: 404 });
  }

  const bytes = await readFile(target);
  const filename = document
    ? `${record.dispatch?.fortifiedWorkOrderNumber || "fortified-work-order"}.pdf`
    : record.files?.[fileIndex]?.name || path.basename(target);
  const mime = document ? "application/pdf" : record.files?.[fileIndex]?.mimeType || "application/octet-stream";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": mime,
      "content-disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
    },
  });
}
