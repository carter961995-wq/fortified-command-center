import type {
  KnownCityCoordinate,
  OperationalState,
  SubcontractorWrapSheet,
} from "./command-map-types";

export const KNOWN_CITY_COORDINATES: KnownCityCoordinate[] = [
  { city: "Atlanta", state: "GA", lat: 33.749, lng: -84.388 },
  { city: "Augusta", state: "GA", lat: 33.4735, lng: -82.0105 },
  { city: "Savannah", state: "GA", lat: 32.0809, lng: -81.0912 },
  { city: "Marietta", state: "GA", lat: 33.9526, lng: -84.5499 },
  { city: "Athens", state: "GA", lat: 33.9519, lng: -83.3576 },
  { city: "Macon", state: "GA", lat: 32.8407, lng: -83.6324 },
  { city: "Roswell", state: "GA", lat: 34.0232, lng: -84.3616 },
  { city: "New Orleans", state: "LA", lat: 29.9511, lng: -90.0715 },
  { city: "Metairie", state: "LA", lat: 29.9841, lng: -90.1529 },
  { city: "Kenner", state: "LA", lat: 29.9941, lng: -90.2417 },
  { city: "Baton Rouge", state: "LA", lat: 30.4515, lng: -91.1871 },
  { city: "Port Allen", state: "LA", lat: 30.4524, lng: -91.2101 },
  { city: "Lafayette", state: "LA", lat: 30.2241, lng: -92.0198 },
  { city: "Shreveport", state: "LA", lat: 32.5252, lng: -93.7502 },
  { city: "Houma", state: "LA", lat: 29.5958, lng: -90.7195 },
  { city: "Lake Charles", state: "LA", lat: 30.2266, lng: -93.2174 },
  { city: "Monroe", state: "LA", lat: 32.5093, lng: -92.1193 },
  { city: "Jackson", state: "MS", lat: 32.2988, lng: -90.1848 },
  { city: "Gulfport", state: "MS", lat: 30.3674, lng: -89.0928 },
  { city: "Biloxi", state: "MS", lat: 30.396, lng: -88.8853 },
  { city: "Hattiesburg", state: "MS", lat: 31.3271, lng: -89.2903 },
  { city: "Meridian", state: "MS", lat: 32.3643, lng: -88.7037 },
  { city: "Vicksburg", state: "MS", lat: 32.3526, lng: -90.8779 },
  { city: "Birmingham", state: "AL", lat: 33.5186, lng: -86.8104 },
  { city: "Mobile", state: "AL", lat: 30.6954, lng: -88.0399 },
  { city: "Tuscaloosa", state: "AL", lat: 33.2098, lng: -87.5692 },
  { city: "Montgomery", state: "AL", lat: 32.3792, lng: -86.3077 },
  { city: "Huntsville", state: "AL", lat: 34.7304, lng: -86.5861 },
  { city: "Little Rock", state: "AR", lat: 34.7465, lng: -92.2896 },
  { city: "Fayetteville", state: "AR", lat: 36.0626, lng: -94.1574 },
  { city: "Fort Smith", state: "AR", lat: 35.3859, lng: -94.3985 },
  { city: "Wichita", state: "KS", lat: 37.6872, lng: -97.3301 },
  { city: "Topeka", state: "KS", lat: 39.0473, lng: -95.6752 },
  { city: "Kansas City", state: "KS", lat: 39.1142, lng: -94.6275 },
  { city: "Kansas City", state: "MO", lat: 39.0997, lng: -94.5786 },
  { city: "Springfield", state: "MO", lat: 37.209, lng: -93.2923 },
  { city: "Columbia", state: "MO", lat: 38.9517, lng: -92.3341 },
  { city: "St. Louis", state: "MO", lat: 38.627, lng: -90.1994 },
  { city: "Nashville", state: "TN", lat: 36.1627, lng: -86.7816 },
  { city: "Murfreesboro", state: "TN", lat: 35.8456, lng: -86.3903 },
  { city: "Clarksville", state: "TN", lat: 36.5298, lng: -87.3595 },
  { city: "Knoxville", state: "TN", lat: 35.9606, lng: -83.9207 },
  { city: "Chattanooga", state: "TN", lat: 35.0456, lng: -85.3097 },
  { city: "Memphis", state: "TN", lat: 35.1495, lng: -90.049 },
];

export const US_STATE_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  AL: { lat: 32.8067, lng: -86.7911 },
  AR: { lat: 34.9697, lng: -92.3731 },
  GA: { lat: 32.6415, lng: -83.4426 },
  KS: { lat: 38.4937, lng: -98.3804 },
  LA: { lat: 31.1695, lng: -91.8678 },
  MO: { lat: 38.4561, lng: -92.2884 },
  MS: { lat: 32.7416, lng: -89.6787 },
  TN: { lat: 35.7478, lng: -86.6923 },
  TX: { lat: 31.0545, lng: -97.5635 },
};

