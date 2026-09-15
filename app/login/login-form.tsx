"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export function LoginForm({ configured, demoMode = false }: { configured: boolean; demoMode?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const localLive = !configured && !demoMode;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
      if (demoMode || localLive) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Login failed.");
      }
    });
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      {demoMode ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          Local demo mode is enabled. No Supabase account is required.
        </div>
      ) : null}
      {localLive ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-950">
          Production mode on this computer. Open the Command Center, then sign in with Gmail or log in to mHelpDesk /
          Affiliate Connect. The app pulls and organizes the work from there. Records are stored locally until you add
          Supabase keys.
        </div>
      ) : null}
      {!configured && !localLive && !demoMode ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before signing in.
        </div>
      ) : null}
      {!demoMode && !localLive ? (
        <>
          <label>Email<input autoComplete="email" disabled={!configured} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input autoComplete="current-password" disabled={!configured} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        </>
      ) : null}
      <button
        className="rounded-xl bg-amber-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        disabled={isPending || (!demoMode && !configured && !localLive)}
        type="submit"
      >
        {demoMode ? "Open demo dashboard" : localLive ? "Open Command Center" : isPending ? "Signing in..." : "Sign in"}
      </button>
      {message ? <p className="text-sm font-semibold text-red-700">{message}</p> : null}
    </form>
  );
}
