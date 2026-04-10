const RAPIDAPI_HOST = "private-zillow.p.rapidapi.com";
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

// ── TTL Cache + In-flight Dedup ─────────────────────────────

const SEARCH_TTL = 5 * 60 * 1000;  // 5 min
const DETAIL_TTL = 10 * 60 * 1000; // 10 min
const CACHE_MAX_ENTRIES = 500;

type CacheEntry<T> = { data: T; expiresAt: number };

const searchCache = new Map<string, CacheEntry<{ results: ZillowListingResult[]; totalPages: number }>>();
const detailCache = new Map<string, CacheEntry<ZillowPropertyDetail>>();
const inFlightSearch = new Map<string, Promise<{ results: ZillowListingResult[]; totalPages: number }>>();
const inFlightDetail = new Map<string, Promise<ZillowPropertyDetail>>();

function getCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttl: number): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

// ── Retry with backoff ──────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 300;

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds > 0) return Math.min(seconds * 1000, 10000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    const delta = date - Date.now();
    return delta > 0 ? Math.min(delta, 10000) : null;
  }
  return null;
}

async function fetchWithRetry(url: string, opts: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, opts);
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const delayMs = BASE_DELAY_MS * (2 ** attempt) + Math.floor(Math.random() * 150);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt < MAX_RETRIES) {
        const delayMs = parseRetryAfter(response.headers.get("Retry-After"))
          ?? BASE_DELAY_MS * (2 ** attempt) + Math.floor(Math.random() * 150);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      if (response.status === 429) {
        throw new Error("RATE_LIMITED");
      }
    }

    return response;
  }
  throw new Error("RATE_LIMITED");
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
  features: string[];
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

  const cacheKey = url.toString();
  const cached = getCache(searchCache, cacheKey);
  if (cached) return cached;

  const existing = inFlightSearch.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const response = await fetchWithRetry(url.toString(), { headers: headers() });
    if (!response.ok) {
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
    setCache(searchCache, cacheKey, result, SEARCH_TTL);
    return result;
  })();

  inFlightSearch.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightSearch.delete(cacheKey);
  }
}

// ── Property Detail ─────────────────────────────────────────

export async function getPropertyDetail(
  zpid: number
): Promise<ZillowPropertyDetail> {
  const cacheKey = `detail:${zpid}`;
  const cached = getCache(detailCache, cacheKey);
  if (cached) return cached;

  const existing = inFlightDetail.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const url = `${BASE_URL}/pro/byzpid?zpid=${zpid}`;
    const response = await fetchWithRetry(url, { headers: headers() });
    if (!response.ok) {
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

  const rawFeatureCandidates: unknown[] = [
    ...(Array.isArray(d?.resoFacts?.atAGlanceFacts) ? d.resoFacts.atAGlanceFacts.map((item: any) => item?.factValue ?? item?.factLabel) : []),
    ...(Array.isArray(d?.resoFacts?.amenities) ? d.resoFacts.amenities : []),
    ...(Array.isArray(d?.resoFacts?.communityFeatures) ? d.resoFacts.communityFeatures : []),
    ...(Array.isArray(d?.resoFacts?.interiorFeatures) ? d.resoFacts.interiorFeatures : []),
    ...(Array.isArray(d?.resoFacts?.exteriorFeatures) ? d.resoFacts.exteriorFeatures : []),
  ];

  const features = Array.from(
    new Set(
      rawFeatureCandidates
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  ).slice(0, 8);

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
      features,
    };
    setCache(detailCache, cacheKey, detail, DETAIL_TTL);
    return detail;
  })();

  inFlightDetail.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightDetail.delete(cacheKey);
  }
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

// ── Zestimate History ──────────────────────────────────────

export interface ZestimateHistoryPoint {
  date: string;
  value: number;
}

export async function getZestimateHistory(zpid: number): Promise<ZestimateHistoryPoint[]> {
  const url = `${BASE_URL}/zestimateHistory?zpid=${zpid}`;
  const response = await fetchWithRetry(url, { headers: headers() });
  if (!response.ok) throw new Error(`Zillow API error: ${response.status}`);
  const data = await response.json();
  const points = Array.isArray(data) ? data : (data?.points ?? data?.data ?? []);
  return points
    .map((p: any) => ({
      date: p.x ?? p.date ?? "",
      value: p.y ?? p.value ?? 0,
    }))
    .filter((p: ZestimateHistoryPoint) => p.date && p.value > 0);
}

// ── Tax Assessment History ─────────────────────────────────

export interface TaxAssessment {
  year: number;
  value: number;
  taxPaid: number | null;
}

export async function getTaxHistory(zpid: number): Promise<TaxAssessment[]> {
  const url = `${BASE_URL}/taxAssessmentHistory?zpid=${zpid}`;
  const response = await fetchWithRetry(url, { headers: headers() });
  if (!response.ok) throw new Error(`Zillow API error: ${response.status}`);
  const data = await response.json();
  const items = Array.isArray(data) ? data : (data?.assessments ?? data?.data ?? []);
  return items
    .slice(0, 10)
    .map((t: any) => ({
      year: t.year ?? t.taxYear ?? 0,
      value: t.value ?? t.assessedValue ?? t.totalAssessedValue ?? 0,
      taxPaid: t.taxPaid ?? t.tax ?? null,
    }))
    .filter((t: TaxAssessment) => t.year > 0);
}

// ── Similar / Nearby Properties ────────────────────────────

export interface NearbyProperty {
  zpid: number;
  address: string;
  price: number;
  priceFormatted: string;
  beds: number;
  baths: number;
  sqft: number;
  imageUrl: string;
  homeType: string;
}

function mapNearbyItems(items: any[]): NearbyProperty[] {
  return items.slice(0, 8).map((item: any) => {
    const price = item.price ?? item.miniCardPhotos?.[0]?.price ?? 0;
    return {
      zpid: item.zpid ?? 0,
      address: item.address ?? item.streetAddress ?? [item.streetAddress, item.city, item.state].filter(Boolean).join(", "),
      price,
      priceFormatted: price > 0 ? formatPrice(price) : "N/A",
      beds: item.bedrooms ?? item.beds ?? 0,
      baths: item.bathrooms ?? item.baths ?? 0,
      sqft: item.livingArea ?? item.sqft ?? 0,
      imageUrl: item.miniCardPhotos?.[0]?.url ?? item.imgSrc ?? item.imageUrl ?? "",
      homeType: item.homeType ?? "",
    };
  }).filter((p: NearbyProperty) => p.zpid > 0);
}

export async function getSimilarProperties(zpid: number): Promise<NearbyProperty[]> {
  const url = `${BASE_URL}/similar_properties?zpid=${zpid}`;
  const response = await fetchWithRetry(url, { headers: headers() });
  if (!response.ok) throw new Error(`Zillow API error: ${response.status}`);
  const data = await response.json();
  const items = Array.isArray(data) ? data : (data?.properties ?? data?.results ?? data?.similarProperties ?? []);
  return mapNearbyItems(items);
}

export async function getNearbyProperties(zpid: number): Promise<NearbyProperty[]> {
  const url = `${BASE_URL}/nearby_properties?zpid=${zpid}`;
  const response = await fetchWithRetry(url, { headers: headers() });
  if (!response.ok) throw new Error(`Zillow API error: ${response.status}`);
  const data = await response.json();
  const items = Array.isArray(data) ? data : (data?.properties ?? data?.results ?? data?.nearbyProperties ?? []);
  return mapNearbyItems(items);
}
