import { mkdir, open, stat, unlink } from "node:fs/promises";
import path from "node:path";

export function userDataDir() {
  return (
    process.env.FORTIFIED_USER_DATA_DIR ||
    process.env.FORTIFIED_INTEGRATION_DIR ||
    path.join(process.cwd(), ".fortified-data")
  );
}

export async function withFileLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
  const dir = path.join(userDataDir(), "locks");
  await mkdir(dir, { recursive: true });
  const lockPath = path.join(dir, `${safe}.lock`);
  const started = Date.now();
  for (;;) {
    try {
      const handle = await open(lockPath, "wx");
      try {
        return await fn();
      } finally {
        await handle.close();
        await unlink(lockPath).catch(() => undefined);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      try {
        const info = await stat(lockPath);
        if (Date.now() - info.mtimeMs > 60_000) await unlink(lockPath);
      } catch {
        /* The lock disappeared while we waited. */
      }
      if (Date.now() - started > 15_000) throw new Error("Timed out waiting for a file lock.");
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }
}
