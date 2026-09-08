/** WGS-84 geodesic distance (Vincenty inverse). Returns meters. */
export function geodesicMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const L = toRadians(b.lng - a.lng);
  if (lat1 === lat2 && L === 0) return 0;

  const ellipsoidA = 6378137;
  const ellipsoidF = 1 / 298.257223563;
  const ellipsoidB = 6356752.314245;

  const tanU1 = (1 - ellipsoidF) * Math.tan(lat1);
  const tanU2 = (1 - ellipsoidF) * Math.tan(lat2);
  const cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1);
  const sinU1 = tanU1 * cosU1;
  const cosU2 = 1 / Math.sqrt(1 + tanU2 * tanU2);
  const sinU2 = tanU2 * cosU2;

  let lambda = L;
  let lambdaP = 0;
  let cosSqAlpha = 0;
  let sinSigma = 0;
  let cosSigma = 0;
  let cos2SigmaM = 0;
  let sigma = 0;

  for (let i = 0; i < 100; i += 1) {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    const sinSqSigma =
      cosU2 * sinLambda * (cosU2 * sinLambda) +
      (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);
    sinSigma = Math.sqrt(sinSqSigma);
    if (sinSigma === 0) return 0;
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSqAlpha === 0 ? 0 : cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha;
    const c = ellipsoidF / 16 * cosSqAlpha * (2 + ellipsoidF * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda =
      L +
      (1 - c) *
        ellipsoidF *
        sinAlpha *
        (sigma + c * sinSigma * (cos2SigmaM + c * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    if (Math.abs(lambda - lambdaP) <= 1e-12) break;
  }

  const uSq = (cosSqAlpha * (ellipsoidA * ellipsoidA - ellipsoidB * ellipsoidB)) / (ellipsoidB * ellipsoidB);
  const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      B / 4 *
        (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
          B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));

  return ellipsoidB * A * (sigma - deltaSigma);
}

const FEET_PER_METER = 3.280839895;

export function geodesicFeet(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  return geodesicMeters(a, b) * FEET_PER_METER;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
