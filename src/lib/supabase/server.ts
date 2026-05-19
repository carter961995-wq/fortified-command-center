import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createDemoClient } from "@/lib/demo-client";
import { isDemoMode } from "@/lib/demo-mode";

export async function createClient(): Promise<SupabaseClient> {
  if (isDemoMode()) {
    return createDemoClient() as unknown as SupabaseClient;
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* ignore when called from a Server Component */
          }
        },
      },
    }
  ) as SupabaseClient;
}
