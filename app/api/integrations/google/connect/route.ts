import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { googleAuthUrl, googleOAuthConfigured } from "../../../../../lib/integrations/google";

export async function GET(request: NextRequest) {
  if (!googleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET." },
      { status: 400 }
    );
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 10 * 60,
    path: "/",
  });

  return NextResponse.redirect(googleAuthUrl({ origin: request.nextUrl.origin, state }));
}
