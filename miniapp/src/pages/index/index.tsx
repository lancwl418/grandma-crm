import { useState, useCallback, useRef } from "react";
import { View, Text, Input, ScrollView, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { searchListings, autocomplete, type Listing } from "@/utils/api";
import { getClientId } from "@/utils/auth";
import "./index.scss";

const HOME_TYPE_LABELS: Record<string, string> = {
  SINGLE_FAMILY: "独栋",
  CONDO: "公寓",
  TOWNHOUSE: "联排",
  MULTI_FAMILY: "多户型",
  APARTMENT: "公寓楼",
};

const HOT_AREAS = [
  { name: "Irvine", label: "Irvine, CA", emoji: "🏘️" },
  { name: "Arcadia", label: "Arcadia, CA", emoji: "🌳" },
  { name: "San Marino", label: "San Marino, CA", emoji: "🏛️" },
  { name: "Pasadena", label: "Pasadena, CA", emoji: "🌹" },
  { name: "Rowland Heights", label: "Rowland Heights, CA", emoji: "🏡" },
  { name: "Diamond Bar", label: "Diamond Bar, CA", emoji: "💎" },
  { name: "Chino Hills", label: "Chino Hills, CA", emoji: "⛰️" },
  { name: "Walnut", label: "Walnut, CA", emoji: "🌰" },
];

export default function IndexPage() {
  const [location, setLocation] = useState("");
  const [listingType, setListingType] = useState<"sale" | "rent">("sale");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ display: string; type: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const timerRef = useRef<any>(null);

  const clientId = getClientId();

  const doSearch = useCallback(async (loc: string) => {
    if (!loc.trim()) return;
    setLocation(loc);
    setLoading(true);
    setSearched(true);
    setShowSuggestions(false);

    try {
      const data = await searchListings({ location: loc, listingType });
      setListings(data.results || []);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [listingType]);

  const handleInput = (val: string) => {
    setLocation(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.length < 2) { setSuggestions([]); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const data = await autocomplete(val);
        setSuggestions(data.results || []);
        setShowSuggestions(true);
      } catch {}
    }, 300);
  };

  const goDetail = (listing: Listing) => {
    Taro.navigateTo({
      url: `/pages/detail/index?zpid=${listing.zpid}&address=${encodeURIComponent(listing.address)}&price=${listing.price}&imageUrl=${encodeURIComponent(listing.imageUrl || "")}&photos=${encodeURIComponent(JSON.stringify(listing.photos || []))}`,
    });
  };

  return (
    <View className="index-page">
      {/* Search */}
      <View className="search-bar">
        <View className="toggle">
          <Text className={`toggle-item ${listingType === "sale" ? "active" : ""}`} onClick={() => setListingType("sale")}>买房</Text>
          <Text className={`toggle-item ${listingType === "rent" ? "active" : ""}`} onClick={() => setListingType("rent")}>租房</Text>
        </View>

        <View className="search-input-wrap">
          <Input
            className="search-input"
            value={location}
            onInput={(e) => handleInput(e.detail.value)}
            onConfirm={() => doSearch(location)}
            placeholder="输入城市、邮编或地址..."
            confirmType="search"
          />
          <View className="search-btn" onClick={() => doSearch(location)}>搜索</View>
        </View>

        {/* Autocomplete */}
        {showSuggestions && suggestions.length > 0 && (
          <View className="suggestions">
            {suggestions.map((s, i) => (
              <View key={i} className="suggestion-item" onClick={() => { setShowSuggestions(false); doSearch(s.display); }}>
                <Text className="suggestion-text">{s.display}</Text>
                <Text className="suggestion-type">{s.type}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Results or Home */}
      <ScrollView scrollY className="content">
        {loading && <View className="empty-state"><Text>搜索中...</Text></View>}

        {!loading && !searched && (
          <View className="home-content">
            <Text className="section-title">热门地区</Text>
            <View className="hot-areas">
              {HOT_AREAS.map((area) => (
                <View key={area.name} className="area-item" onClick={() => doSearch(area.label)}>
                  <Text className="area-emoji">{area.emoji}</Text>
                  <Text className="area-name">{area.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {!loading && searched && listings.length === 0 && (
          <View className="empty-state"><Text>未找到房源，请尝试其他地区</Text></View>
        )}

        {listings.map((listing) => (
          <View key={listing.zpid || listing.address} className="listing-card" onClick={() => goDetail(listing)}>
            <Image className="listing-img" src={listing.imageUrl || ""} mode="aspectFill" lazyLoad />
            <View className="listing-info">
              {listing.buildingName && listing.price === 0 ? (
                <View>
                  <Text className="listing-name">{listing.buildingName}</Text>
                  {listing.minPrice && listing.maxPrice && (
                    <Text className="listing-rent">${listing.minPrice.toLocaleString()} - ${listing.maxPrice.toLocaleString()}/月</Text>
                  )}
                </View>
              ) : (
                <Text className="listing-price">{listing.priceFormatted}</Text>
              )}
              <View className="listing-meta">
                {listing.beds > 0 && <Text>{listing.beds}卧</Text>}
                {listing.baths > 0 && <Text>{listing.baths}卫</Text>}
                {listing.sqft > 0 && <Text>{listing.sqft.toLocaleString()}sqft</Text>}
                <Text>{HOME_TYPE_LABELS[listing.homeType] || listing.homeType}</Text>
              </View>
              <Text className="listing-address">{listing.address}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
