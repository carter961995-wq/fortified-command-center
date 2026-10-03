import { NextResponse } from "next/server";
import { createNote, listNotes } from "../../../lib/notepad-store";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ notes: await listNotes(query) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { title?: string; body?: string };
  const note = await createNote(body);
  return NextResponse.json({ note });
}
