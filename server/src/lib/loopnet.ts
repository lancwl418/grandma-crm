const LOOPNET_HOST = "loopnet-api.p.rapidapi.com";
const BASE_URL = `https://${LOOPNET_HOST}`;

function getApiKey(): string {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY not set");
  return key;
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-rapidapi-host": LOOPNET_HOST,
    "x-rapidapi-key": getApiKey(),
  };
}

// ── Types ───────────────────────────────────────────────────

export interface CommercialListing {
  listingId: string;
  title: string;
  address: string;
  cityState: string;
  postalCode: string;
  availableSpace: string;
  price: string | null;
  photo: string;
  brokerName: string;
  companyName: string;
  listingType: string;
  loopnetUrl: string;
}

// ── Search commercial listings ──────────────────────────────

export async function searchCommercial(params: {
  city?: string;
  state?: string;
  locationId?: string;
  locationType?: string;
  type: "sale" | "lease";
  page?: number;
}): Promise<{ results: CommercialListing[] }> {
  const { type, page = 1 } = params;

  const endpoint =
    type === "lease"
      ? `${BASE_URL}/loopnet/lease/advanceSearch`
      : `${BASE_URL}/loopnet/sale/advanceSearch`;

  const body: Record<string, unknown> = { page, size: 20 };

  // Use locationId if available (from autocomplete), otherwise city/state
  if (params.locationId) {
    body.locationId = params.locationId;
    body.locationType = params.locationType || "city";
  } else if (params.city) {
    body.city = params.city;
    if (params.state) body.state = params.state;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[loopnet] search error ${res.status}:`, text);
    return { results: [] };
  }

  const data = await res.json();
  const items: unknown[] = Array.isArray(data) ? data : data.data ?? data.results ?? [];

  const results: CommercialListing[] = items.map((item: any) => {
    const titleArr: string[] = Array.isArray(item.title) ? item.title : [];
    const loc = item.location || {};
    return {
      listingId: item.listingId || "",
      title: titleArr[0] || loc.address || "",
      address: loc.address || titleArr[0] || "",
      cityState: loc.cityState || titleArr[1] || "",
      postalCode: loc.postalCode || "",
      availableSpace: loc.availableSpace || "",
      price: item.fullPrice || item.price || null,
      photo: item.photo || "",
      brokerName: item.brokerName || "",
      companyName: item.companyName || "",
      listingType: item.listingType || "",
      loopnetUrl: item.listingId
        ? `https://www.loopnet.com/Listing/${item.listingId}/`
        : "",
    };
  });

  return { results };
}

// ── Autocomplete ────────────────────────────────────────────

export async function autocompleteCommercial(
  keyword: string
): Promise<Array<{ display: string; type: string; locationId: string; locationType: string }>> {
  const res = await fetch(`${BASE_URL}/loopnet/helper/autoComplete`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ keyword }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const items: unknown[] = Array.isArray(data) ? data : data.data ?? data.results ?? [];

  return items.slice(0, 6).map((item: any) => ({
    display: typeof item === "string" ? item : item.location || item.name || item.display || item.label || String(item),
    type: typeof item === "string" ? "location" : item.locationType || item.type || "location",
    locationId: String(item.locationId || ""),
    locationType: item.locationType || "city",
  }));
}
