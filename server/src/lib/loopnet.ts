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

export interface CommercialDetail {
  listingId: string;
  address: string;
  subtitle: string;
  location: string;
  listingType: string;
  carousel: string[];
  description: string;
  propertyFacts: Array<{ label: string; value: string }>;
  highlights: string[];
  broker: {
    name: string;
    company: string;
    photo: string;
  } | null;
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
  propertyType?: string | null;
  sort?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  buildingSizeMin?: number | null;
  buildingSizeMax?: number | null;
}): Promise<{ results: CommercialListing[] }> {
  const { type, page = 1 } = params;

  const endpoint =
    type === "lease"
      ? `${BASE_URL}/loopnet/lease/advanceSearch`
      : `${BASE_URL}/loopnet/sale/advanceSearch`;

  // API requires ALL params including nulls
  const body: Record<string, unknown> = {
    page,
    size: 20,
    locationId: params.locationId || null,
    locationType: params.locationType || null,
    propertyType: params.propertyType || null,
    sort: params.sort || null,
    priceMin: params.priceMin ?? null,
    priceMax: params.priceMax ?? null,
    buildingSizeMin: params.buildingSizeMin ?? null,
    buildingSizeMax: params.buildingSizeMax ?? null,
    propertyUseVacantOwnerOnly: null,
    propertyUseInvestmentOnly: null,
    condos: null,
    portfolios: null,
    businessForSale: null,
    lotSizeMin: null,
    lotSizeMax: null,
    roomsMin: null,
    roomsMax: null,
    capRateMin: null,
    capRateMax: null,
    yearBuiltMin: null,
    yearBuiltMax: null,
    dateEntered: null,
    auctions: false,
    excludePendingSales: null,
    tripleNetNNN: null,
    distressed: null,
    tenancySingle: null,
    tenancyMultiple: null,
  };

  // Fallback to city/state if no locationId
  if (!params.locationId && params.city) {
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

// ── Get commercial listing detail ───────────────────────────

export async function getCommercialDetail(listingId: string): Promise<CommercialDetail> {
  const res = await fetch(`${BASE_URL}/loopnet/property/ExtendedDetails`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ listingId }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[loopnet] detail error ${res.status}:`, text);
    throw new Error(`LoopNet detail API error: ${res.status}`);
  }

  const data = await res.json();

  // Parse carousel images
  const carousel: string[] = [];
  if (Array.isArray(data.carousel)) {
    for (const img of data.carousel) {
      if (typeof img === "string") carousel.push(img);
      else if (img?.url) carousel.push(img.url);
      else if (img?.src) carousel.push(img.src);
    }
  }

  // Parse property facts
  const propertyFacts: Array<{ label: string; value: string }> = [];
  if (Array.isArray(data.propertyFacts)) {
    for (const fact of data.propertyFacts) {
      if (fact?.label && fact?.value != null) {
        propertyFacts.push({ label: String(fact.label), value: String(fact.value) });
      }
    }
  } else if (data.propertyFacts && typeof data.propertyFacts === "object") {
    for (const [k, v] of Object.entries(data.propertyFacts)) {
      if (v != null) propertyFacts.push({ label: k, value: String(v) });
    }
  }

  // Parse highlights
  const highlights: string[] = [];
  if (Array.isArray(data.highlights)) {
    for (const h of data.highlights) {
      if (typeof h === "string") highlights.push(h);
      else if (h?.text) highlights.push(h.text);
    }
  }

  // Parse broker info
  let broker: CommercialDetail["broker"] = null;
  if (data.broker || data.brokerName) {
    const b = data.broker || {};
    broker = {
      name: b.name || data.brokerName || "",
      company: b.company || data.companyName || "",
      photo: b.photo || b.avatar || "",
    };
  }

  const loc = data.location || {};
  const titleArr: string[] = Array.isArray(data.title) ? data.title : [];

  return {
    listingId,
    address: loc.address || data.address || titleArr[0] || "",
    subtitle: data.subtitle || titleArr.join(" | ") || "",
    location: loc.cityState || data.cityState || titleArr[1] || "",
    listingType: data.listingType || "",
    carousel,
    description: data.description || "",
    propertyFacts,
    highlights,
    broker,
    loopnetUrl: `https://www.loopnet.com/Listing/${listingId}/`,
  };
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
