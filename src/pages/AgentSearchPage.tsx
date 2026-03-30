import { useState, useCallback, useEffect, useContext, useRef } from "react";
import { Search, Home, Building2, BedDouble, Bath, Ruler, ChevronLeft, Share2, X, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { UserContext } from "@/lib/userContext";

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

interface ClientOption {
  id: string;
  remarkName: string;
  name: string | null;
}

const HOME_TYPE_LABELS: Record<string, string> = {
  SINGLE_FAMILY: "独栋",
  CONDO: "公寓",
  TOWNHOUSE: "联排",
  MULTI_FAMILY: "多户型",
  APARTMENT: "公寓楼",
};

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

export default function AgentSearchPage() {
  const userId = useContext(UserContext);

  // Category toggle: residential vs commercial
  const [category, setCategory] = useState<"residential" | "commercial">("residential");

  // Search state
  const [location, setLocation] = useState("");
  const [listingType, setListingType] = useState<"sale" | "rent">("sale");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedsMin, setBedsMin] = useState("");
  const [homeType, setHomeType] = useState("");

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

  // Results
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

  // Share modal
  const [shareTarget, setShareTarget] = useState<Listing | ListingDetail | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Commercial state
  const [commercialType, setCommercialType] = useState<"sale" | "lease">("sale");
  const [commercialCity, setCommercialCity] = useState("");
  const [commercialResults, setCommercialResults] = useState<CommercialListing[]>([]);
  const [commercialLoading, setCommercialLoading] = useState(false);
  const [commercialSearched, setCommercialSearched] = useState(false);
  const [commercialPage, setCommercialPage] = useState(1);
  const [commercialSuggestions, setCommercialSuggestions] = useState<Array<{ display: string; type: string; locationId?: string; locationType?: string }>>([]);
  const [showCommercialSuggestions, setShowCommercialSuggestions] = useState(false);
  const commercialAcRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [commercialLocationId, setCommercialLocationId] = useState("");
  const [commercialLocationType, setCommercialLocationType] = useState("");

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
      if (data.carousel.length === 0 && listing.photo) {
        data.carousel = [listing.photo];
      }
      setCommercialDetail(data);
    } catch {
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

  // Auto re-search when toggling Buy/Rent
  useEffect(() => {
    if (searched && location.trim()) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingType]);

  // ── Search ────────────────────────────────────────────────

  const buildSearchParams = useCallback((loc: string) => {
    const params = new URLSearchParams({ location: loc.trim() });
    params.set("listingType", listingType);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (bedsMin) params.set("bedsMin", bedsMin);
    if (homeType) params.set("homeType", homeType);
    return params;
  }, [listingType, minPrice, maxPrice, bedsMin, homeType]);

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
      const all = data.results || [];
      setAllListings(all);
      setListings(all.slice(0, PAGE_SIZE));
      setTotalResults(all.length);
      setTotalPages(Math.ceil(all.length / PAGE_SIZE));
    } catch {
      setAllListings([]);
      setListings([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }, [buildSearchParams]);

  const handleSearch = useCallback(async () => {
    if (!location.trim()) return;
    searchLocation(location);
  }, [location, searchLocation]);

  // Pagination
  useEffect(() => {
    if (!searched || allListings.length === 0) return;
    const start = (currentPage - 1) * PAGE_SIZE;
    setListings(allListings.slice(start, start + PAGE_SIZE));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage, allListings, searched]);

  // ── View Detail ───────────────────────────────────────────

  const viewDetail = useCallback(async (listing: Listing) => {
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
  }, []);

  // ── Share to Client ───────────────────────────────────────

  const openShareModal = useCallback(async (listing: Listing | ListingDetail) => {
    setShareTarget(listing);
    setCopied(false);

    if (!supabase || !userId) return;
    setClientsLoading(true);
    try {
      const { data } = await supabase
        .from("clients")
        .select("id, remark_name, name")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      setClients(
        (data ?? []).map((c: { id: string; remark_name: string; name: string | null }) => ({
          id: c.id,
          remarkName: c.remark_name,
          name: c.name,
        }))
      );
    } catch {
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  }, [userId]);

  const handleShareToClient = useCallback((client: ClientOption) => {
    if (!shareTarget) return;
    // Build the browse link for this client
    const browseUrl = `${window.location.origin}/browse/${client.id}`;
    navigator.clipboard.writeText(browseUrl).then(() => {
      setCopied(true);
      setTimeout(() => {
        setShareTarget(null);
        setCopied(false);
      }, 1500);
    }).catch(() => {
      // Fallback: select text
      window.prompt("复制链接:", browseUrl);
      setShareTarget(null);
    });
  }, [shareTarget]);

  // ── Detail View ───────────────────────────────────────────

  if (selectedDetail) {
    return (
      <div className="h-full w-full bg-gray-50 overflow-y-auto pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSelectedDetail(null)} className="p-1">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-medium truncate flex-1">{selectedDetail.address}</h1>
          <button
            onClick={() => openShareModal(selectedDetail)}
            className="p-2 text-blue-600 active:bg-blue-50 rounded-lg"
            title="分享给客户"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {/* Photos */}
        <div className="overflow-x-auto flex gap-1 bg-gray-200">
          {selectedDetail.photos.length > 0 ? (
            selectedDetail.photos.map((url, i) => (
              <img key={i} src={url} alt={`Photo ${i + 1}`} className="h-56 sm:h-72 w-auto object-cover shrink-0" />
            ))
          ) : (
            <div className="h-56 w-full bg-gray-200 flex items-center justify-center text-gray-400">
              暂无图片
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 space-y-4">
          <div>
            <div className="text-2xl font-bold text-gray-900">{selectedDetail.priceFormatted}</div>
            <p className="text-sm text-gray-500 mt-1">{selectedDetail.address}</p>
          </div>

          <div className="flex gap-4 text-sm text-gray-700">
            <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" /> {selectedDetail.beds} 卧</span>
            <span className="flex items-center gap-1"><Bath className="h-4 w-4" /> {selectedDetail.baths} 卫</span>
            <span className="flex items-center gap-1"><Ruler className="h-4 w-4" /> {selectedDetail.sqft?.toLocaleString()} sqft</span>
          </div>

          <div className="flex gap-3 text-xs text-gray-500">
            <span>{HOME_TYPE_LABELS[selectedDetail.homeType] || selectedDetail.homeType}</span>
            {selectedDetail.yearBuilt && <span>建于 {selectedDetail.yearBuilt}</span>}
            <span>上市 {selectedDetail.daysOnZillow} 天</span>
          </div>

          {selectedDetail.zestimate && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <span className="text-gray-600">Zestimate: </span>
              <span className="font-semibold text-blue-700">${selectedDetail.zestimate.toLocaleString()}</span>
              {selectedDetail.rentZestimate && (
                <span className="text-gray-500 ml-3">租金: ${selectedDetail.rentZestimate.toLocaleString()}/月</span>
              )}
            </div>
          )}

          <a href={selectedDetail.detailUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline">
            在 Zillow 上查看
          </a>

          {selectedDetail.description && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">描述</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{selectedDetail.description}</p>
            </div>
          )}

          {selectedDetail.schools.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">学校</h3>
              <div className="space-y-2">
                {selectedDetail.schools.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-gray-900">{s.name}</span>
                      <span className="text-gray-400 ml-2">{s.type} · {s.distance}</span>
                    </div>
                    <span className={`font-medium ${s.rating >= 8 ? "text-green-600" : s.rating >= 5 ? "text-yellow-600" : "text-gray-500"}`}>
                      {s.rating}/10
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedDetail.broker && (
            <p className="text-xs text-gray-400">上市: {selectedDetail.broker} · MLS# {selectedDetail.mlsId}</p>
          )}
        </div>

        {/* Share CTA */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 safe-bottom">
          <button
            type="button"
            onClick={() => openShareModal(selectedDetail)}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium active:bg-blue-700 transition text-base shadow-lg flex items-center justify-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            分享给客户
          </button>
        </div>

        {/* Share Modal */}
        {shareTarget && <ShareModal clients={clients} clientsLoading={clientsLoading} copied={copied} onSelect={handleShareToClient} onClose={() => setShareTarget(null)} />}
      </div>
    );
  }

  // ── Main Search View ──────────────────────────────────────

  return (
    <div className="h-full w-full bg-gray-50 overflow-y-auto pb-20">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-blue-600" />
          <h1 className="text-base font-bold text-gray-900">房源搜索</h1>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {category === "residential" ? "搜索 Zillow 房源并分享给客户" : "搜索 LoopNet 商业地产"}
        </p>
      </div>

      {/* Category Toggle: 住宅 | 商业地产 */}
      <div className="bg-white px-4 pt-3 pb-1 border-b">
        <div className="flex bg-indigo-50 rounded-lg p-0.5 w-fit">
          <button
            type="button"
            onClick={() => setCategory("residential")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${
              category === "residential" ? "bg-white text-indigo-700 shadow-sm" : "text-indigo-400"
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            住宅
          </button>
          <button
            type="button"
            onClick={() => setCategory("commercial")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${
              category === "commercial" ? "bg-white text-indigo-700 shadow-sm" : "text-indigo-400"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            商业地产
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {category === "residential" ? (
      <div className="bg-white p-4 space-y-3 border-b">
        {/* Buy / Rent toggle */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
          <button
            type="button"
            onClick={() => setListingType("sale")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
              listingType === "sale" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            买房
          </button>
          <button
            type="button"
            onClick={() => setListingType("rent")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
              listingType === "rent" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            租房
          </button>
        </div>

        <div className="flex gap-2 relative">
          <div className="flex-1 relative">
            <input
              type="text"
              value={location}
              onChange={(e) => { setLocation(e.target.value); fetchSuggestions(e.target.value); }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onKeyDown={(e) => { if (e.key === "Enter") { setShowSuggestions(false); handleSearch(); } }}
              placeholder="城市、邮编或地址..."
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
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
            onClick={() => { setShowSuggestions(false); handleSearch(); }}
            disabled={loading || !location.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl active:bg-blue-700 transition disabled:bg-gray-300"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
        {showSuggestions && <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />}

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto">
          <div className="flex items-center border rounded-lg overflow-hidden shrink-0">
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="最低价"
              className="w-20 px-2 py-1.5 text-xs text-gray-700 outline-none"
            />
            <span className="text-gray-300 text-xs">-</span>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="最高价"
              className="w-20 px-2 py-1.5 text-xs text-gray-700 outline-none"
            />
          </div>
          <select
            value={bedsMin}
            onChange={(e) => setBedsMin(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white shrink-0"
          >
            <option value="">卧室</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
            <option value="5">5+</option>
          </select>
          <select
            value={homeType}
            onChange={(e) => setHomeType(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white shrink-0"
          >
            <option value="">类型</option>
            <option value="SINGLE_FAMILY">独栋</option>
            <option value="CONDO">公寓</option>
            <option value="TOWNHOUSE">联排</option>
          </select>
        </div>
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
      <div className="p-4 space-y-3">
        {loading && (
          <div className="text-center py-12 text-gray-400 text-sm">搜索中...</div>
        )}

        {!loading && searched && totalResults > 0 && (
          <div className="flex items-center justify-between text-xs text-gray-400 px-1">
            <span>找到 {totalResults} 条结果</span>
            <span>显示 {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalResults)}</span>
          </div>
        )}

        {!loading && searched && listings.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">未找到房源，请尝试其他地区</div>
        )}

        {/* Default: Popular Areas */}
        {!loading && !searched && (
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">热门区域</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: "Irvine", label: "Irvine, CA" },
                { name: "Arcadia", label: "Arcadia, CA" },
                { name: "San Marino", label: "San Marino, CA" },
                { name: "Pasadena", label: "Pasadena, CA" },
                { name: "Rowland Heights", label: "Rowland Heights, CA" },
                { name: "Diamond Bar", label: "Diamond Bar, CA" },
                { name: "Chino Hills", label: "Chino Hills, CA" },
                { name: "Walnut", label: "Walnut, CA" },
              ].map((area) => (
                <button
                  key={area.name}
                  type="button"
                  onClick={() => searchLocation(area.label)}
                  className="flex items-center gap-2 px-3 py-3 bg-white rounded-xl border border-gray-100 active:bg-gray-50 transition"
                >
                  <Home className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-gray-800">{area.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {listings.map((listing) => (
          <div
            key={listing.zpid || listing.address}
            className="bg-white rounded-xl border border-gray-100 overflow-hidden"
          >
            {/* Image */}
            <button
              type="button"
              onClick={() => viewDetail(listing)}
              className="w-full relative"
            >
              {listing.imageUrl ? (
                <img src={listing.imageUrl} alt={listing.address} className="w-full h-48 object-cover" />
              ) : (
                <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-400">
                  <Home className="h-8 w-8" />
                </div>
              )}
              {/* Share button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openShareModal(listing);
                }}
                className="absolute top-3 right-3 p-2 bg-white/80 rounded-full active:bg-white"
                title="分享给客户"
              >
                <Share2 className="h-4 w-4 text-blue-600" />
              </button>
            </button>

            {/* Info */}
            <button
              type="button"
              onClick={() => viewDetail(listing)}
              className="w-full text-left p-3"
            >
              {listing.buildingName && listing.price === 0 ? (
                <>
                  <div className="text-base font-bold text-gray-900">{listing.buildingName}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {listing.minPrice && listing.maxPrice ? (
                      <span className="text-sm font-semibold text-green-700">${listing.minPrice.toLocaleString()} - ${listing.maxPrice.toLocaleString()}/月</span>
                    ) : listing.minPrice ? (
                      <span className="text-sm font-semibold text-green-700">起价 ${listing.minPrice.toLocaleString()}/月</span>
                    ) : null}
                    {listing.unitsAvailable && (
                      <span className="text-xs text-gray-400">{listing.unitsAvailable} 个单元</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-lg font-bold text-gray-900">{listing.priceFormatted}</div>
              )}
              <div className="flex gap-3 text-xs text-gray-600 mt-1">
                {listing.beds > 0 && <span>{listing.beds} 卧</span>}
                {listing.baths > 0 && <span>{listing.baths} 卫</span>}
                {listing.sqft > 0 && <span>{listing.sqft?.toLocaleString()} sqft</span>}
                <span>{HOME_TYPE_LABELS[listing.homeType] || listing.homeType}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1 truncate">{listing.address}</p>
              <div className="flex items-center justify-between mt-1">
                {listing.daysOnZillow > 0 && (
                  <span className="text-[10px] text-gray-400">上市 {listing.daysOnZillow} 天</span>
                )}
                {listing.zestimate && (
                  <span className="text-[10px] text-blue-500">Zestimate ${listing.zestimate.toLocaleString()}</span>
                )}
              </div>
            </button>
          </div>
        ))}

        {/* Pagination */}
        {searched && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-4">
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white disabled:opacity-30 active:bg-gray-50"
            >
              上一页
            </button>
            <span className="text-sm text-gray-500">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white disabled:opacity-30 active:bg-gray-50"
            >
              下一页
            </button>
          </div>
        )}
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

      {/* Share Modal */}
      {shareTarget && <ShareModal clients={clients} clientsLoading={clientsLoading} copied={copied} onSelect={handleShareToClient} onClose={() => setShareTarget(null)} />}

      {/* Detail loading overlay */}
      {(detailLoading || commercialDetailLoading) && (
        <div className="fixed inset-0 bg-white/80 z-50 flex items-center justify-center">
          <div className="text-gray-500 text-sm">加载中...</div>
        </div>
      )}
    </div>
  );
}

// ── Share Modal ─────────────────────────────────────────────

function ShareModal({
  clients,
  clientsLoading,
  copied,
  onSelect,
  onClose,
}: {
  clients: ClientOption[];
  clientsLoading: boolean;
  copied: boolean;
  onSelect: (client: ClientOption) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-sm sm:rounded-xl rounded-t-2xl safe-bottom max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h3 className="text-base font-bold text-gray-900">分享给客户</h3>
          <button onClick={onClose} className="p-1 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Copied toast */}
        {copied && (
          <div className="mx-4 mt-3 px-3 py-2 bg-green-50 text-green-700 text-sm rounded-lg flex items-center gap-1.5">
            <Check className="h-4 w-4" />
            浏览链接已复制到剪贴板
          </div>
        )}

        {/* Client list */}
        <div className="overflow-y-auto flex-1 p-4">
          {clientsLoading && (
            <div className="text-center py-6 text-gray-400 text-sm">加载客户列表...</div>
          )}

          {!clientsLoading && clients.length === 0 && (
            <div className="text-center py-6 text-gray-400 text-sm">暂无客户</div>
          )}

          <div className="space-y-2">
            {clients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => onSelect(client)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-gray-100 active:bg-gray-50 transition text-left"
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 shrink-0">
                  {(client.remarkName || client.name || "?")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {client.remarkName || client.name || "未命名客户"}
                  </p>
                </div>
                <Share2 className="h-4 w-4 text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pb-4 pt-2 border-t shrink-0">
          <p className="text-[10px] text-gray-400 text-center">
            选择客户后将复制专属浏览链接到剪贴板
          </p>
        </div>
      </div>
    </div>
  );
}
