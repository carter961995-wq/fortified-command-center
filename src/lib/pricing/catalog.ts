export type PriceCategory = "material" | "subcontractor" | "equipment" | "overhead" | "labor";

export type PriceItem = {
  id: string;
  category: PriceCategory;
  name: string;
  unit: string;
  cost: number;
  sell?: number;
  notes?: string;
};

export const COMPANY_OVERHEAD = {
  burdenPercent: 18,
  profitTargetPercent: 22,
  tripChargeDefault: 175,
  emergencyMultiplier: 1.5,
  fuelPerMile: 0.85,
} as const;

export const PRICE_CATALOG: PriceItem[] = [
  { id: "mat-cl-9ga", category: "material", name: "9ga chain link fabric, 6ft", unit: "lf", cost: 6.4, sell: 11.5, notes: "Galvanized, commercial" },
  { id: "mat-cl-11ga", category: "material", name: "11ga chain link fabric, 4ft", unit: "lf", cost: 3.8, sell: 7.25 },
  { id: "mat-tr-1-5", category: "material", name: "1-5/8 in top rail", unit: "lf", cost: 3.1, sell: 5.75 },
  { id: "mat-post-ss", category: "material", name: "2-3/8 in SS40 line post", unit: "ea", cost: 28, sell: 48 },
  { id: "mat-post-term", category: "material", name: "2-7/8 in terminal post", unit: "ea", cost: 46, sell: 78 },
  { id: "mat-gate-slide", category: "material", name: "Cantilever slide gate 20ft", unit: "ea", cost: 1850, sell: 3200 },
  { id: "mat-op-liftmaster", category: "material", name: "LiftMaster industrial operator", unit: "ea", cost: 1425, sell: 2450 },
  { id: "mat-bollard", category: "material", name: "6 in SCH40 steel bollard 7ft", unit: "ea", cost: 95, sell: 185 },
  { id: "mat-concrete", category: "material", name: "3000 PSI concrete", unit: "cy", cost: 165, sell: 275 },
  { id: "mat-weld-wire", category: "material", name: "ER70S-6 MIG wire .035", unit: "lb", cost: 3.4, sell: 6.5 },
  { id: "mat-orn-panel", category: "material", name: "Ornamental steel panel 8ft x 6ft", unit: "ea", cost: 210, sell: 385 },
  { id: "mat-grille", category: "material", name: "Security grille track / slat kit", unit: "lf", cost: 42, sell: 78 },
  { id: "sub-fence-crew", category: "subcontractor", name: "Fence crew day rate", unit: "day", cost: 850, notes: "2-man crew typical" },
  { id: "sub-welder", category: "subcontractor", name: "Certified welder", unit: "hr", cost: 85, sell: 145 },
  { id: "sub-gate-tech", category: "subcontractor", name: "Gate / operator technician", unit: "hr", cost: 95, sell: 165 },
  { id: "sub-emergency", category: "subcontractor", name: "After-hours emergency dispatch", unit: "trip", cost: 325, sell: 575 },
  { id: "eq-skid", category: "equipment", name: "Skid steer with auger", unit: "day", cost: 285, sell: 425 },
  { id: "eq-welder", category: "equipment", name: "Mobile welder / generator", unit: "day", cost: 95, sell: 165 },
  { id: "eq-lift", category: "equipment", name: "Towable boom lift", unit: "day", cost: 240, sell: 375 },
  { id: "eq-trailer", category: "equipment", name: "Equipment trailer / haul", unit: "trip", cost: 120, sell: 195 },
  { id: "oh-admin", category: "overhead", name: "Office / billing burden", unit: "%", cost: COMPANY_OVERHEAD.burdenPercent, notes: "Applied to job cost" },
  { id: "oh-insurance", category: "overhead", name: "GL / WC allocation", unit: "%", cost: 6.5 },
  { id: "oh-warranty", category: "overhead", name: "Warranty reserve", unit: "%", cost: 3 },
  { id: "lab-pm", category: "labor", name: "Project manager", unit: "hr", cost: 55, sell: 95 },
  { id: "lab-estimator", category: "labor", name: "Estimator / takeoff", unit: "hr", cost: 48, sell: 85 },
];

export function suggestSellPrice(cost: number, category: PriceCategory) {
  const markup =
    category === "material" ? 1.75 : category === "equipment" ? 1.5 : category === "subcontractor" ? 1.55 : 1.7;
  const withBurden = cost * (1 + COMPANY_OVERHEAD.burdenPercent / 100);
  return Math.round(withBurden * markup * 100) / 100;
}

export function jobEstimate(input: { material: number; subcontractor: number; equipment: number; other?: number }) {
  const direct = input.material + input.subcontractor + input.equipment + (input.other ?? 0);
  const burden = direct * (COMPANY_OVERHEAD.burdenPercent / 100);
  const costWithOh = direct + burden;
  const sell = costWithOh / (1 - COMPANY_OVERHEAD.profitTargetPercent / 100);
  return {
    direct,
    burden: Math.round(burden * 100) / 100,
    costWithOh: Math.round(costWithOh * 100) / 100,
    suggestedSell: Math.round(sell * 100) / 100,
    targetProfit: Math.round((sell - costWithOh) * 100) / 100,
  };
}

export function searchCatalog(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return PRICE_CATALOG;
  return PRICE_CATALOG.filter((item) =>
    [item.name, item.category, item.notes, item.unit].filter(Boolean).join(" ").toLowerCase().includes(q)
  );
}
