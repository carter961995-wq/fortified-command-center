import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createLocalDataClient, resetLocalDataStoreForTests } from "../src/lib/demo-client.ts";
import { isDemoMode, isLiveLocalMode, isSupabaseConfigured } from "../src/lib/demo-mode.ts";

test("production defaults are live local, not demo", () => {
  const previousDemo = process.env.NEXT_PUBLIC_DEMO_MODE;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_DEMO_MODE = "false";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    assert.equal(isDemoMode(), false);
    assert.equal(isSupabaseConfigured(), false);
    assert.equal(isLiveLocalMode(), true);
  } finally {
    process.env.NEXT_PUBLIC_DEMO_MODE = previousDemo;
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test("production local store starts empty and persists shop records", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fortified-local-"));
  const previousDir = process.env.FORTIFIED_USER_DATA_DIR;
  process.env.FORTIFIED_USER_DATA_DIR = dir;
  try {
    resetLocalDataStoreForTests({ seed: false });
    const client = createLocalDataClient({ seed: false });
    const { data: customers } = await client.from("customers").select("*");
    assert.equal(customers.length, 0);
    const { data: workOrders } = await client.from("work_orders").select("*");
    assert.equal(workOrders.length, 0);
    const { data: profile } = await client.from("users_profile").select("*");
    assert.equal(profile[0].email, "operator@fortified.local");
    assert.equal(profile[0].full_name, "Operator");

    await client.from("customers").insert({
      company_name: "Fortified Fence & Weld",
      customer_type: "commercial",
      status: "active",
    });
    const { data: saved } = await client.from("customers").select("*");
    assert.equal(saved.length, 1);
    assert.equal(saved[0].company_name, "Fortified Fence & Weld");

    const snapshot = JSON.parse(await readFile(path.join(dir, "local-records.json"), "utf8"));
    assert.equal(snapshot.customers.length, 1);
    assert.equal(snapshot.customers[0].company_name, "Fortified Fence & Weld");
  } finally {
    process.env.FORTIFIED_USER_DATA_DIR = previousDir;
    await rm(dir, { recursive: true, force: true });
  }
});
