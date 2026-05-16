"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
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
      {!configured ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before signing in.</div> : null}
      <label>Email<input autoComplete="email" disabled={!configured} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Password<input autoComplete="current-password" disabled={!configured} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <button className="rounded-xl bg-amber-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={!configured || isPending} type="submit">{isPending ? "Signing in..." : "Sign in"}</button>
      {message ? <p className="text-sm font-semibold text-red-700">{message}</p> : null}
    </form>
  );
}
