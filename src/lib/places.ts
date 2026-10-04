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

export async function autocomplete(input: string, sessionToken: string): Promise<PlaceSuggestion[]> {
  const res = await fetch(`${BASE}/places:autocomplete`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ input, sessionToken, includedRegionCodes: ["us"], languageCode: "en" }),
    cache: "no-store",
  });
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
