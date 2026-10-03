/** Positive currency amounts with at most two decimal places. Refunds are not payments. */
export function parsePositiveMoney(raw: unknown): { ok: true; amount: number } | { ok: false; error: string } {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return { ok: false, error: "Payment amount must be a finite number." };
    raw = String(raw);
  }
  const text = String(raw ?? "").trim().replace(/[$,]/g, "");
  if (!text || /e/i.test(text) || text === "NaN" || text === "Infinity" || text === "-Infinity") {
    return { ok: false, error: "Payment amount must be a positive dollar value." };
  }
  if (text.startsWith("-")) {
    return { ok: false, error: "Refunds use an adjustment workflow. Payment amounts must be positive." };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return { ok: false, error: "Payment amount must be a positive number with at most two decimal places." };
  }
  const amount = Math.round(Number(text) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Payment amount must be greater than zero." };
  }
  return { ok: true, amount };
}

/** Signed non-zero currency amount for an explicit refund or adjustment. */
export function parseAdjustmentMoney(raw: unknown): { ok: true; amount: number } | { ok: false; error: string } {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return { ok: false, error: "Adjustment amount must be a finite number." };
    raw = String(raw);
  }
  const text = String(raw ?? "").trim().replace(/[$,]/g, "");
  if (!text || /e/i.test(text) || text === "NaN" || text === "Infinity" || text === "-Infinity") {
    return { ok: false, error: "Adjustment amount must be a dollar value." };
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
    return { ok: false, error: "Adjustment amount must have at most two decimal places." };
  }
  const amount = Math.round(Number(text) * 100) / 100;
  if (!Number.isFinite(amount) || amount === 0) {
    return { ok: false, error: "Adjustment amount cannot be zero." };
  }
  return { ok: true, amount };
}
