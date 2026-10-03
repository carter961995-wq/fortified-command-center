/** Customer DNE stays internal. Contractors are told half, rounded to the cent. */
export function subcontractorDneAmount(amount?: number | null): number | null {
  if (amount == null) return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 50) / 100;
}

export function formatMoney(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}

function amountVariants(amount: number) {
  const fixed = Math.abs(amount).toFixed(2);
  const [dollars, cents] = fixed.split(".");
  const grouped = dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const bodies = new Set([`${dollars}.${cents}`, `${grouped}.${cents}`]);
  if (cents === "00") {
    bodies.add(dollars);
    bodies.add(grouped);
  }
  return [...bodies]
    .sort((left, right) => right.length - left.length)
    .map((body) => body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

/**
 * Rewrite labeled DNE / NTE figures in contractor-facing copy.
 * A $2,000 customer limit becomes $1,000. Unlabeled scope text is left as written.
 */
export function redactSubcontractorDne(text: string, fullAmount?: number | null): string {
  if (!text) return text;
  const half = subcontractorDneAmount(fullAmount);
  if (fullAmount == null || half == null) return text;
  const variants = amountVariants(Number(fullAmount)).join("|");
  if (!variants) return text;
  const amount = `(?:\\$\\s*)?(?:${variants})`;
  const labeled = new RegExp(
    `(\\b(?:not\\s*to\\s*exceed|dne|nte)(?:\\s*/\\s*(?:dne|nte))?(?:\\s*(?:amount|limit))?(?:\\s+of)?\\s*[:#\\-]?\\s*)${amount}`,
    "gi"
  );
  const halfLabel = formatMoney(half);
  return text.replace(labeled, (_match, label: string) => `${label}${halfLabel}`);
}
