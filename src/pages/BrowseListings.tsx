import React, { useState, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Search, Home, Heart, BedDouble, Bath, Ruler, ChevronLeft, Phone } from "lucide-react";

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

// ── Component ──────────────────────────────────────────────

export default function BrowseListings() {
  const { clientId } = useParams<{ clientId: string }>();

  // Search state
  const [location, setLocation] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedsMin, setBedsMin] = useState("");
  const [homeType, setHomeType] = useState("");

  // Results
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Detail view
  const [selectedDetail, setSelectedDetail] = useState<ListingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Verification
  const [verified, setVerified] = useState(false);
  const [clientName, setClientName] = useState("");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  // ── Search ────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!location.trim()) return;
    setLoading(true);
    setSearched(true);
    setSelectedDetail(null);

    try {
      const params = new URLSearchParams({ location: location.trim() });
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (bedsMin) params.set("bedsMin", bedsMin);
      if (homeType) params.set("homeType", homeType);

      const res = await fetch(`${API_BASE}/api/browse/search?${params}`);
      const data = await res.json();
      setListings(data.results || []);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [location, maxPrice, bedsMin, homeType]);

  // ── View Detail ───────────────────────────────────────────

  const viewDetail = useCallback(async (listing: Listing) => {
    setDetailLoading(true);

    // Track view
    if (clientId) {
      fetch(`${API_BASE}/api/browse/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          zpid: listing.zpid,
          address: listing.address,
          price: listing.price,
          action: "view",
        }),
      }).catch(() => {});
    }

    try {
      const res = await fetch(`${API_BASE}/api/browse/listing/${listing.zpid}`);
      const data = await res.json();
      // Use search result image as fallback if detail has no photos
      if ((!data.photos || data.photos.length === 0) && listing.imageUrl) {
        data.photos = [listing.imageUrl];
        data.imageUrl = listing.imageUrl;
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
        setVerifyError("Phone number does not match our records");
      }
    } catch {
      setVerifyError("Verification failed, please try again");
    }
  }, [phoneInput, clientId]);

  // ── Detail View ───────────────────────────────────────────

  if (selectedDetail) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSelectedDetail(null)} className="p-1">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-medium truncate flex-1">{selectedDetail.address}</h1>
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
              No photos
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
            <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" /> {selectedDetail.beds} Beds</span>
            <span className="flex items-center gap-1"><Bath className="h-4 w-4" /> {selectedDetail.baths} Baths</span>
            <span className="flex items-center gap-1"><Ruler className="h-4 w-4" /> {selectedDetail.sqft?.toLocaleString()} sqft</span>
          </div>

          <div className="flex gap-3 text-xs text-gray-500">
            <span>{HOME_TYPE_LABELS[selectedDetail.homeType] || selectedDetail.homeType}</span>
            {selectedDetail.yearBuilt && <span>Built {selectedDetail.yearBuilt}</span>}
            <span>{selectedDetail.daysOnZillow} days on Zillow</span>
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

          {selectedDetail.description && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{selectedDetail.description}</p>
            </div>
          )}

          {selectedDetail.schools.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Schools</h3>
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
            <p className="text-xs text-gray-400">Listed by {selectedDetail.broker} · MLS# {selectedDetail.mlsId}</p>
          )}

          <a
            href={selectedDetail.detailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-3 bg-blue-600 text-white rounded-xl font-medium active:bg-blue-700 transition"
          >
            View on Zillow
          </a>
        </div>
      </div>
    );
  }

  // ── Main Search View ──────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-blue-600" />
            <h1 className="text-base font-bold text-gray-900">Find Your Home</h1>
          </div>
          {verified && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              Hi, {clientName}
            </span>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 space-y-3 border-b">
        <div className="flex gap-2">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="City, ZIP, or address..."
            className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !location.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl active:bg-blue-700 transition disabled:bg-gray-300"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto">
          <select
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white shrink-0"
          >
            <option value="">Max Price</option>
            <option value="500000">$500K</option>
            <option value="750000">$750K</option>
            <option value="1000000">$1M</option>
            <option value="1500000">$1.5M</option>
            <option value="2000000">$2M</option>
            <option value="3000000">$3M</option>
          </select>
          <select
            value={bedsMin}
            onChange={(e) => setBedsMin(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white shrink-0"
          >
            <option value="">Beds</option>
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
            <option value="">Type</option>
            <option value="SINGLE_FAMILY">Single Family</option>
            <option value="CONDO">Condo</option>
            <option value="TOWNHOUSE">Townhouse</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="p-4 space-y-3">
        {loading && (
          <div className="text-center py-12 text-gray-400 text-sm">Searching...</div>
        )}

        {!loading && searched && listings.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No listings found. Try a different location.</div>
        )}

        {!loading && !searched && (
          <div className="text-center py-16 text-gray-400 text-sm">
            Search for properties by city, ZIP code, or address
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
              <div className="text-lg font-bold text-gray-900">{listing.priceFormatted}</div>
              <div className="flex gap-3 text-xs text-gray-600 mt-1">
                <span>{listing.beds} bd</span>
                <span>{listing.baths} ba</span>
                <span>{listing.sqft?.toLocaleString()} sqft</span>
                <span>{HOME_TYPE_LABELS[listing.homeType] || listing.homeType}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1 truncate">{listing.address}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-400">{listing.daysOnZillow}d on Zillow</span>
                {listing.zestimate && (
                  <span className="text-[10px] text-blue-500">Zestimate ${listing.zestimate.toLocaleString()}</span>
                )}
              </div>
            </button>
          </div>
        ))}
      </div>

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
            <h3 className="text-lg font-bold text-gray-900 mb-2">Verify Your Identity</h3>
            <p className="text-sm text-gray-500 mb-4">
              Enter the phone number your agent has on file to save favorites.
            </p>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Phone number"
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
              Verify
            </button>
          </div>
        </div>
      )}

      {/* Detail loading overlay */}
      {detailLoading && (
        <div className="fixed inset-0 bg-white/80 z-50 flex items-center justify-center">
          <div className="text-gray-500 text-sm">Loading...</div>
        </div>
      )}
    </div>
  );
}
