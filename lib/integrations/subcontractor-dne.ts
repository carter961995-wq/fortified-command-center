/** Compare in cents; an unverified or non-lower cap is never dispatchable. */
export function subcontractorDneAmount(customerLimit?: number | null, explicitLimit?: number | null): number | null {
  if (typeof customerLimit !== "number" || typeof explicitLimit !== "number") return null;
  if (!Number.isFinite(customerLimit) || !Number.isFinite(explicitLimit)) return null;
  const customer = Math.round(customerLimit * 100);
  const sub = Math.round(explicitLimit * 100);
  return Number.isSafeInteger(customer) && Number.isSafeInteger(sub) && sub > 0 && sub < customer &&
    Math.abs(sub / 100 - explicitLimit) < 0.000001 ? sub / 100 : null;
}

export function formatMoney(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}
