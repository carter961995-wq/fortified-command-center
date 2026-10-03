import { NextResponse } from "next/server";
import { readLocalUpload } from "../../../../lib/local-uploads";

export async function GET(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  const stored = await readLocalUpload(fileId);
  if (!stored) return new NextResponse("File not found.", { status: 404 });
  return new NextResponse(Buffer.from(stored.bytes), {
    headers: {
      "Content-Type": stored.file.mimeType,
      "Content-Length": String(stored.bytes.byteLength),
      "Content-Disposition": `inline; filename="${stored.file.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
