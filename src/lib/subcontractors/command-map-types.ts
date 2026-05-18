export const ACTIVE_OPERATIONAL_STATES = [
  "GA",
  "LA",
  "MS",
  "AL",
  "AR",
  "KS",
  "MO",
  "TN",
] as const;

export type OperationalState = (typeof ACTIVE_OPERATIONAL_STATES)[number];

export interface Subcontractor {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  location: {
    city: string;
    state: OperationalState;
    lat: number;
    lng: number;
  };
  service_radius: number;
  skills: string[];
  waitsForPayout: boolean;
  notes: string;
}

export interface SubcontractorWrapSheet extends Subcontractor {
  activeCities: string[];
  pricingTier: string;
  historicalPerformance: string;
  website?: string;
  source: "network" | "ai";
  archived?: boolean;
}

export interface AiSourcingRecommendation {
  id: string;
  companyName: string;
  phone: string;
  website: string;
  proximity: string;
  city?: string;
  state?: OperationalState;
  lat?: number;
  lng?: number;
  skills?: string[];
  summary?: string;
  confidence?: "high" | "medium" | "low";
}

export interface KnownCityCoordinate {
  city: string;
  state: OperationalState;
  lat: number;
  lng: number;
}
