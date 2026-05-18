import type {
  KnownCityCoordinate,
  OperationalState,
  SubcontractorWrapSheet,
} from "./command-map-types";

export const KNOWN_CITY_COORDINATES: KnownCityCoordinate[] = [
  { city: "Atlanta", state: "GA", lat: 33.749, lng: -84.388 },
  { city: "Augusta", state: "GA", lat: 33.4735, lng: -82.0105 },
  { city: "Savannah", state: "GA", lat: 32.0809, lng: -81.0912 },
  { city: "New Orleans", state: "LA", lat: 29.9511, lng: -90.0715 },
  { city: "Baton Rouge", state: "LA", lat: 30.4515, lng: -91.1871 },
  { city: "Shreveport", state: "LA", lat: 32.5252, lng: -93.7502 },
  { city: "Jackson", state: "MS", lat: 32.2988, lng: -90.1848 },
  { city: "Gulfport", state: "MS", lat: 30.3674, lng: -89.0928 },
  { city: "Birmingham", state: "AL", lat: 33.5186, lng: -86.8104 },
  { city: "Mobile", state: "AL", lat: 30.6954, lng: -88.0399 },
  { city: "Little Rock", state: "AR", lat: 34.7465, lng: -92.2896 },
  { city: "Fayetteville", state: "AR", lat: 36.0626, lng: -94.1574 },
  { city: "Wichita", state: "KS", lat: 37.6872, lng: -97.3301 },
  { city: "Kansas City", state: "KS", lat: 39.1142, lng: -94.6275 },
  { city: "Kansas City", state: "MO", lat: 39.0997, lng: -94.5786 },
  { city: "Springfield", state: "MO", lat: 37.209, lng: -93.2923 },
  { city: "St. Louis", state: "MO", lat: 38.627, lng: -90.1994 },
  { city: "Nashville", state: "TN", lat: 36.1627, lng: -86.7816 },
  { city: "Chattanooga", state: "TN", lat: 35.0456, lng: -85.3097 },
  { city: "Memphis", state: "TN", lat: 35.1495, lng: -90.049 },
];

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