export const STATE_FALLBACK_COORDINATES: Record<OperationalState, KnownCityCoordinate> = {
  GA: { city: "Atlanta", state: "GA", lat: 33.749, lng: -84.388 },
  LA: { city: "Baton Rouge", state: "LA", lat: 30.4515, lng: -91.1871 },
  MS: { city: "Jackson", state: "MS", lat: 32.2988, lng: -90.1848 },
  AL: { city: "Birmingham", state: "AL", lat: 33.5186, lng: -86.8104 },
  AR: { city: "Little Rock", state: "AR", lat: 34.7465, lng: -92.2896 },
  KS: { city: "Wichita", state: "KS", lat: 37.6872, lng: -97.3301 },
  MO: { city: "Kansas City", state: "MO", lat: 39.0997, lng: -94.5786 },
  TN: { city: "Nashville", state: "TN", lat: 36.1627, lng: -86.7816 },
};

export interface SubcontractorCluster {
  id: string;
  lat: number;
  lng: number;
  members: SubcontractorWrapSheet[];
}

export function milesToMeters(miles: number) {
  return Math.max(0, miles) * 1609.344;
}

export function serviceRadiusToMarkerRadius(serviceRadius: number) {
  return Math.max(8, Math.min(30, Math.round(serviceRadius / 8)));
}

export function calculateMilesBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversine));
}

export function clusterSubcontractors(
  subcontractors: SubcontractorWrapSheet[],
  thresholdMiles = 18
) {
  const clusters: SubcontractorCluster[] = [];

  subcontractors.forEach((subcontractor) => {
    const existingCluster = clusters.find(
      (cluster) =>
        calculateMilesBetween(
          { lat: cluster.lat, lng: cluster.lng },
          subcontractor.location
        ) <= thresholdMiles
    );

    if (!existingCluster) {
      clusters.push({
        id: subcontractor.id,
        lat: subcontractor.location.lat,
        lng: subcontractor.location.lng,
        members: [subcontractor],
      });
      return;
    }

    existingCluster.members.push(subcontractor);
    existingCluster.lat =
      existingCluster.members.reduce((sum, item) => sum + item.location.lat, 0) /
      existingCluster.members.length;
    existingCluster.lng =
      existingCluster.members.reduce((sum, item) => sum + item.location.lng, 0) /
      existingCluster.members.length;
  });

  return clusters;
}

export function inferLocationFromQuery(query: string) {
  const normalizedQuery = query.toLowerCase();
  const stateMatch = query.match(/\b(GA|LA|MS|AL|AR|KS|MO|TN)\b/i)?.[1]?.toUpperCase();
  const cityMatch = KNOWN_CITY_COORDINATES.find(
    (coordinate) =>
      normalizedQuery.includes(coordinate.city.toLowerCase()) &&
      (!stateMatch || coordinate.state === stateMatch)
  );

  if (cityMatch) return cityMatch;

  if (stateMatch && stateMatch in STATE_FALLBACK_COORDINATES) {
    return STATE_FALLBACK_COORDINATES[stateMatch as OperationalState];
  }

  return undefined;
}

export function isOperationalState(value: string): value is OperationalState {
  return value in STATE_FALLBACK_COORDINATES;
}

export function normalizeStateCode(value?: string | null) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();

  const aliases: Record<string, string> = {
    alabama: "AL",
    arkansas: "AR",
    georgia: "GA",
    kansas: "KS",
    louisiana: "LA",
    mississippi: "MS",
    missouri: "MO",
    tennessee: "TN",
    texas: "TX",
  };
  return aliases[trimmed.toLowerCase()] ?? trimmed.toUpperCase().slice(0, 2);
}

export function resolveCoordinates(input: {
  city?: string | null;
  state?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
}) {
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  const city = String(input.city ?? "").trim();
  const state = normalizeStateCode(input.state);

  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)) {
    return { city: city || "Unknown", state: state || "LA", lat, lng };
  }

  const cityMatch = KNOWN_CITY_COORDINATES.find((coordinate) => {
    if (!city) return false;
    const sameCity = coordinate.city.toLowerCase() === city.toLowerCase();
    return sameCity && (!state || coordinate.state === state);
  });
  if (cityMatch) return { ...cityMatch };

  if (state && state in STATE_FALLBACK_COORDINATES) {
    const fallback = STATE_FALLBACK_COORDINATES[state as OperationalState];
    return { city: city || fallback.city, state, lat: fallback.lat, lng: fallback.lng };
  }

  if (state && US_STATE_CENTROIDS[state]) {
    const centroid = US_STATE_CENTROIDS[state];
    return { city: city || state, state, lat: centroid.lat, lng: centroid.lng };
  }

  return null;
}
