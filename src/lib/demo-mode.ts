export function isDemoMode() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "false") return false;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    !url ||
    !anonKey ||
    url.includes("your-project") ||
    anonKey.includes("your-anon-key")
  );
}
