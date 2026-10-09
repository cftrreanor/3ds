import "server-only";

// Google Places API (New), called from our server so the API key never
// reaches the browser. Docs: https://developers.google.com/maps/documentation/places/web-service/op-overview

const BASE = "https://places.googleapis.com/v1";

export const isPlacesConfigured = Boolean(process.env.GOOGLE_MAPS_API_KEY);

export type PlaceSuggestion = { placeId: string; main: string; secondary: string };
export type PlaceDetails = {
  placeId: string;
  name: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
};

function headers(fieldMask?: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY ?? "",
    ...(fieldMask ? { "X-Goog-FieldMask": fieldMask } : {}),
  };
}

/**
 * Roughly where each US time zone is, so suggestions favor the host's own part
 * of the country (otherwise Google favors wherever our server runs). A bias,
 * not a limit: a place elsewhere still shows up when it's the best match.
 */
const ZONE_AREAS: Record<string, { low: [number, number]; high: [number, number] }> = {
  "America/New_York": { low: [24.5, -88.0], high: [47.5, -66.9] },
  "America/Chicago": { low: [25.8, -104.1], high: [49.4, -84.8] },
  "America/Denver": { low: [31.3, -117.2], high: [49.0, -100.5] },
  "America/Phoenix": { low: [31.3, -114.9], high: [37.0, -109.0] },
  "America/Los_Angeles": { low: [32.5, -124.8], high: [49.0, -114.0] },
  "America/Anchorage": { low: [51.2, -179.9], high: [71.4, -129.9] },
  "Pacific/Honolulu": { low: [18.9, -160.3], high: [22.3, -154.8] },
};

export async function autocomplete(input: string, sessionToken: string, timezone?: string): Promise<PlaceSuggestion[]> {
  const area = timezone ? ZONE_AREAS[timezone] : undefined;
  const request = (biased: boolean) =>
    fetch(`${BASE}/places:autocomplete`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        input,
        sessionToken,
        includedRegionCodes: ["us"],
        languageCode: "en",
        ...(biased &&
          area && {
            locationBias: {
              rectangle: {
                low: { latitude: area.low[0], longitude: area.low[1] },
                high: { latitude: area.high[0], longitude: area.high[1] },
              },
            },
          }),
      }),
      cache: "no-store",
    });
  let res = await request(true);
  // Never lose search over the area hint: if Google rejects it, ask again without.
  if (!res.ok && area && res.status === 400) {
    console.error("Places autocomplete rejected the area hint", await res.text());
    res = await request(false);
  }
  if (!res.ok) throw new Error(`Places autocomplete failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        text?: { text: string };
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
      };
    }[];
  };
  return (json.suggestions ?? []).flatMap(({ placePrediction: p }) =>
    p
      ? [
          {
            placeId: p.placeId,
            main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
            secondary: p.structuredFormat?.secondaryText?.text ?? "",
          },
        ]
      : [],
  );
}

export async function placeDetails(placeId: string, sessionToken: string): Promise<PlaceDetails> {
  const url = `${BASE}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const res = await fetch(url, {
    headers: headers("id,displayName,formattedAddress,location,types"),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Place details failed: ${res.status} ${await res.text()}`);
  const p = (await res.json()) as {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    types?: string[];
  };
  const address = p.formattedAddress ?? "";
  const name = p.displayName?.text ?? null;
  // A plain street address comes back with its own address as the "name";
  // only keep the name for real places like stadiums and schools.
  const isAddress = !name || address.startsWith(name) || (p.types ?? []).includes("street_address");
  return {
    placeId: p.id,
    name: isAddress ? null : name,
    address,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
  };
}
