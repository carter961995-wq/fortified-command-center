import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createDemoClient } from "../../src/lib/demo-client";
import { getSupabaseEnv, isDemoMode, isSupabaseConfigured } from "../env";

export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (isDemoMode()) return createDemoClient() as unknown as SupabaseClient;
  if (!isSupabaseConfigured()) return null;
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components cannot always set cookies; middleware refreshes sessions.
        }
      }
    }
  }) as SupabaseClient;
}

export function createSupabaseServiceClient(): SupabaseClient | null {
  if (isDemoMode()) return createDemoClient() as unknown as SupabaseClient;
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  }) as SupabaseClient;
}
