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

  return {
    results,
    totalPages: data.pagesInfo?.totalPages ?? 1,
  };
}

// ── Property Detail ─────────────────────────────────────────

export async function getPropertyDetail(
  zpid: number
): Promise<ZillowPropertyDetail> {
  const url = `${BASE_URL}/pro/byzpid?zpid=${zpid}`;
  const response = await fetch(url, { headers: headers() });
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

  return {
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
