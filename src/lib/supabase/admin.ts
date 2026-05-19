import { createClient } from "@supabase/supabase-js";
import { createDemoClient } from "@/lib/demo-client";
import { isDemoMode } from "@/lib/demo-mode";

/** Server-only: PDF uploads and privileged operations. Never import in client components. */
export function createAdminClient() {
  if (isDemoMode()) {
    return createDemoClient() as any;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
