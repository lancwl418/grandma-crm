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

// ── Component ──────────────────────────────────────────────

export default function BrowseListings() {
  const { clientId } = useParams<{ clientId: string }>();

  // Category toggle
  const [category, setCategory] = useState<"residential" | "commercial">("residential");

  // Search state
  const [location, setLocation] = useState("");
  const [listingType, setListingType] = useState<"sale" | "rent">("sale");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedsMin, set卧Min] = useState("");
  const [homeType, setHomeType] = useState("");

  // Results (allListings = full API response, listings = current page slice)
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
  const [commercialSuggestions, setCommercialSuggestions] = useState<Array<{ display: string; type: string }>>([]);
  const [showCommercialSuggestions, setShowCommercialSuggestions] = useState(false);
  const commercialAcRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const searchCommercial = useCallback(async (city?: string) => {
    const q = city || commercialCity;
    if (!q.trim()) return;
    setCommercialCity(q);
    setCommercialLoading(true);
    setCommercialSearched(true);
    try {
      const params = new URLSearchParams({ city: q.trim(), type: commercialType, page: String(commercialPage) });
      const res = await fetch(`${API_BASE}/api/browse/commercial/search?${params}`);
      const data = await res.json();
      setCommercialResults(data.results || []);
    } catch {
      setCommercialResults([]);
    } finally {
      setCommercialLoading(false);
    }
  }, [commercialCity, commercialType, commercialPage]);

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
      let all: Listing[] = data.results || [];

      // Client-side price filter (API doesn't support it)
      const min = minPrice ? Number(minPrice) : 0;
      const max = maxPrice ? Number(maxPrice) : Infinity;
      if (min > 0 || max < Infinity) {
        all = all.filter((l) => {
          const p = l.price || l.minPrice || 0;
          return p >= min && p <= max;
        });
      }

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
    return (
      <div className="min-h-screen bg-gray-50 pb-16">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => { setSelectedDetail(null); setEmailListingInfo(null); }} className="p-1">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-medium truncate flex-1">{selectedDetail.address}</h1>
          <button
            type="button"
            onClick={() => {
              const zpid = selectedDetail.zpid || 0;
              if (!verified && clientId) {
                setShowVerify(true);
                return;
              }
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
                    clientId, zpid, address: selectedDetail.address,
                    price: selectedDetail.price, imageUrl: selectedDetail.imageUrl, action: "favorite",
                  }),
                }).catch(() => {});
              }
            }}
            className="p-1.5"
          >
            <Heart className={`h-5 w-5 ${favorites.has(selectedDetail.zpid || 0) ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
          </button>
        </div>

        {/* Photos */}
        <div className="overflow-x-auto flex gap-1 bg-gray-200">
          {selectedDetail.photos.length > 0 ? (
            selectedDetail.photos.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Photo ${i + 1}`}
                className="h-56 sm:h-72 w-auto object-cover shrink-0"
              />
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
            <span>{selectedDetail.daysOnZillow} 天前上市</span>
          </div>

          {selectedDetail.zestimate && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <span className="text-gray-600">Zestimate: </span>
              <span className="font-semibold text-blue-700">${selectedDetail.zestimate.toLocaleString()}</span>
              {selectedDetail.rentZestimate && (
                <span className="text-gray-500 ml-3">Rent: ${selectedDetail.rentZestimate.toLocaleString()}/mo</span>
              )}
            </div>
          )}

          {/* Zillow link (small) */}
          <a
            href={selectedDetail.detailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 underline"
          >
            在 Zillow 查看 →
          </a>

          {selectedDetail.description && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">房屋描述</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{selectedDetail.description}</p>
            </div>
          )}

          {selectedDetail.schools.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">学区</h3>
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
            <p className="text-xs text-gray-400">经纪公司 {selectedDetail.broker} · MLS# {selectedDetail.mlsId}</p>
          )}

        </div>

        {/* Fixed bottom: contact agent */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-20">
          {/* Expanded contact options */}
          {contactOpen && (
            <div className="px-4 py-3 space-y-2 border-b border-gray-100">
              {agentPhone && (
                <a href={`tel:${agentPhone}`} className="flex items-center gap-3 py-2.5 px-3 bg-green-50 rounded-xl active:bg-green-100 transition">
                  <Phone className="h-5 w-5 text-green-600" />
                  <div className="flex-1"><p className="text-sm font-medium text-gray-900">电话联系</p><p className="text-xs text-gray-400">{agentPhone}</p></div>
                </a>
              )}
              {agentWechat && (
                <button type="button" onClick={() => { navigator.clipboard.writeText(agentWechat); setWechatCopied(true); setTimeout(() => setWechatCopied(false), 2000); }}
                  className="w-full flex items-center gap-3 py-2.5 px-3 bg-emerald-50 rounded-xl active:bg-emerald-100 transition">
                  <MessageCircle className="h-5 w-5 text-emerald-600" />
                  <div className="flex-1 text-left"><p className="text-sm font-medium text-gray-900">{wechatCopied ? "已复制微信号" : "微信联系"}</p><p className="text-xs text-gray-400">{agentWechat}</p></div>
                </button>
              )}
              {agentEmail && (
                <button type="button" onClick={() => {
                  setEmailListingInfo({ zpid: selectedDetail.zpid, address: selectedDetail.address, price: selectedDetail.price, imageUrl: selectedDetail.imageUrl });
                  setEmailBody(`Hi ${agentName},\n\nI'm interested in this property:\n${selectedDetail.address}\nPrice: ${selectedDetail.priceFormatted}\n\nPlease contact me with more details.\n\nThank you!`);
                  setEmailSubject(`Inquiry: ${selectedDetail.address}`);
                  setEmailOpen(true); setContactOpen(false);
                }} className="w-full flex items-center gap-3 py-2.5 px-3 bg-blue-50 rounded-xl active:bg-blue-100 transition">
                  <Send className="h-5 w-5 text-blue-600" />
                  <div className="flex-1 text-left"><p className="text-sm font-medium text-gray-900">发送留言</p><p className="text-xs text-gray-400">{agentEmail}</p></div>
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setContactOpen(!contactOpen)}
            className="w-full px-4 py-3 flex items-center justify-center gap-2 active:bg-gray-50"
          >
            {agentAvatar ? (
              <img src={agentAvatar} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">{agentName[0]}</div>
            )}
            <span className="text-sm font-medium text-green-700">联系经纪人 {agentName}</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition ${contactOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Click outside to close */}
        {contactOpen && <div className="fixed inset-0 z-10" onClick={() => setContactOpen(false)} />}
      </div>
    );
  }

  // ── Main Search View ──────────────────────────────────────

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
              placeholder="输入城市、邮编或地址..."
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
        {/* Click outside to close suggestions */}
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
            onChange={(e) => set卧Min(e.target.value)}
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
                      setTimeout(() => searchCommercial(s.display), 0);
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
            <span>{totalResults} 条结果</span>
            <span>显示 {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalResults)}</span>
          </div>
        )}

        {!loading && searched && listings.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">未找到房源，请尝试其他地区</div>
        )}

        {/* Home page: recently viewed + hot areas */}
        {!loading && !searched && (
          <div className="space-y-6">
            {/* 最近浏览 */}
            {recentViews.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">最近浏览</h3>
                <div className="grid grid-cols-2 gap-2">
                  {recentViews.map((listing) => (
                    <button
                      key={listing.zpid}
                      type="button"
                      onClick={() => viewDetail(listing)}
                      className="bg-white rounded-xl border border-gray-100 overflow-hidden text-left active:bg-gray-50"
                    >
                      {listing.imageUrl ? (
                        <img src={listing.imageUrl} alt="" className="w-full h-24 object-cover" />
                      ) : (
                        <div className="w-full h-24 bg-gray-100 flex items-center justify-center">
                          <Home className="h-6 w-6 text-gray-300" />
                        </div>
                      )}
                      <div className="p-2">
                        <p className="text-xs font-medium text-gray-900 truncate">{listing.priceFormatted}</p>
                        <p className="text-[10px] text-gray-500 truncate">{listing.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Hot Areas */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">热门地区</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: "Irvine", label: "Irvine, CA", emoji: "🏘️" },
                  { name: "Arcadia", label: "Arcadia, CA", emoji: "🌳" },
                  { name: "San Marino", label: "San Marino, CA", emoji: "🏛️" },
                  { name: "Pasadena", label: "Pasadena, CA", emoji: "🌹" },
                  { name: "Rowland Heights", label: "Rowland Heights, CA", emoji: "🏡" },
                  { name: "Diamond Bar", label: "Diamond Bar, CA", emoji: "💎" },
                  { name: "Chino Hills", label: "Chino Hills, CA", emoji: "⛰️" },
                  { name: "Walnut", label: "Walnut, CA", emoji: "🌰" },
                ].map((area) => (
                  <button
                    key={area.name}
                    type="button"
                    onClick={() => searchLocation(area.label)}
                    className="flex items-center gap-2 px-3 py-3 bg-white rounded-xl border border-gray-100 active:bg-gray-50 transition"
                  >
                    <span className="text-lg">{area.emoji}</span>
                    <span className="text-sm text-gray-800">{area.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {listings.map((listing) => (
          <div
            key={listing.zpid}
            className="bg-white rounded-xl border border-gray-100 overflow-hidden active:bg-gray-50 transition"
          >
            {/* Image */}
            <button
              type="button"
              onClick={() => viewDetail(listing)}
              className="w-full relative"
            >
              {listing.imageUrl ? (
                <img
                  src={listing.imageUrl}
                  alt={listing.address}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-400">
                  <Home className="h-8 w-8" />
                </div>
              )}
              {/* Favorite button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!verified) {
                    setShowVerify(true);
                    return;
                  }
                  toggleFavorite(listing);
                }}
                className="absolute top-3 right-3 p-2 bg-white/80 rounded-full"
              >
                <Heart
                  className={`h-4 w-4 ${favorites.has(listing.zpid) ? "fill-red-500 text-red-500" : "text-gray-600"}`}
                />
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
                      <span className="text-sm font-semibold text-green-700">${listing.minPrice.toLocaleString()} - ${listing.maxPrice.toLocaleString()}/mo</span>
                    ) : listing.minPrice ? (
                      <span className="text-sm font-semibold text-green-700">From ${listing.minPrice.toLocaleString()}/mo</span>
                    ) : null}
                    {listing.unitsAvailable && (
                      <span className="text-xs text-gray-400">{listing.unitsAvailable} units</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-lg font-bold text-gray-900">{listing.priceFormatted}</div>
              )}
              <div className="flex gap-3 text-xs text-gray-600 mt-1">
                {listing.beds > 0 && <span>{listing.beds} bd</span>}
                {listing.baths > 0 && <span>{listing.baths} ba</span>}
                {listing.sqft > 0 && <span>{listing.sqft?.toLocaleString()} sqft</span>}
                <span>{HOME_TYPE_LABELS[listing.homeType] || listing.homeType}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1 truncate">{listing.address}</p>
              <div className="flex items-center justify-between mt-1">
                {listing.daysOnZillow > 0 && (
                  <span className="text-[10px] text-gray-400">{listing.daysOnZillow}d on Zillow</span>
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
              onClick={() => { setCurrentPage((p) => p - 1); }}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white disabled:opacity-30 active:bg-gray-50"
            >
              上一页
            </button>
            <span className="text-sm text-gray-500">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages || loading}
              onClick={() => { setCurrentPage((p) => p + 1); }}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white disabled:opacity-30 active:bg-gray-50"
            >
              下一页
            </button>
          </div>
        )}
      </div>
      ) : (
      <div className="p-4 space-y-3">
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
          <a
            key={listing.listingId}
            href={listing.loopnetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white rounded-xl border border-gray-100 overflow-hidden"
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
          </a>
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
      {detailLoading && (
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
