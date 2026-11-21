import { isDemoMode, isSupabaseConfigured } from "../env";
import { getSessionContext } from "../data";

export async function requireDispatchOwner() {
  if (isDemoMode() || !isSupabaseConfigured()) {
    throw new Error("Live email approval and sending require a signed-in Command Center owner. Draft preview is available without live sending.");
  }
  const { user, profile } = await getSessionContext();
  if (!user || profile?.role !== "owner") {
    throw new Error("Only the signed-in Command Center owner can approve or send this email.");
  }
}


export async function requireDispatchEditor() {
  if (!isDemoMode() && isSupabaseConfigured()) await requireDispatchOwner();
}
