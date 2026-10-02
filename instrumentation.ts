export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { ensureDispatchMonitor } = await import("./lib/integrations/dispatch-monitor");
  await ensureDispatchMonitor();
}
