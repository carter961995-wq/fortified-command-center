"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const err = searchParams.get("error");
  const demoMode = isDemoMode();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(err === "forbidden" ? "Your account is not authorized for this dashboard." : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    if (demoMode) {
      router.push(dest === "/" ? "/dashboard" : dest);
      router.refresh();
      return;
    }

    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.push(dest === "/" ? "/dashboard" : dest);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-border">
        <CardHeader>
          <CardTitle className="text-xl">Fortified Work Order Command Center</CardTitle>
          <CardDescription>
            {demoMode ? "Local demo mode is enabled. No Supabase account is required." : "Internal sign-in for owner and admin roles."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {demoMode ? (
              <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                Demo data is loaded in memory and resets when the dev server restarts.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </>
            )}
            {message ? <p className="text-sm text-destructive">{message}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {demoMode ? "Open demo dashboard" : loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
