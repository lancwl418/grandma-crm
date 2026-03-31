const RAPIDAPI_HOST = "private-zillow.p.rapidapi.com";
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// ── Simple TTL cache ────────────────────────────────────────
const cache = new Map<string, { data: unknown; expires: number }>();

function cacheGet<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function cacheSet(key: string, data: unknown, ttlMs: number): void {
  cache.set(key, { data, expires: Date.now() + ttlMs });
  // Lazy cleanup: cap size at 500 entries
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expires) cache.delete(k);
    }
  }
}

const SEARCH_TTL = 5 * 60 * 1000;  // 5 minutes
const DETAIL_TTL = 10 * 60 * 1000; // 10 minutes

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
  statusText: string | null;
  buildingName: string | null;
  unitsAvailable: number | null;
  daysOnZillow: number;
  imageUrl: string;
  detailUrl: string;
  zestimate: number | null;
  photos: string[];
  minPrice: number | null;
  maxPrice: number | null;
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

function formatPrice(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
}

export async function searchListings(
  params: SearchListingsParams
): Promise<{ results: ZillowListingResult[]; totalPages: number }> {
  const cacheKey = `search:${JSON.stringify(params)}`;
  const cached = cacheGet<{ results: ZillowListingResult[]; totalPages: number }>(cacheKey);
  if (cached) return cached;

  const isRent = params.listingType === "rent";
  const url = new URL(`${BASE_URL}/search/byaddress`);
  url.searchParams.set("location", params.location);
  url.searchParams.set("listingStatus", isRent ? "For_Rent" : "For_Sale");

  if (params.page && params.page > 1) url.searchParams.set("page", String(params.page));
  if (params.minPrice) url.searchParams.set("minPrice", String(params.minPrice));
  if (params.maxPrice) url.searchParams.set("maxPrice", String(params.maxPrice));
  if (params.bedsMin) url.searchParams.set("bedsMin", String(params.bedsMin));
  if (params.bathsMin) url.searchParams.set("bathsMin", String(params.bathsMin));
  if (params.homeType) url.searchParams.set("homeType", params.homeType);

  const response = await fetch(url.toString(), { headers: headers() });
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    throw new Error(`Zillow API error: ${response.status}`);
  }

  const data = await response.json();
  const searchResults = data.searchResults ?? [];

  const results: ZillowListingResult[] = searchResults.map((item: any) => {
    const r = item.property ?? item;
    const addr = r.address ?? {};
    const media = r.media ?? {};
    const allPhotos = media.allPropertyPhotos?.highResolution ?? [];
    const photoLink = media.propertyPhotoLinks?.highResolutionLink ?? media.propertyPhotoLinks?.mediumSizeLink ?? "";

    const price = r.price?.value ?? r.price ?? r.minPrice ?? 0;
    const priceNum = typeof price === "number" ? price : 0;

    return {
      zpid: r.zpid ?? 0,
      address: [addr.streetAddress, addr.city, addr.state, addr.zipcode].filter(Boolean).join(", "),
      city: addr.city ?? "",
      state: addr.state ?? "",
      zipcode: addr.zipcode ?? "",
      price: priceNum,
      priceFormatted: priceNum > 0 ? formatPrice(priceNum) : (r.title || "See on Zillow"),
      beds: r.bedrooms ?? 0,
      baths: r.bathrooms ?? 0,
      sqft: r.livingArea ?? 0,
      homeType: r.homeType ?? (r.groupType === "apartmentComplex" ? "APARTMENT" : ""),
      status: r.listingStatus === "forRent" ? "FOR_RENT" : "FOR_SALE",
      statusText: r.title ?? null,
      buildingName: r.title ?? null,
      unitsAvailable: r.matchingHomeCount ?? null,
      daysOnZillow: r.daysOnZillow ?? 0,
      imageUrl: photoLink || (allPhotos[0] ?? ""),
      detailUrl: `https://www.zillow.com/homedetails/${r.zpid}_zpid/`,
      zestimate: r.zestimate ?? null,
      photos: allPhotos.slice(0, 10),
      minPrice: r.minPrice ?? null,
      maxPrice: r.maxPrice ?? null,
    };
  });

  const result = {
    results,
    totalPages: data.pagesInfo?.totalPages ?? 1,
  };
  cacheSet(cacheKey, result, SEARCH_TTL);
  return result;
}

// ── Property Detail ─────────────────────────────────────────

export async function getPropertyDetail(
  zpid: number
): Promise<ZillowPropertyDetail> {
  const cacheKey = `detail:${zpid}`;
  const cached = cacheGet<ZillowPropertyDetail>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/pro/byzpid?zpid=${zpid}`;
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    throw new Error(`Zillow API error: ${response.status}`);
  }

  const data = await response.json();
  const d = data.propertyDetails ?? {};

  const photos = (d.originalPhotos ?? [])
    .slice(0, 15)
    .map((p: any) => {
      const jpegs = p.mixedSources?.jpeg ?? [];
      // Pick the largest jpeg
      const best = jpegs.reduce((a: any, b: any) => ((b.width ?? 0) > (a.width ?? 0) ? b : a), jpegs[0] ?? {});
      return best.url ?? "";
    })
    .filter(Boolean);

  const schools = (d.schools ?? []).slice(0, 5).map((s: any) => ({
    name: s.name ?? s.link?.text ?? "",
    rating: s.rating ?? 0,
    distance: s.distance ?? "",
    type: s.type ?? s.level ?? "",
  }));

  const detail: ZillowPropertyDetail = {
    zpid: d.zpid ?? zpid,
    address: [d.streetAddress, d.city, d.state, d.zipcode].filter(Boolean).join(", "),
    price: d.price ?? 0,
    priceFormatted: d.price ? formatPrice(d.price) : "N/A",
    beds: d.bedrooms ?? 0,
    baths: d.bathrooms ?? 0,
    sqft: d.livingArea ?? 0,
    lotSqft: d.lotSize ?? null,
    homeType: d.homeType ?? "",
    yearBuilt: d.yearBuilt ?? null,
    status: d.homeStatus ?? "",
    daysOnZillow: d.daysOnZillow ?? 0,
    description: d.description ?? null,
    zestimate: d.zestimate ?? null,
    rentZestimate: d.rentZestimate ?? null,
    imageUrl: d.hiResImageLink ?? photos[0] ?? "",
    detailUrl: data.zillowURL ?? `https://www.zillow.com/homedetails/${zpid}_zpid/`,
    photos,
    streetViewUrl: d.streetViewImageUrl ?? null,
    broker: d.brokerageName ?? d.attributionInfo?.brokerName ?? null,
    mlsId: d.attributionInfo?.mlsId ?? null,
    schools,
  };
  cacheSet(cacheKey, detail, DETAIL_TTL);
  return detail;
}

// ── Quick image fetch ───────────────────────────────────────

export async function getPropertyImage(zpid: number): Promise<string | null> {
  try {
    const detail = await getPropertyDetail(zpid);
    return detail.photos[0] ?? detail.imageUrl ?? null;
  } catch {
    return null;
  }
}
