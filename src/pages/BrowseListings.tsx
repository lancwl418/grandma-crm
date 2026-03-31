import React, { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Search, Home, Building2, Heart, BedDouble, Bath, Ruler, ChevronLeft, ChevronDown, Phone, MessageCircle, Send } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

// ── Types ──────────────────────────────────────────────────

interface Listing {
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
  statusText?: string | null;
  buildingName?: string | null;
  unitsAvailable?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
}

interface ListingDetail {
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
  broker: string | null;
  mlsId: string | null;
  schools: Array<{ name: string; rating: number; distance: string; type: string }>;
}

// ── Home Type labels ────────────────────────────────────────

const HOME_TYPE_LABELS: Record<string, string> = {
  SINGLE_FAMILY: "独栋",
  CONDO: "公寓",
  TOWNHOUSE: "联排",
  MULTI_FAMILY: "多户型",
  APARTMENT: "公寓楼",
};

const HOT_AREAS = [
  { name: "Irvine", label: "Irvine, CA" },
  { name: "Arcadia", label: "Arcadia, CA" },
  { name: "San Marino", label: "San Marino, CA" },
  { name: "Pasadena", label: "Pasadena, CA" },
  { name: "Chino Hills", label: "Chino Hills, CA" },
  { name: "Walnut", label: "Walnut, CA" },
  { name: "Diamond Bar", label: "Diamond Bar, CA" },
  { name: "Rowland Heights", label: "Rowland Heights, CA" },
];

const DEFAULT_BEDROOM_OPTIONS = [1, 2, 3, 4];

type PricePreset = { label: string; min: string; max: string };

const SALE_PRICE_PRESETS: PricePreset[] = [
  { label: "不限", min: "", max: "" },
  { label: "$500K 以下", min: "", max: "500000" },
  { label: "$500K - $1M", min: "500000", max: "1000000" },
  { label: "$1M - $2M", min: "1000000", max: "2000000" },
  { label: "$2M 以上", min: "2000000", max: "" },
];

const RENT_PRICE_PRESETS: PricePreset[] = [
  { label: "不限", min: "", max: "" },
  { label: "$2,000 以下", min: "", max: "2000" },
  { label: "$2,000 - $4,000", min: "2000", max: "4000" },
  { label: "$4,000 - $8,000", min: "4000", max: "8000" },
  { label: "$8,000 以上", min: "8000", max: "" },
];

