import { NextResponse } from "next/server";
import { deleteNote, updateNote } from "../../../../lib/notepad-store";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { title?: string; body?: string };
  const note = await updateNote(id, body);
  if (!note) return NextResponse.json({ ok: false, error: "Note not found." }, { status: 404 });
  return NextResponse.json({ note });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const removed = await deleteNote(id);
  if (!removed) return NextResponse.json({ ok: false, error: "Note not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
