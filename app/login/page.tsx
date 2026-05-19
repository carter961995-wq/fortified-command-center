import { LoginForm } from "./login-form";
import { isDemoMode, isSupabaseConfigured } from "../../lib/env";

export default function LoginPage() {
  const demoMode = isDemoMode();
  const configured = isSupabaseConfigured();
  return (
    <main className="industrial-grid flex min-h-screen items-center justify-center bg-stone-950 p-4">
      <section className="w-full max-w-md rounded-3xl border border-stone-800 bg-white p-8 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-700">Fortified Fence & Weld</p>
        <h1 className="mt-3 text-3xl font-black text-stone-950">Command Center Login</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">Private internal dashboard for work orders, vendors, invoices, job costs, maintenance contracts, and reporting.</p>
        <div className="mt-6"><LoginForm configured={configured || demoMode} demoMode={demoMode} /></div>
      </section>
    </main>
  );
}
