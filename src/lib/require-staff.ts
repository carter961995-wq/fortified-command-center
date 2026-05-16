import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
