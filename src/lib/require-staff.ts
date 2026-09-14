import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode, isSupabaseConfigured } from "@/lib/demo-mode";

const STAFF_ROLES = ["owner", "admin"] as const;

export type StaffProfile = {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
};

export async function requireStaff(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  profile: StaffProfile;
}> {
  const supabase = await createClient();

  if (isDemoMode() || !isSupabaseConfigured()) {
    const user = {
      id: "00000000-0000-4000-8000-000000000001",
      email: isDemoMode() ? "demo@fortified.local" : "operator@fortified.local",
    } as User;
    return {
      supabase,
      user,
      profile: {
        id: "00000000-0000-4000-8000-000000000002",
        auth_user_id: user.id,
        full_name: isDemoMode() ? "Demo Admin" : "Operator",
        email: user.email || "",
        phone: null,
        role: "owner",
      },
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("users_profile")
    .select("id, auth_user_id, full_name, email, phone, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !profile || !STAFF_ROLES.includes(profile.role as (typeof STAFF_ROLES)[number])) {
    redirect("/login?error=forbidden");
  }

  return { supabase, user, profile: profile as StaffProfile };
}
