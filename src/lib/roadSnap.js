/**
 * Snap raw GPS trail points onto driving roads via public OSRM Match.
 * Falls back to the original points when the network or match fails so the
 * map never goes blank.
 */

const OSRM_MATCH = 'https://router.project-osrm.org/match/v1/driving';
const CHUNK = 80;

const toLatLng = (coords) =>
  (coords || [])
    .map((c) => [Number(c[1]), Number(c[0])])
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

async function matchChunk(points) {
  if (!points || points.length < 2) return points || [];
  const path = points.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `${OSRM_MATCH}/${path}?overview=full&geometries=geojson&tidy=true&gaps=ignore`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`osrm_${res.status}`);
  const data = await res.json();
  const coords = data?.matchings?.[0]?.geometry?.coordinates;
  const snapped = toLatLng(coords);
  return snapped.length >= 2 ? snapped : points;
}

/**
 * @param {Array<[number, number]>} latLngPoints [[lat,lng], ...]
 * @returns {Promise<Array<[number, number]>>}
 */
export async function snapTrailToRoads(latLngPoints) {
  const clean = (latLngPoints || [])
    .map((p) => [Number(p[0]), Number(p[1])])
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180 && !(p[0] === 0 && p[1] === 0));

  if (clean.length < 2) return clean;

  // Deduplicate near-identical consecutive samples so OSRM Match stays stable.
  const deduped = [clean[0]];
  for (let i = 1; i < clean.length; i++) {
    const [aLat, aLng] = deduped[deduped.length - 1];
    const [bLat, bLng] = clean[i];
    if (Math.abs(aLat - bLat) > 0.00005 || Math.abs(aLng - bLng) > 0.00005) {
      deduped.push(clean[i]);
    }
  }
  if (deduped.length < 2) return clean;

  try {
    const snapped = [];
    for (let i = 0; i < deduped.length; i += CHUNK - 1) {
      const chunk = deduped.slice(i, i + CHUNK);
      if (chunk.length < 2) break;
      const part = await matchChunk(chunk).catch(() => null);
      if (part && part.length) {
        if (snapped.length) {
          snapped.push(...part.slice(1));
        } else {
          snapped.push(...part);
        }
      } else {
        snapped.push(...chunk);
      }
    }
    return snapped.length >= 2 ? snapped : clean;
  } catch {
    return clean;
  }
}