function formatMoney(v: number, type: "sale" | "rent"): string {
  if (type === "rent") return `$${Math.round(v).toLocaleString()}`;
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}K`;
  return `$${Math.round(v)}`;
}

function normalizePriceBounds(rawBounds: number[], type: "sale" | "rent"): number[] {
  const step = type === "rent" ? 100 : 50000;
  const rounded = rawBounds.map((v) => Math.max(step, Math.round(v / step) * step));
  for (let i = 1; i < rounded.length; i += 1) {
    if (rounded[i] <= rounded[i - 1]) rounded[i] = rounded[i - 1] + step;
  }
  return rounded;
}

function getListingPriceRange(listing: Listing): { low: number; high: number } | null {
  const hasRange = typeof listing.minPrice === "number" && typeof listing.maxPrice === "number" && listing.maxPrice > 0;
  if (hasRange) {
    const low = Math.min(Number(listing.minPrice), Number(listing.maxPrice));
    const high = Math.max(Number(listing.minPrice), Number(listing.maxPrice));
    if (high > 0) return { low, high };
  }
  if (typeof listing.price === "number" && listing.price > 0) return { low: listing.price, high: listing.price };
  if (typeof listing.minPrice === "number" && listing.minPrice > 0) return { low: listing.minPrice, high: listing.minPrice };
  return null;
}

function buildDynamicPricePresets(items: Listing[], type: "sale" | "rent"): PricePreset[] {
  const fallback = type === "rent" ? RENT_PRICE_PRESETS : SALE_PRICE_PRESETS;
  const prices = items
    .map((i) => getListingPriceRange(i))
    .filter((r): r is { low: number; high: number } => !!r)
    .flatMap((r) => [r.low, (r.low + r.high) / 2, r.high])
    .filter((p) => p > 0)
    .sort((a, b) => a - b);
  if (prices.length < 6) return fallback;
  const at = (ratio: number) => prices[Math.min(prices.length - 1, Math.floor((prices.length - 1) * ratio))];
  const [p25, p50, p75] = normalizePriceBounds([at(0.25), at(0.5), at(0.75)], type);
  if (!(p25 < p50 && p50 < p75)) return fallback;
  return [
    { label: "不限", min: "", max: "" },
    { label: `${formatMoney(p25, type)} 以下`, min: "", max: String(p25) },
    { label: `${formatMoney(p25, type)} - ${formatMoney(p50, type)}`, min: String(p25), max: String(p50) },
    { label: `${formatMoney(p50, type)} - ${formatMoney(p75, type)}`, min: String(p50), max: String(p75) },
    { label: `${formatMoney(p75, type)} 以上`, min: String(p75), max: "" },
  ];
}

function buildDynamicTypeOptions(items: Listing[]): string[] {
  const unique = new Set<string>();
  for (const i of items) {
    const label = HOME_TYPE_LABELS[i.homeType] || i.homeType;
    if (label) unique.add(label);
  }
  return ["不限", ...Array.from(unique)];
}

function buildDynamicBedroomOptions(items: Listing[]): number[] {
  const values = new Set<number>();
  for (const i of items) {
    const beds = Number(i.beds || 0);
    if (beds > 0) values.add(Math.round(beds * 10) / 10);
  }
  const sorted = Array.from(values).sort((a, b) => a - b);
  return sorted.length > 0 ? sorted : DEFAULT_BEDROOM_OPTIONS;
}

function getListingTitle(listing: Listing): string {
  if (listing.buildingName) return listing.buildingName;
  if (!listing.address) return "房源";
  const firstChunk = listing.address.split(",")[0];
  return firstChunk || listing.address;
}

// ── Commercial types ──────────────────────────────────────

interface CommercialListing {
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

interface CommercialDetail {
  listingId: string;
  address: string;
  subtitle: string;
  location: string;
  listingType: string;
  carousel: string[];
  description: string;
  propertyFacts: Array<{ label: string; value: string }>;
  highlights: string[];
  broker: { name: string; company: string; photo: string } | null;
  loopnetUrl: string;
}

const COMMERCIAL_PROPERTY_TYPES: Record<string, string> = {
  office: "写字楼",
  industrial: "工业",
  retail: "零售",
  restaurant: "餐饮",
  multifamily: "多户住宅",
  land: "土地",
  hospitality: "酒店",
  shopping_center: "商场",
};

const COMMERCIAL_SORT_OPTIONS: Record<string, string> = {
  default: "默认",
  date_newest: "最新",
  price_asc: "价格低到高",
  price_desc: "价格高到低",
  building_size_desc: "面积大到小",
};

// ── Component ──────────────────────────────────────────────

export default function BrowseListings() {
  const { clientId } = useParams<{ clientId: string }>();

  // Category toggle
  const [category, setCategory] = useState<"residential" | "commercial">("residential");

  // Search state
  const [location, setLocation] = useState("");
  const [listingType, setListingType] = useState<"sale" | "rent">("sale");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [pricePresetIndex, setPricePresetIndex] = useState(0);
  const [typeIndex, setTypeIndex] = useState(0);
  const [selectedBedrooms, setSelectedBedrooms] = useState<number[]>([]);
  const [showBedroomPicker, setShowBedroomPicker] = useState(false);
  const [dynamicPricePresets, setDynamicPricePresets] = useState<PricePreset[]>(SALE_PRICE_PRESETS);
  const [dynamicTypeOptions, setDynamicTypeOptions] = useState<string[]>(["不限", "独栋", "公寓", "联排", "公寓楼"]);
  const [dynamicBedroomOptions, setDynamicBedroomOptions] = useState<number[]>(DEFAULT_BEDROOM_OPTIONS);

  // Results (allListings = full API response, listings = current page slice)
  const [sourceListings, setSourceListings] = useState<Listing[]>([]);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const PAGE_SIZE = 50;

  // Detail view
  const [selectedDetail, setSelectedDetail] = useState<ListingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Recently viewed (from tracking history)
  const [recentViews, setRecentViews] = useState<Listing[]>([]);

  // Agent info
  const [agentName, setAgentName] = useState("Your Agent");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentWechat, setAgentWechat] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentAvatar, setAgentAvatar] = useState("");
  const [agentTitle, setAgentTitle] = useState("");

  // Autocomplete
  const [suggestions, setSuggestions] = useState<Array<{ display: string; type: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const acTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback((query: string) => {
    if (acTimerRef.current) clearTimeout(acTimerRef.current);
    if (query.length < 2) { setSuggestions([]); return; }
    acTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/browse/autocomplete?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.results || []);
        setShowSuggestions(true);
      } catch { setSuggestions([]); }
    }, 300);
  }, []);

  // Commercial state
  const [commercialType, setCommercialType] = useState<"sale" | "lease">("sale");
  const [commercialCity, setCommercialCity] = useState("");
  const [commercialResults, setCommercialResults] = useState<CommercialListing[]>([]);
  const [commercialLoading, setCommercialLoading] = useState(false);
  const [commercialSearched, setCommercialSearched] = useState(false);
  const [commercialPage, setCommercialPage] = useState(1);
  const [commercialSuggestions, setCommercialSuggestions] = useState<Array<{ display: string; type: string; locationId: string; locationType: string }>>([]);
  const [showCommercialSuggestions, setShowCommercialSuggestions] = useState(false);
  const [commercialLocationId, setCommercialLocationId] = useState("");
  const [commercialLocationType, setCommercialLocationType] = useState("");
  const commercialAcRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Commercial filters
  const [commercialPropertyType, setCommercialPropertyType] = useState("");
  const [commercialSort, setCommercialSort] = useState("");
  const [commercialPriceMin, setCommercialPriceMin] = useState("");
  const [commercialPriceMax, setCommercialPriceMax] = useState("");

  // Commercial detail
  const [commercialDetail, setCommercialDetail] = useState<CommercialDetail | null>(null);
  const [commercialDetailLoading, setCommercialDetailLoading] = useState(false);

  const fetchCommercialSuggestions = useCallback((query: string) => {
    if (commercialAcRef.current) clearTimeout(commercialAcRef.current);
    if (query.length < 2) { setCommercialSuggestions([]); return; }
    commercialAcRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/browse/commercial/autocomplete?keyword=${encodeURIComponent(query)}`);
        const data = await res.json();
        setCommercialSuggestions(data.results || []);
        setShowCommercialSuggestions(true);
      } catch { setCommercialSuggestions([]); }
    }, 300);
  }, []);

  const searchCommercial = useCallback(async (city?: string, locId?: string, locType?: string) => {
    const q = city || commercialCity;
    if (!q.trim() && !locId && !commercialLocationId) return;
    if (city) setCommercialCity(city);
    if (locId) setCommercialLocationId(locId);
    if (locType) setCommercialLocationType(locType);
    setCommercialLoading(true);
    setCommercialSearched(true);
    setCommercialDetail(null);
    try {
      const params = new URLSearchParams({ type: commercialType, page: String(commercialPage) });
      const lid = locId || commercialLocationId;
      const lt = locType || commercialLocationType;
      if (lid) {
        params.set("locationId", lid);
        params.set("locationType", lt || "city");
      } else {
        params.set("city", q.trim());
      }
      if (commercialPropertyType) params.set("propertyType", commercialPropertyType);
      if (commercialSort) params.set("sort", commercialSort);
      if (commercialPriceMin) params.set("priceMin", commercialPriceMin);
      if (commercialPriceMax) params.set("priceMax", commercialPriceMax);
      const res = await fetch(`${API_BASE}/api/browse/commercial/search?${params}`);
      const data = await res.json();
      setCommercialResults(data.results || []);
    } catch {
      setCommercialResults([]);
    } finally {
      setCommercialLoading(false);
    }
  }, [commercialCity, commercialType, commercialPage, commercialLocationId, commercialLocationType, commercialPropertyType, commercialSort, commercialPriceMin, commercialPriceMax]);

  const viewCommercialDetail = useCallback(async (listing: CommercialListing) => {
    if (!listing.listingId) return;
    setCommercialDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/browse/commercial/detail/${listing.listingId}`);
      const data: CommercialDetail = await res.json();
      // Use search result photo as fallback
      if (data.carousel.length === 0 && listing.photo) {
        data.carousel = [listing.photo];
      }
      setCommercialDetail(data);
    } catch {
      // fallback: show basic info from listing
      setCommercialDetail({
        listingId: listing.listingId,
        address: listing.address,
        subtitle: [listing.availableSpace, listing.listingType, listing.price].filter(Boolean).join(" | "),
        location: `${listing.cityState} ${listing.postalCode}`,
        listingType: listing.listingType,
        carousel: listing.photo ? [listing.photo] : [],
        description: "",
        propertyFacts: [],
        highlights: [],
        broker: listing.brokerName ? { name: listing.brokerName, company: listing.companyName, photo: "" } : null,
        loopnetUrl: listing.loopnetUrl,
      });
    } finally {
      setCommercialDetailLoading(false);
    }
  }, []);

  // Auto re-search commercial when toggling sale/lease
  useEffect(() => {
    if (commercialSearched && commercialCity.trim()) {
      searchCommercial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commercialType]);

  // Contact panel
  const [contactOpen, setContactOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailBody, setEmailBody] = useState("");
  const [emailSubject, setEmailSubject] = useState("Property Inquiry");
  const [emailListingInfo, setEmailListingInfo] = useState<{ zpid: number; address: string; price: number; imageUrl: string } | null>(null);
  const [wechatCopied, setWechatCopied] = useState(false);

  // Verification — if clientId exists in URL, already verified
  const [verified, setVerified] = useState(!!clientId);
  const [clientName, setClientName] = useState("");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  // Load client name for greeting
  useEffect(() => {
    if (!clientId) return;
    fetch(`${API_BASE}/api/browse/client-name/${clientId}`)
      .then((res) => res.json())
      .then((data) => { if (data.name) setClientName(data.name); })
      .catch(() => {});
  }, [clientId]);

  // Load agent info on mount
  useEffect(() => {
    if (!clientId) return;
    fetch(`${API_BASE}/api/browse/agent/${clientId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.agentName) setAgentName(data.agentName);
        if (data.agentPhone) setAgentPhone(data.agentPhone);
        if (data.agentWechat) setAgentWechat(data.agentWechat);
        if (data.agentEmail) setAgentEmail(data.agentEmail);
        if (data.agentAvatar) setAgentAvatar(data.agentAvatar);
        if (data.agentTitle) setAgentTitle(data.agentTitle);
      })
      .catch(() => {});
  }, [clientId]);

  // Auto re-search when toggling Buy/Rent (if already searched)
  useEffect(() => {
    if (searched && location.trim()) {
      setPricePresetIndex(0);
      setTypeIndex(0);
      setSelectedBedrooms([]);
      handleSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingType]);

  // Load recent views on mount
  useEffect(() => {
    if (!clientId) return;
    fetch(`${API_BASE}/api/browse/history/${clientId}`)
      .then((res) => res.json())
      .then((data) => {
        const views = (data.views ?? []) as Array<{
          zpid: string; address: string; price: number; image_url: string | null; action: string;
        }>;
        // Restore favorites from history
        const favSet = new Set<number>();
        for (const v of views) {
          if (v.action === "favorite") favSet.add(Number(v.zpid));
        }
        setFavorites(favSet);

        // Deduplicate by zpid, take latest
        const seen = new Set<string>();
        const unique: Listing[] = [];
        for (const v of views) {
          if (seen.has(v.zpid)) continue;
          seen.add(v.zpid);
          unique.push({
            zpid: Number(v.zpid),
            address: v.address,
            city: "", state: "", zipcode: "",
            price: v.price,
            priceFormatted: v.price >= 1000000 ? `$${(v.price / 1000000).toFixed(1)}M` : `$${(v.price / 1000).toFixed(0)}K`,
            beds: 0, baths: 0, sqft: 0,
            homeType: "",
            status: v.action === "favorite" ? "FAVORITED" : "VIEWED",
            daysOnZillow: 0,
            imageUrl: v.image_url || "",
            detailUrl: "",
            zestimate: null,
            photos: v.image_url ? [v.image_url] : [],
          });
        }
        setRecentViews(unique.slice(0, 6));
      })
      .catch(() => {});
  }, [clientId]);

  // ── Search ────────────────────────────────────────────────

  const buildSearchParams = useCallback((loc: string, page = 1) => {
    const params = new URLSearchParams({ location: loc.trim() });
    params.set("listingType", listingType);
    if (page > 1) params.set("page", String(page));
    return params;
  }, [listingType]);

  const applyResidentialFilters = useCallback((
    items: Listing[],
    priceIdx: number,
    bedrooms: number[],
    typeIdx: number,
    type: "sale" | "rent",
    presetsOverride?: PricePreset[],
    typesOverride?: string[]
  ) => {
    const presets = presetsOverride || dynamicPricePresets;
    const typeOptions = typesOverride || dynamicTypeOptions;
    let filtered = [...items];

    const safeIdx = Math.max(0, Math.min(priceIdx, presets.length - 1));
    const preset = presets[safeIdx];
    const minP = preset?.min ? parseInt(preset.min, 10) : 0;
    const maxP = preset?.max ? parseInt(preset.max, 10) : 0;
    if (minP > 0 || maxP > 0) {
      filtered = filtered.filter((l) => {
        const range = getListingPriceRange(l);
        if (!range) return false;
        if (minP > 0 && maxP > 0) return range.low <= maxP && range.high >= minP;
        if (minP > 0) return range.high >= minP;
        return range.low <= maxP;
      });
    }

    if (bedrooms.length > 0) {
      filtered = filtered.filter((l) => {
        const beds = Math.round(Number(l.beds || 0) * 10) / 10;
        return bedrooms.some((v) => Math.abs(v - beds) < 0.01);
      });
    }

    const typeName = typeOptions[typeIdx] || "不限";
    if (typeName !== "不限") {
      filtered = filtered.filter((l) => (HOME_TYPE_LABELS[l.homeType] || l.homeType) === typeName);
    }

    const start = 0;
    setCurrentPage(1);
    setAllListings(filtered);
    setListings(filtered.slice(start, PAGE_SIZE));
    setTotalResults(filtered.length);
    setTotalPages(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  }, [dynamicPricePresets, dynamicTypeOptions]);

  const searchLocation = useCallback(async (loc: string) => {
    if (!loc.trim()) return;
    setLocation(loc);
    setLoading(true);
    setSearched(true);
    setSelectedDetail(null);
    setCurrentPage(1);
    try {
      const res = await fetch(`${API_BASE}/api/browse/search?${buildSearchParams(loc)}`);
      const data = await res.json();
      const source: Listing[] = data.results || [];
      setSourceListings(source);

      const nextPricePresets = buildDynamicPricePresets(source, listingType);
      const nextTypeOptions = buildDynamicTypeOptions(source);
      const nextBedroomOptions = buildDynamicBedroomOptions(source);
      setDynamicPricePresets(nextPricePresets);
      setDynamicTypeOptions(nextTypeOptions);
      setDynamicBedroomOptions(nextBedroomOptions);

      const safePrice = Math.min(pricePresetIndex, nextPricePresets.length - 1);
      const safeType = Math.min(typeIndex, nextTypeOptions.length - 1);
      const safeBedrooms = selectedBedrooms.filter((v) => nextBedroomOptions.some((o) => Math.abs(o - v) < 0.01));
      if (safePrice !== pricePresetIndex) setPricePresetIndex(safePrice);
      if (safeType !== typeIndex) setTypeIndex(safeType);
      if (safeBedrooms.length !== selectedBedrooms.length) setSelectedBedrooms(safeBedrooms);
      applyResidentialFilters(source, safePrice, safeBedrooms, safeType, listingType, nextPricePresets, nextTypeOptions);
    } catch {
      setSourceListings([]);
      setAllListings([]);
      setListings([]);
      setTotalResults(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [buildSearchParams, listingType, pricePresetIndex, selectedBedrooms, typeIndex, applyResidentialFilters]);

  const handleSearch = useCallback(async () => {
    if (!location.trim()) return;
    searchLocation(location);
  }, [location, searchLocation]);

  const refreshWithFilters = (nextPrice: number, nextBedrooms: number[], nextType: number) => {
    applyResidentialFilters(sourceListings, nextPrice, nextBedrooms, nextType, listingType);
  };

  const handleClearFilters = () => {
    setPricePresetIndex(0);
    setTypeIndex(0);
    setSelectedBedrooms([]);
    refreshWithFilters(0, [], 0);
  };

  const toggleBedroom = (value: number) => {
    const exists = selectedBedrooms.some((v) => Math.abs(v - value) < 0.01);
    const next = exists
      ? selectedBedrooms.filter((v) => Math.abs(v - value) >= 0.01)
      : [...selectedBedrooms, value].sort((a, b) => a - b);
    setSelectedBedrooms(next);
    refreshWithFilters(pricePresetIndex, next, typeIndex);
  };

  // Local pagination — slice allListings when page changes
  useEffect(() => {
    if (!searched || allListings.length === 0) return;
    const start = (currentPage - 1) * PAGE_SIZE;
    setListings(allListings.slice(start, start + PAGE_SIZE));
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [currentPage, allListings, searched]);

  // ── View Detail ───────────────────────────────────────────

  const viewDetail = useCallback(async (listing: Listing) => {
    // Track view
    if (clientId && (listing.zpid || listing.address)) {
      fetch(`${API_BASE}/api/browse/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          zpid: listing.zpid || listing.address,
          address: listing.address,
          price: listing.price,
          imageUrl: listing.imageUrl,
          action: "view",
        }),
      }).catch(() => {});
    }

    // Store listing info for email
    setEmailListingInfo({ zpid: listing.zpid, address: listing.address, price: listing.price, imageUrl: listing.imageUrl });

    // Rent listings or listings without zpid — use search data directly
    if (!listing.zpid) {
      setSelectedDetail({
        zpid: 0,
        address: listing.address,
        price: listing.price,
        priceFormatted: listing.priceFormatted,
        beds: listing.beds,
        baths: listing.baths,
        sqft: listing.sqft,
        lotSqft: null,
        homeType: listing.homeType,
        yearBuilt: null,
        status: listing.status,
        daysOnZillow: listing.daysOnZillow,
        description: null,
        zestimate: listing.zestimate,
        rentZestimate: null,
        imageUrl: listing.imageUrl,
        detailUrl: listing.detailUrl,
        photos: listing.photos.length > 0 ? listing.photos : listing.imageUrl ? [listing.imageUrl] : [],
        broker: null,
        mlsId: null,
        schools: [],
      });
      return;
    }

    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/browse/listing/${listing.zpid}`);
      const data = await res.json();
      // Use search result photos as fallback (detail API often has no photos)
      if (!data.photos || data.photos.length === 0) {
        data.photos = listing.photos.length > 0 ? listing.photos : listing.imageUrl ? [listing.imageUrl] : [];
        data.imageUrl = data.photos[0] || "";
      }
      setSelectedDetail(data);
    } catch {
      // fallback
    } finally {
      setDetailLoading(false);
    }
  }, [clientId]);

  // ── Favorite ──────────────────────────────────────────────

  const toggleFavorite = useCallback(async (listing: Listing) => {
    if (!verified) {
      // Show verify prompt handled by UI
      return false;
    }

    const isFav = favorites.has(listing.zpid);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(listing.zpid);
      else next.add(listing.zpid);
      return next;
    });

    if (!isFav && clientId) {
      fetch(`${API_BASE}/api/browse/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          zpid: listing.zpid,
          address: listing.address,
          price: listing.price,
          imageUrl: listing.imageUrl,
          action: "favorite",
        }),
      }).catch(() => {});
    }
    return true;
  }, [verified, favorites, clientId]);

  // ── Phone Verify ──────────────────────────────────────────

  const [showVerify, setShowVerify] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const handleVerify = useCallback(async () => {
    if (!phoneInput.trim() || !clientId) return;
    setVerifyError("");

    try {
      const res = await fetch(`${API_BASE}/api/browse/verify-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, phone: phoneInput.trim() }),
      });
      const data = await res.json();
      if (data.verified) {
        setVerified(true);
        setClientName(data.clientName);
        setShowVerify(false);
      } else {
        setVerifyError("电话号码不匹配 our records");
      }
    } catch {
      setVerifyError("验证失败，请重试");
    }
  }, [phoneInput, clientId]);

  // ── Detail View ───────────────────────────────────────────

  if (selectedDetail) {
    const heroImage = selectedDetail.photos[0] || selectedDetail.imageUrl;
    const pricePerSqft = selectedDetail.price > 0 && selectedDetail.sqft > 0
      ? Math.round(selectedDetail.price / selectedDetail.sqft)
      : null;
    return (
      <div className="min-h-screen bg-[#f3f2ef] pb-28">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            {heroImage ? (
              <img src={heroImage} alt={selectedDetail.address} className="w-full h-[380px] object-cover" />
            ) : (
              <div className="w-full h-[380px] bg-gray-300" />
            )}
            <div className="absolute inset-x-0 top-0 p-4 flex items-center justify-between">
              <button onClick={() => { setSelectedDetail(null); setEmailListingInfo(null); }} className="w-11 h-11 rounded-2xl bg-white/90 flex items-center justify-center">
                <ChevronLeft className="h-6 w-6 text-[#222]" />
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const zpid = selectedDetail.zpid || 0;
                    if (!verified && clientId) { setShowVerify(true); return; }
                    const isFav = favorites.has(zpid);
                    setFavorites((prev) => {
                      const next = new Set(prev);
                      if (isFav) next.delete(zpid); else next.add(zpid);
                      return next;
                    });
                    if (!isFav && clientId) {
                      fetch(`${API_BASE}/api/browse/track`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          clientId, zpid, address: selectedDetail.address, price: selectedDetail.price, imageUrl: selectedDetail.imageUrl, action: "favorite",
                        }),
                      }).catch(() => {});
                    }
                  }}
                  className="w-11 h-11 rounded-2xl bg-white/90 flex items-center justify-center"
                >
                  <Heart className={`h-6 w-6 ${favorites.has(selectedDetail.zpid || 0) ? "fill-red-500 text-red-500" : "text-[#222]"}`} />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const shareUrl = selectedDetail.detailUrl || window.location.href;
                    try { await navigator.clipboard.writeText(shareUrl); } catch {}
                  }}
                  className="w-11 h-11 rounded-2xl bg-white/90 flex items-center justify-center"
                >
                  <Send className="h-5 w-5 text-[#222]" />
                </button>
              </div>
            </div>
            <div className="absolute left-4 bottom-4 px-4 py-1.5 rounded-full bg-white/95 text-[#1e2224] text-base font-semibold tracking-widest">
              EXTERIOR • 01/{Math.max(selectedDetail.photos.length, 1).toString().padStart(2, "0")}
            </div>
          </div>

          <div className="px-5 pt-7 space-y-6">
            <section className="border-b border-[#e6e1d7] pb-6">
              <p className="text-[#7f6430] text-sm font-semibold tracking-[0.2em] uppercase">Bel Air Estate</p>
              <h1 className="text-[54px] leading-[1.03] font-semibold text-[#1a1f22] mt-2">{selectedDetail.address.split(",")[0] || "Luxury Residence"}</h1>
              <p className="text-[19px] text-[#4a4f53] mt-2">{selectedDetail.address}</p>
              <p className="text-[58px] leading-none text-[#1a1f22] mt-5 font-light">{selectedDetail.priceFormatted}</p>
              {pricePerSqft && <p className="text-[20px] tracking-[0.14em] text-[#504940] font-semibold mt-2">${pricePerSqft.toLocaleString()} / SQ FT</p>}
            </section>

            <section className="grid grid-cols-2 gap-4 border-b border-[#e6e1d7] pb-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#efeeeb] flex items-center justify-center text-[#7f6430]"><BedDouble className="h-6 w-6" /></div>
                <div><p className="text-4xl font-semibold text-[#1a1f22]">{selectedDetail.beds || "-"}</p><p className="text-sm tracking-[0.12em] text-[#4f4739] font-semibold uppercase">Bedrooms</p></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#efeeeb] flex items-center justify-center text-[#7f6430]"><Bath className="h-6 w-6" /></div>
                <div><p className="text-4xl font-semibold text-[#1a1f22]">{selectedDetail.baths || "-"}</p><p className="text-sm tracking-[0.12em] text-[#4f4739] font-semibold uppercase">Bathrooms</p></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#efeeeb] flex items-center justify-center text-[#7f6430]"><Ruler className="h-6 w-6" /></div>
                <div><p className="text-4xl font-semibold text-[#1a1f22]">{selectedDetail.sqft?.toLocaleString() || "-"}</p><p className="text-sm tracking-[0.12em] text-[#4f4739] font-semibold uppercase">SQ FT</p></div>
              </div>
            </section>

            {selectedDetail.description && (
              <section className="space-y-4">
                <p className="text-[#7f6430] text-sm font-semibold tracking-[0.2em] uppercase">The Obsidian Narrative</p>
                <p className="text-[18px] leading-relaxed text-[#4a4f53]">{selectedDetail.description}</p>
              </section>
            )}

            <section className="rounded-3xl bg-[#eeedea] p-6">
              <p className="text-[#7f6430] text-sm font-semibold tracking-[0.2em] uppercase mb-6">Exclusive Curations</p>
              <div className="grid grid-cols-2 gap-y-7">
                <div className="text-center"><p className="text-3xl">🏊</p><p className="mt-2 text-[#4f4739] font-semibold tracking-[0.1em] uppercase">Infinity Pool</p></div>
                <div className="text-center"><p className="text-3xl">🏛️</p><p className="mt-2 text-[#4f4739] font-semibold tracking-[0.1em] uppercase">Private Gallery</p></div>
                <div className="text-center"><p className="text-3xl">🎭</p><p className="mt-2 text-[#4f4739] font-semibold tracking-[0.1em] uppercase">Home Cinema</p></div>
                <div className="text-center"><p className="text-3xl">🍷</p><p className="mt-2 text-[#4f4739] font-semibold tracking-[0.1em] uppercase">Wine Cellar</p></div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[#7f6430] text-sm font-semibold tracking-[0.2em] uppercase">Location</p>
                <p className="text-[#4a4f53] text-xl">{selectedDetail.address.split(",").slice(1, 3).join(",").trim() || selectedDetail.address}</p>
              </div>
              <div className="rounded-3xl bg-[#d7d7d7] h-64 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center text-6xl">📍</div>
                <div className="absolute left-4 right-4 bottom-4 rounded-2xl bg-white/90 p-4">
                  <p className="text-[#7f6430] font-semibold tracking-[0.1em] uppercase">Signature Address</p>
                  <p className="text-sm text-[#4a4f53] mt-1">Minutes from Bel Air Country Club and major city amenities.</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-[#f7f6f3] p-6 space-y-4">
              <div className="flex items-center gap-4">
                {agentAvatar ? (
                  <img src={agentAvatar} alt={agentName} className="w-24 h-24 rounded-3xl object-cover" />
                ) : (
                  <div className="w-24 h-24 rounded-3xl bg-[#1f2427] text-white text-3xl flex items-center justify-center">{agentName[0]}</div>
                )}
                <div>
                  <p className="text-5xl font-semibold text-[#1a1f22] leading-none">{agentName}</p>
                  <p className="text-[#7f6430] mt-1 font-semibold tracking-[0.16em] uppercase text-sm">{agentTitle || "Principal Agent"}</p>
                  <p className="text-[#4a4f53] mt-1">{selectedDetail.broker || "Aurelian Luxe Properties"}</p>
                </div>
              </div>
              <button type="button" className="w-full h-14 rounded-2xl bg-[#a08344] text-white text-xl font-semibold tracking-[0.12em] uppercase">Schedule Private Tour</button>
              <button type="button" className="w-full h-14 rounded-2xl bg-[#ececea] text-[#1a1f22] text-xl font-semibold tracking-[0.12em] uppercase">Request Documents</button>
              <div className="pt-3 border-t border-[#ebe7df] grid grid-cols-3 gap-2 text-center">
                <a href={agentPhone ? `tel:${agentPhone}` : "#"} className="py-3 text-[#4f4739]"><Phone className="h-6 w-6 mx-auto" /><p className="mt-1 text-sm tracking-[0.1em] uppercase">Call</p></a>
                <button type="button" onClick={() => { setEmailSubject(`Inquiry: ${selectedDetail.address}`); setEmailBody(`Hi ${agentName},\n\nI'm interested in ${selectedDetail.address}`); setEmailOpen(true); }} className="py-3 text-[#4f4739]"><Send className="h-6 w-6 mx-auto" /><p className="mt-1 text-sm tracking-[0.1em] uppercase">Email</p></button>
                <button type="button" onClick={() => { if (agentWechat) navigator.clipboard.writeText(agentWechat); }} className="py-3 text-[#4f4739]"><MessageCircle className="h-6 w-6 mx-auto" /><p className="mt-1 text-sm tracking-[0.1em] uppercase">Wechat</p></button>
              </div>
            </section>

            {selectedDetail.schools.length > 0 && (
              <section className="rounded-3xl bg-[#f1f0ed] p-5">
                <p className="text-xl font-semibold text-[#1a1f22] mb-3">附近学校</p>
                <div className="space-y-3">
                  {selectedDetail.schools.map((s, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-[#e3dfd8] pb-2 last:border-0">
                      <div><p className="text-[#1a1f22]">{s.name}</p><p className="text-sm text-[#8f8880]">{s.distance} · {s.type}</p></div>
                      <span className="px-3 py-1 rounded-xl bg-[#d9f2df] text-[#1f3b2a] font-semibold">{s.rating}/10</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        <div className="fixed left-0 right-0 bottom-0 bg-white/95 border-t border-[#e2ddd3] p-3 z-30">
          {contactOpen && (
            <div className="max-w-2xl mx-auto mb-3 rounded-2xl border border-[#e6e1d7] bg-white p-3 space-y-2">
              {agentPhone && (
                <a href={`tel:${agentPhone}`} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f7f6f3]">
                  <Phone className="h-4 w-4 text-[#7f6430]" />
                  <span className="text-sm text-[#1a1f22]">电话：{agentPhone}</span>
                </a>
              )}
              {agentEmail && (
                <a
                  href={`mailto:${agentEmail}?subject=${encodeURIComponent(`Inquiry: ${selectedDetail.address}`)}&body=${encodeURIComponent(`Hi ${agentName},\n\nI'm interested in ${selectedDetail.address}`)}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f7f6f3]"
                >
                  <Send className="h-4 w-4 text-[#7f6430]" />
                  <span className="text-sm text-[#1a1f22]">邮箱：{agentEmail}</span>
                </a>
              )}
              {agentWechat && (
                <a
                  href={agentWechat.startsWith("http") ? agentWechat : `weixin://dl/chat?${encodeURIComponent(agentWechat)}`}
                  onClick={() => {
                    navigator.clipboard.writeText(agentWechat);
                    setWechatCopied(true);
                    setTimeout(() => setWechatCopied(false), 2000);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f7f6f3]"
                >
                  <MessageCircle className="h-4 w-4 text-[#7f6430]" />
                  <span className="text-sm text-[#1a1f22]">{wechatCopied ? "微信已复制" : `微信：${agentWechat}`}</span>
                </a>
              )}
            </div>
          )}
          <div className="max-w-2xl mx-auto">
            <button
              type="button"
              onClick={() => setContactOpen(!contactOpen)}
              className="w-full h-14 rounded-2xl bg-[#a08344] text-white font-semibold tracking-[0.08em]"
            >
              联系经纪人
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Search View ──────────────────────────────────────

  const bedroomChipText = selectedBedrooms.length === 0
    ? "几房"
    : (selectedBedrooms.length === 1 ? `${selectedBedrooms[0]}房` : `${selectedBedrooms.length}项`);
  const filterSummary = [
    `类型：${listingType === "rent" ? "租房" : "买房"}`,
    `价格：${dynamicPricePresets[pricePresetIndex]?.label || "不限"}`,
    `房型：${dynamicTypeOptions[typeIndex] || "不限"}`,
    `几房：${selectedBedrooms.length > 0 ? selectedBedrooms.map((v) => `${v}房`).join("、") : "不限"}`,
  ].join(" | ");

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-wide.png" alt="Estate Epic" className="h-10" />
          </div>
          {verified && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              Hi, {clientName}
            </span>
          )}
        </div>
      </div>

      {/* 客户页暂时固定住宅搜索，与 miniapp 保持一致 */}

      {/* Search Bar */}
      {category === "residential" ? (
      <div className="bg-[#f3f2ef] px-4 pt-5 pb-2 border-b border-[#e6e1d7] space-y-3">
        <h2 className="text-3xl font-medium text-[#1e2224]">房源搜索</h2>
        <div className="flex rounded-2xl overflow-hidden border border-[#d8d3ca]">
          <button
            type="button"
            onClick={() => setListingType("sale")}
            className={`flex-1 py-2.5 text-base ${listingType === "sale" ? "bg-[#7f6430] text-white font-semibold" : "bg-[#f8f6f2] text-[#5f5a50]"}`}
          >买房</button>
          <button
            type="button"
            onClick={() => setListingType("rent")}
            className={`flex-1 py-2.5 text-base ${listingType === "rent" ? "bg-[#7f6430] text-white font-semibold" : "bg-[#f8f6f2] text-[#5f5a50]"}`}
          >租房</button>
        </div>

        <div className="relative">
          <div className="h-12 bg-[#f8f6f2] border border-[#e3ded5] rounded-xl flex items-center px-3">
            <Search className="h-4 w-4 text-[#a39b8f] mr-2" />
            <input
              type="text"
              value={location}
              onChange={(e) => { setLocation(e.target.value); fetchSuggestions(e.target.value); }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onKeyDown={(e) => { if (e.key === "Enter") { setShowSuggestions(false); handleSearch(); } }}
              placeholder="按区域、小区或邮编搜索"
              className="flex-1 bg-transparent outline-none text-lg text-[#212425]"
            />
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-[#e2ddd3] shadow-lg z-20 overflow-hidden">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setLocation(s.display);
                    setShowSuggestions(false);
                    setSuggestions([]);
                    setTimeout(() => searchLocation(s.display), 0);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#f8f6f2] border-b border-[#f0ece6] last:border-0 flex items-center justify-between"
                >
                  <span className="text-sm text-[#25292c]">{s.display}</span>
                  <span className="text-xs text-[#9f9687]">{s.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {showSuggestions && <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />}

        <div className="flex gap-2 overflow-x-auto pb-1">
          <select
            value={location}
            onChange={(e) => {
              const val = e.target.value;
              if (val) searchLocation(val);
            }}
            className="min-w-[120px] h-10 rounded-xl border border-[#ddd7ce] bg-[#7f6430] text-white px-3 text-sm font-semibold"
          >
            <option value="">{location ? location.split(",")[0] : "区域"}</option>
            {HOT_AREAS.map((h) => <option key={h.label} value={h.label}>{h.label}</option>)}
          </select>

          <select
            value={pricePresetIndex}
            onChange={(e) => {
              const idx = Number(e.target.value);
              setPricePresetIndex(idx);
              refreshWithFilters(idx, selectedBedrooms, typeIndex);
            }}
            className="min-w-[140px] h-10 rounded-xl border border-[#ddd7ce] bg-[#f8f6f2] text-[#5f5a50] px-3 text-sm font-semibold"
          >
            {dynamicPricePresets.map((p, idx) => <option key={`${p.label}-${idx}`} value={idx}>{idx === 0 ? "价格区间" : p.label}</option>)}
          </select>

          <select
            value={typeIndex}
            onChange={(e) => {
              const idx = Number(e.target.value);
              setTypeIndex(idx);
              refreshWithFilters(pricePresetIndex, selectedBedrooms, idx);
            }}
            className="min-w-[120px] h-10 rounded-xl border border-[#ddd7ce] bg-[#f8f6f2] text-[#5f5a50] px-3 text-sm font-semibold"
          >
            {dynamicTypeOptions.map((t, idx) => <option key={`${t}-${idx}`} value={idx}>{idx === 0 ? "房源类型" : t}</option>)}
          </select>

          <button
            type="button"
            onClick={() => setShowBedroomPicker(true)}
            className="min-w-[96px] h-10 rounded-xl border border-[#ddd7ce] bg-[#f8f6f2] text-[#5f5a50] px-3 text-sm font-semibold"
          >
            {bedroomChipText}
          </button>
        </div>

        <div className="flex w-[220px] rounded-full overflow-hidden border border-[#d7d1c7]">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex-1 h-9 text-sm ${viewMode === "list" ? "bg-[#262626] text-white font-semibold" : "bg-[#f8f6f2] text-[#726a5d]"}`}
          >列表</button>
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={`flex-1 h-9 text-sm ${viewMode === "map" ? "bg-[#262626] text-white font-semibold" : "bg-[#f8f6f2] text-[#726a5d]"}`}
          >地图</button>
        </div>

        {searched && (
          <div className="pt-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#8a7f6c]">{totalResults} 套房源</span>
              {(pricePresetIndex > 0 || typeIndex > 0 || selectedBedrooms.length > 0) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="h-7 px-3 rounded-full border border-[#d4cab7] bg-[#f4eee2] text-xs text-[#7a633b] font-semibold"
                >清空筛选</button>
              )}
            </div>
            <p className="text-xs text-[#9c927f] mt-1">{filterSummary}</p>
          </div>
        )}
      </div>
      ) : (
      <div className="bg-white p-4 space-y-3 border-b">
        {/* Sale / Lease toggle */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
          <button
            type="button"
            onClick={() => setCommercialType("sale")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
              commercialType === "sale" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            出售
          </button>
          <button
            type="button"
            onClick={() => setCommercialType("lease")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
              commercialType === "lease" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            出租
          </button>
        </div>

        <div className="flex gap-2 relative">
          <div className="flex-1 relative">
            <input
              type="text"
              value={commercialCity}
              onChange={(e) => { setCommercialCity(e.target.value); fetchCommercialSuggestions(e.target.value); }}
              onFocus={() => commercialSuggestions.length > 0 && setShowCommercialSuggestions(true)}
              onKeyDown={(e) => { if (e.key === "Enter") { setShowCommercialSuggestions(false); searchCommercial(); } }}
              placeholder="输入城市名称..."
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {showCommercialSuggestions && commercialSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
                {commercialSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setCommercialCity(s.display);
                      setShowCommercialSuggestions(false);
                      setCommercialSuggestions([]);
                      setTimeout(() => searchCommercial(s.display, s.locationId, s.locationType), 0);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 active:bg-gray-100 border-b border-gray-50 last:border-0 flex items-center justify-between"
                  >
                    <span className="text-gray-900">{s.display}</span>
                    <span className="text-[10px] text-gray-400">{s.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => { setShowCommercialSuggestions(false); searchCommercial(); }}
            disabled={commercialLoading || !commercialCity.trim()}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl active:bg-indigo-700 transition disabled:bg-gray-300"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
        {showCommercialSuggestions && <div className="fixed inset-0 z-10" onClick={() => setShowCommercialSuggestions(false)} />}

        {/* Commercial Filters */}
        <div className="flex gap-2 overflow-x-auto">
          <select
            value={commercialPropertyType}
            onChange={(e) => setCommercialPropertyType(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white shrink-0"
          >
            <option value="">全部类型</option>
            {Object.entries(COMMERCIAL_PROPERTY_TYPES).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <div className="flex items-center border rounded-lg overflow-hidden shrink-0">
            <input
              type="number"
              value={commercialPriceMin}
              onChange={(e) => setCommercialPriceMin(e.target.value)}
              placeholder="最低价"
              className="w-20 px-2 py-1.5 text-xs text-gray-700 outline-none"
            />
            <span className="text-gray-300 text-xs">-</span>
            <input
              type="number"
              value={commercialPriceMax}
              onChange={(e) => setCommercialPriceMax(e.target.value)}
              placeholder="最高价"
              className="w-20 px-2 py-1.5 text-xs text-gray-700 outline-none"
            />
          </div>
          <select
            value={commercialSort}
            onChange={(e) => setCommercialSort(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white shrink-0"
          >
            {Object.entries(COMMERCIAL_SORT_OPTIONS).map(([val, label]) => (
              <option key={val} value={val === "default" ? "" : val}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      )}

      {/* Results */}
      {category === "residential" ? (
      <div className="p-4 space-y-4">
        {loading && <div className="text-center py-12 text-[#9f9688] text-sm">搜索中...</div>}

        {!loading && !searched && (
          <div>
            <h3 className="text-base font-semibold text-[#2b2f32] mb-3">热门区域</h3>
            <div className="grid grid-cols-2 gap-2">
              {HOT_AREAS.map((area) => (
                <button
                  key={area.label}
                  type="button"
                  onClick={() => searchLocation(area.label)}
                  className="rounded-xl border border-[#e1dbd0] bg-[#faf8f4] py-3 text-left px-3"
                >
                  <div className="text-sm font-semibold text-[#2c3033]">{area.name}</div>
                  <div className="text-xs text-[#a19787]">CA</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && searched && viewMode === "map" && (
          <div className="rounded-xl border border-dashed border-[#cabd9f] bg-[#f8f4ea] p-6">
            <p className="text-lg font-bold text-[#5b4c2f]">地图模式（即将上线）</p>
            <p className="text-sm text-[#7f7158] mt-2">后续在这里接入地图标注、聚合点和列表联动。</p>
          </div>
        )}

        {!loading && searched && viewMode === "list" && listings.length === 0 && (
          <div className="text-center py-12 text-[#9f9688] text-sm">暂无结果，请尝试其他区域或筛选条件。</div>
        )}

        {!loading && searched && viewMode === "list" && listings.map((listing, index) => (
          <div key={listing.zpid} className="bg-[#f7f5f0] rounded-xl border border-[#e0dbd2] overflow-hidden">
            <button type="button" onClick={() => viewDetail(listing)} className="w-full text-left">
              <div className="relative">
                {listing.imageUrl ? (
                  <img src={listing.imageUrl} alt={listing.address} className="w-full h-56 object-cover" />
                ) : (
                  <div className="w-full h-56 bg-gray-200 flex items-center justify-center text-gray-400"><Home className="h-8 w-8" /></div>
                )}
                <div className="absolute left-3 top-3 flex gap-2">
                  <span className="h-8 leading-8 px-3 rounded bg-[#7f6430] text-white text-xs font-bold tracking-widest">{index % 2 === 0 ? "精选" : "独家"}</span>
                  <span className="h-8 leading-8 px-3 rounded bg-black/70 text-white text-xs font-bold tracking-widest">{listingType === "rent" ? "出租" : "新上架"}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!verified) { setShowVerify(true); return; }
                    toggleFavorite(listing);
                  }}
                  className="absolute right-3 bottom-3 w-10 h-10 rounded-xl bg-black/60 border border-white/40 flex items-center justify-center"
                >
                  <Heart className={`h-4 w-4 ${favorites.has(listing.zpid) ? "fill-red-500 text-red-500" : "text-[#f4f3ee]"}`} />
                </button>
              </div>
              <div className="p-4">
                <p className="text-2xl font-medium text-[#1f2427] leading-tight">{getListingTitle(listing)}</p>
                <p className="text-sm text-[#4a4f53] mt-2">{listing.address}</p>
                <div className="text-xs text-[#8f8880] mt-2 space-x-1">
                  {listing.beds > 0 && <span>{listing.beds} 卧</span>}
                  {listing.baths > 0 && <span>• {listing.baths} 卫</span>}
                  {listing.sqft > 0 && <span>• {listing.sqft.toLocaleString()} 平方英尺</span>}
                </div>
                <p className="text-3xl text-[#7f6430] mt-3 font-medium">
                  {listing.buildingName && listing.price === 0
                    ? (listing.minPrice != null && listing.maxPrice != null ? `$${listing.minPrice.toLocaleString()} - $${listing.maxPrice.toLocaleString()}/月` : "")
                    : listing.priceFormatted}
                </p>
                <p className="text-xs text-[#8f8880] mt-1 tracking-wider">{HOME_TYPE_LABELS[listing.homeType] || listing.homeType}</p>
              </div>
            </button>
          </div>
        ))}
      </div>
      ) : (
      <div className="p-4 space-y-3">
        {/* Commercial Detail View */}
        {commercialDetail ? (
          <div className="space-y-4">
            {/* Back button */}
            <button
              type="button"
              onClick={() => setCommercialDetail(null)}
              className="flex items-center gap-1 text-sm text-indigo-600 active:text-indigo-800"
            >
              <ChevronLeft className="h-4 w-4" />
              返回搜索结果
            </button>

            {/* Photo carousel */}
            {commercialDetail.carousel.length > 0 ? (
              <div className="overflow-x-auto flex gap-1 rounded-xl overflow-hidden bg-gray-200">
                {commercialDetail.carousel.map((url, i) => (
                  <img key={i} src={url} alt={`Photo ${i + 1}`} className="h-56 sm:h-72 w-auto object-cover shrink-0" />
                ))}
              </div>
            ) : (
              <div className="h-56 bg-gray-200 rounded-xl flex items-center justify-center text-gray-400">
                <Building2 className="h-8 w-8" />
              </div>
            )}

            {/* Subtitle */}
            {commercialDetail.subtitle && (
              <div className="text-lg font-bold text-gray-900">{commercialDetail.subtitle}</div>
            )}

            {/* Address + location */}
            <div>
              <div className="text-base font-semibold text-gray-900">{commercialDetail.address}</div>
              {commercialDetail.location && (
                <p className="text-sm text-gray-500 mt-0.5">{commercialDetail.location}</p>
              )}
              {commercialDetail.listingType && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full">{commercialDetail.listingType}</span>
              )}
            </div>

            {/* Property facts */}
            {commercialDetail.propertyFacts.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">物业信息</h3>
                <div className="grid grid-cols-2 gap-2">
                  {commercialDetail.propertyFacts.map((fact, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-2.5">
                      <div className="text-[10px] text-gray-400">{fact.label}</div>
                      <div className="text-sm font-medium text-gray-900">{fact.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {commercialDetail.description && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">描述</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{commercialDetail.description}</p>
              </div>
            )}

            {/* Highlights */}
            {commercialDetail.highlights.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">亮点</h3>
                <ul className="space-y-1">
                  {commercialDetail.highlights.map((h, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-indigo-500 mt-1">&#8226;</span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Broker info */}
            {commercialDetail.broker && commercialDetail.broker.name && (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                {commercialDetail.broker.photo ? (
                  <img src={commercialDetail.broker.photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-bold">
                    {commercialDetail.broker.name[0]}
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-gray-900">{commercialDetail.broker.name}</div>
                  {commercialDetail.broker.company && (
                    <div className="text-xs text-gray-400">{commercialDetail.broker.company}</div>
                  )}
                </div>
              </div>
            )}

            {/* LoopNet link */}
            <a
              href={commercialDetail.loopnetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium text-center active:bg-indigo-700 transition"
            >
              在 LoopNet 上查看
            </a>
          </div>
        ) : (
        <>
        {commercialLoading && (
          <div className="text-center py-12 text-gray-400 text-sm">搜索中...</div>
        )}

        {!commercialLoading && commercialSearched && commercialResults.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">未找到商业地产，请尝试其他城市</div>
        )}

        {!commercialLoading && commercialSearched && commercialResults.length > 0 && (
          <div className="text-xs text-gray-400 px-1">
            找到 {commercialResults.length} 条商业地产结果
          </div>
        )}

        {/* Default: Popular Commercial Areas */}
        {!commercialLoading && !commercialSearched && (
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">热门商业区域</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: "Los Angeles", label: "Los Angeles" },
                { name: "New York", label: "New York" },
                { name: "San Francisco", label: "San Francisco" },
                { name: "Chicago", label: "Chicago" },
                { name: "Houston", label: "Houston" },
                { name: "Miami", label: "Miami" },
                { name: "Dallas", label: "Dallas" },
                { name: "Seattle", label: "Seattle" },
              ].map((area) => (
                <button
                  key={area.name}
                  type="button"
                  onClick={() => searchCommercial(area.label)}
                  className="flex items-center gap-2 px-3 py-3 bg-white rounded-xl border border-gray-100 active:bg-gray-50 transition"
                >
                  <Building2 className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm text-gray-800">{area.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {commercialResults.map((listing) => (
          <button
            key={listing.listingId}
            type="button"
            onClick={() => viewCommercialDetail(listing)}
            className="block w-full text-left bg-white rounded-xl border border-gray-100 overflow-hidden"
          >
            {listing.photo ? (
              <img src={listing.photo} alt={listing.title} className="w-full h-48 object-cover" />
            ) : (
              <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-400">
                <Building2 className="h-8 w-8" />
              </div>
            )}
            <div className="p-3">
              <div className="text-base font-bold text-gray-900">{listing.title}</div>
              <p className="text-sm text-gray-500 mt-0.5">{listing.cityState} {listing.postalCode}</p>
              {listing.price && (
                <div className="text-sm font-semibold text-indigo-700 mt-1">{listing.price}</div>
              )}
              {listing.availableSpace && (
                <div className="text-xs text-gray-500 mt-1">{listing.availableSpace}</div>
              )}
              <div className="text-xs text-gray-400 mt-1">{listing.listingType}</div>
              {(listing.brokerName || listing.companyName) && (
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                  <span>{listing.brokerName}</span>
                  {listing.brokerName && listing.companyName && <span>·</span>}
                  <span>{listing.companyName}</span>
                </div>
              )}
            </div>
          </button>
        ))}

        {/* Commercial pagination */}
        {commercialSearched && commercialResults.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-4">
            <button
              type="button"
              disabled={commercialPage <= 1 || commercialLoading}
              onClick={() => { setCommercialPage((p) => p - 1); setTimeout(() => searchCommercial(), 0); }}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white disabled:opacity-30 active:bg-gray-50"
            >
              上一页
            </button>
            <span className="text-sm text-gray-500">第 {commercialPage} 页</span>
            <button
              type="button"
              disabled={commercialLoading}
              onClick={() => { setCommercialPage((p) => p + 1); setTimeout(() => searchCommercial(), 0); }}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white disabled:opacity-30 active:bg-gray-50"
            >
              下一页
            </button>
          </div>
        )}
        </>
        )}
      </div>
      )}

      {showBedroomPicker && (
        <div className="fixed inset-0 bg-black/45 z-40 flex items-end" onClick={() => setShowBedroomPicker(false)}>
          <div className="w-full bg-white rounded-t-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-lg font-bold text-[#222] pb-3 border-b border-[#f1ece3]">选择几房（可多选）</p>
            <div className="max-h-[52vh] overflow-y-auto py-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedBedrooms([]);
                  refreshWithFilters(pricePresetIndex, [], typeIndex);
                }}
                className={`w-full h-11 rounded-xl border mb-2 ${selectedBedrooms.length === 0 ? "border-[#7f6430] bg-[#f5f0e6]" : "border-[#e5dfd3] bg-[#fbf9f5]"}`}
              >
                <span className="text-base font-semibold text-[#4f4739]">不限</span>
              </button>
              {dynamicBedroomOptions.map((value) => {
                const selected = selectedBedrooms.some((v) => Math.abs(v - value) < 0.01);
                return (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => toggleBedroom(value)}
                    className={`w-full h-11 rounded-xl border mb-2 ${selected ? "border-[#7f6430] bg-[#f5f0e6]" : "border-[#e5dfd3] bg-[#fbf9f5]"}`}
                  >
                    <span className="text-base font-semibold text-[#4f4739]">{value}房</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setShowBedroomPicker(false)}
              className="w-full h-11 rounded-xl bg-[#7f6430] text-white font-semibold"
            >
              完成
            </button>
          </div>
        </div>
      )}

      {/* Phone Verify Modal */}
      {showVerify && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setShowVerify(false)}
        >
          <div
            className="bg-white w-full sm:max-w-sm sm:rounded-xl rounded-t-2xl p-6 safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">验证身份</h3>
            <p className="text-sm text-gray-500 mb-4">
              请输入您经纪人记录的电话号码以保存收藏
            </p>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="电话号码"
              className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {verifyError && (
              <p className="text-xs text-red-500 mt-2">{verifyError}</p>
            )}
            <button
              onClick={handleVerify}
              disabled={!phoneInput.trim()}
              className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl font-medium active:bg-blue-700 transition disabled:bg-gray-300"
            >
              验证
            </button>
          </div>
        </div>
      )}

      {/* Detail loading overlay */}
      {(detailLoading || commercialDetailLoading) && (
        <div className="fixed inset-0 bg-white/80 z-50 flex items-center justify-center">
          <div className="text-gray-500 text-sm">加载中...</div>
        </div>
      )}

      {/* Agent contact bottom bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 safe-bottom">
        {/* Expanded contact panel */}
        {contactOpen && (
          <div className="bg-white border-t border-gray-200 px-4 py-3 space-y-2">
            {agentPhone && (
              <a href={`tel:${agentPhone}`} className="flex items-center gap-3 py-2.5 px-3 bg-green-50 rounded-xl active:bg-green-100 transition">
                <Phone className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">电话联系</p>
                  <p className="text-xs text-gray-400">{agentPhone}</p>
                </div>
              </a>
            )}
            {agentWechat && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(agentWechat);
                  setWechatCopied(true);
                  setTimeout(() => setWechatCopied(false), 2000);
                }}
                className="w-full flex items-center gap-3 py-2.5 px-3 bg-emerald-50 rounded-xl active:bg-emerald-100 transition"
              >
                <MessageCircle className="h-5 w-5 text-emerald-600" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900">{wechatCopied ? "已复制微信号" : "微信联系"}</p>
                  <p className="text-xs text-gray-400">{agentWechat}</p>
                </div>
              </button>
            )}
            {agentEmail && (
              <button
                type="button"
                onClick={() => {
                  if (emailListingInfo) {
                    setEmailBody(`Hi ${agentName},\n\nI'm interested in this property:\n${emailListingInfo.address}\nPrice: $${emailListingInfo.price.toLocaleString()}\n\nPlease contact me with more details.\n\nThank you!`);
                    setEmailSubject(`Inquiry: ${emailListingInfo.address}`);
                  } else {
                    setEmailBody(`Hi ${agentName},\n\nI'm looking for properties and would like to learn more.\n\nThank you!`);
                    setEmailSubject("Property Inquiry");
                  }
                  setEmailOpen(true);
                  setContactOpen(false);
                }}
                className="w-full flex items-center gap-3 py-2.5 px-3 bg-blue-50 rounded-xl active:bg-blue-100 transition"
              >
                <Send className="h-5 w-5 text-blue-600" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900">发送邮件</p>
                  <p className="text-xs text-gray-400">{agentEmail}</p>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Agent bar */}
        <button
          type="button"
          onClick={() => setContactOpen(!contactOpen)}
          className="w-full bg-white border-t border-gray-200 px-4 py-2.5 flex items-center justify-center gap-3"
        >
          {agentAvatar ? (
            <img src={agentAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {agentName[0]}
            </div>
          )}
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">{agentName}</p>
            {agentTitle && <p className="text-[10px] text-gray-400">{agentTitle}</p>}
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition ${contactOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Message modal */}
      {emailOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setEmailOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl p-5 safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 mb-1">联系 {agentName}</h3>
            <p className="text-xs text-gray-400 mb-3">留言将发送给您的经纪人</p>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={5}
              className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex flex-col gap-2 mt-3">
              {/* Primary: save to CRM */}
              <button
                type="button"
                onClick={async () => {
                  if (clientId && emailBody.trim()) {
                    await fetch(`${API_BASE}/api/browse/message`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        clientId,
                        message: emailBody.trim(),
                        listingAddress: emailListingInfo?.address,
                        listingPrice: emailListingInfo?.price,
                      }),
                    }).catch(() => {});
                    // Also track as inquiry
                    if (emailListingInfo) {
                      fetch(`${API_BASE}/api/browse/track`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          clientId,
                          zpid: emailListingInfo.zpid || emailListingInfo.address,
                          address: emailListingInfo.address,
                          price: emailListingInfo.price,
                          imageUrl: emailListingInfo.imageUrl,
                          action: "inquiry",
                        }),
                      }).catch(() => {});
                    }
                  }
                  setEmailOpen(false);
                  alert("留言已发送！经纪人会尽快联系您。");
                }}
                className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium active:bg-blue-700 transition"
              >
                发送留言
              </button>
              {/* Secondary: also send email */}
              {agentEmail && (
                <a
                  href={`mailto:${agentEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                  className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 text-center active:bg-gray-50 transition"
                >
                  同时发送邮件
                </a>
              )}
              <button
                type="button"
                onClick={() => setEmailOpen(false)}
                className="w-full py-2 text-xs text-gray-400"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close contact panel */}
      {contactOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setContactOpen(false)} />
      )}
    </div>
  );
}
