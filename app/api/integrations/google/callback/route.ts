import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeGoogleCode } from "../../../../../lib/integrations/google";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;

  if (error) {
    return redirectWithStatus(request, `Google authorization failed: ${error}`);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithStatus(request, "Google authorization state did not match. Try connecting again.");
  }

  try {
    await exchangeGoogleCode({ code, origin: request.nextUrl.origin });
    cookieStore.delete("google_oauth_state");
    try {
      const { syncAllJobSources } = await import("../../../../../lib/integrations/source-sync");
      await syncAllJobSources({ force: true });
    } catch {
      // Connection still succeeded; inbox pages will retry sync.
    }
    return redirectWithStatus(request, "Gmail connected. Inbox and work orders are being organized now.");
  } catch (callbackError) {
    return redirectWithStatus(
      request,
      callbackError instanceof Error ? callbackError.message : "Google authorization failed."
    );
  }
}

function redirectWithStatus(request: NextRequest, message: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/email-inbox";
  url.searchParams.set("google", message);
  return NextResponse.redirect(url);
}
