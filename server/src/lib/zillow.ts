const RAPIDAPI_HOST = "zillow-real-estate-api.p.rapidapi.com";
const BASE_URL = `https://${RAPIDAPI_HOST}`;

function getApiKey(): string {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY not set");
  return key;
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-rapidapi-host": RAPIDAPI_HOST,
    "x-rapidapi-key": getApiKey(),
  };
}

// ── Types ───────────────────────────────────────────────────

export interface ZillowListingResult {
  zpid: number;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  price: number;
  priceFormatted: string;
  beds: number;
  baths: number;
  sqft: number;
  homeType: string;
  status: string;
  daysOnZillow: number;
  imageUrl: string;
  detailUrl: string;
  zestimate: number | null;
  photos: string[];
}

export interface ZillowPropertyDetail {
  zpid: number;
  address: string;
  price: number;
  priceFormatted: string;
  beds: number;
  baths: number;
  sqft: number;
  lotSqft: number | null;
  homeType: string;
  yearBuilt: number | null;
  status: string;
  daysOnZillow: number;
  description: string | null;
  zestimate: number | null;
  rentZestimate: number | null;
  imageUrl: string;
  detailUrl: string;
  photos: string[];
  streetViewUrl: string | null;
  broker: string | null;
  mlsId: string | null;
  schools: Array<{ name: string; rating: number; distance: string; type: string }>;
}

// ── Search Listings ─────────────────────────────────────────

export interface SearchListingsParams {
  location: string;
  listingType?: "sale" | "rent";
  minPrice?: number;
  maxPrice?: number;
  bedsMin?: number;
  bathsMin?: number;
  homeType?: string;
  page?: number;
}

export async function searchListings(
  params: SearchListingsParams
): Promise<{ results: ZillowListingResult[]; totalPages: number }> {
  const url = new URL(`${BASE_URL}/v1/search`);
  const isRent = params.listingType === "rent";
  url.searchParams.set("location", params.location);
  url.searchParams.set("listing_type", isRent ? "rent" : "sale");
  if (isRent) url.searchParams.set("status", "FOR_RENT");
  url.searchParams.set("page", String(params.page ?? 1));

  if (params.minPrice) url.searchParams.set("min_price", String(params.minPrice));
  if (params.maxPrice) url.searchParams.set("max_price", String(params.maxPrice));
  if (params.bedsMin) url.searchParams.set("beds_min", String(params.bedsMin));
  if (params.bathsMin) url.searchParams.set("baths_min", String(params.bathsMin));
  if (params.homeType) url.searchParams.set("home_type", params.homeType);

  const response = await fetch(url.toString(), { headers: headers() });
  if (!response.ok) {
    throw new Error(`Zillow API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error("Zillow API returned unsuccessful response");
  }

  const results: ZillowListingResult[] = (data.data?.results ?? []).map(
    (r: any) => ({
      zpid: r.zpid ?? 0,
      address: r.address,
      city: r.city,
      state: r.state,
      zipcode: r.zipcode,
      price: r.price ?? 0,
      priceFormatted: r.price_formatted ?? (r.building_name || "See on Zillow"),
      beds: r.beds ?? 0,
      baths: r.baths ?? 0,
      sqft: r.sqft ?? 0,
      homeType: r.home_type ?? (r.is_building ? "APARTMENT" : ""),
      status: r.status,
      daysOnZillow: r.days_on_zillow ?? 0,
      imageUrl: r.image_url,
      detailUrl: r.detail_url,
      zestimate: r.zestimate,
      photos: (r.photos ?? []).slice(0, 10).map((p: any) => p.urls?.large ?? p.urls?.medium ?? "").filter(Boolean),
    })
  );

  return {
    results: results.slice(0, 10), // Limit to 10 for LLM context
    totalPages: data.data?.total_pages ?? 1,
  };
}

// ── Quick image fetch (minimal API call) ────────────────────

export async function getPropertyImage(zpid: number): Promise<string | null> {
  try {
    const url = `${BASE_URL}/v1/property/${zpid}`;
    const response = await fetch(url, { headers: headers() });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.success) return null;
    const d = data.data;
    return d.photos?.[0]?.urls?.medium ?? null;
  } catch {
    return null;
  }
}

// ── Property Detail ─────────────────────────────────────────

export async function getPropertyDetail(
  zpid: number
): Promise<ZillowPropertyDetail> {
  const url = `${BASE_URL}/v1/property/${zpid}`;
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) {
    throw new Error(`Zillow API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error("Zillow API returned unsuccessful response");
  }

  const d = data.data;
  return {
    zpid: d.zpid,
    address: d.address?.full ?? "",
    price: d.price,
    priceFormatted: d.price_formatted,
    beds: d.facts?.beds,
    baths: d.facts?.baths,
    sqft: d.facts?.sqft,
    lotSqft: d.facts?.lot_sqft ?? null,
    homeType: d.home_type,
    yearBuilt: d.year_built ?? null,
    status: d.status,
    daysOnZillow: d.days_on_zillow,
    description: d.description ?? null,
    zestimate: d.financials?.zestimate ?? null,
    rentZestimate: d.financials?.rent_zestimate ?? null,
    imageUrl: d.photos?.[0]?.urls?.large ?? "",
    detailUrl: d.detail_url ?? `https://www.zillow.com/homedetails/${zpid}_zpid/`,
    photos: (d.photos ?? []).slice(0, 5).map((p: any) => p.urls?.medium ?? "").filter(Boolean),
    streetViewUrl: d.street_view_url ?? null,
    broker: d.listing?.brokerage ?? null,
    mlsId: d.listing?.mls_id ?? null,
    schools: (d.schools ?? []).slice(0, 5).map((s: any) => ({
      name: s.name,
      rating: s.rating,
      distance: s.distance,
      type: s.type,
    })),
  };
}
