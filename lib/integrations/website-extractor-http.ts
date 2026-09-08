import { NextResponse } from "next/server";
import { extractWebsite, saveExtractedCompany, type ExtractedCompany } from "./website-extractor";

export async function handleWebsiteExtractor(request: Request) {
  try {
    const body = (await request.json()) as Partial<ExtractedCompany> & {
      action?: string;
      url?: string;
      html?: string;
      text?: string;
      as?: "lead" | "customer";
    };
    const action = body.action || "extract";
    if (action === "save") {
      const result = await saveExtractedCompany({
        companyName: body.companyName ?? "",
        phone: body.phone ?? "",
        email: body.email ?? "",
        website: body.website ?? "",
        address: body.address ?? "",
        city: body.city ?? "",
        state: body.state ?? "",
        zip: body.zip ?? "",
        contactName: body.contactName ?? "",
        services: Array.isArray(body.services) ? body.services : [],
        summary: body.summary ?? "",
        sourceUrl: body.sourceUrl ?? body.website ?? body.url ?? "",
        as: body.as,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const extracted = await extractWebsite({
      url: body.url,
      html: body.html,
      text: body.text,
    });
    return NextResponse.json({ ok: true, extracted });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Website extraction failed." },
      { status: 400 }
    );
  }
}
