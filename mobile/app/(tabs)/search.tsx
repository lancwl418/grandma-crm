import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Image,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Search,
  Home,
  Building2,
  BedDouble,
  Bath,
  Ruler,
  ChevronLeft,
  X,
} from "lucide-react-native";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || "https://grandma-crm.onrender.com";

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
  photos: string[];
  buildingName?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
}

const HOME_TYPE_LABELS: Record<string, string> = {
  SINGLE_FAMILY: "独栋",
  CONDO: "公寓",
  TOWNHOUSE: "联排",
  MULTI_FAMILY: "多户型",
  APARTMENT: "公寓楼",
};

const HOT_AREAS = [
  "Irvine, CA",
  "Arcadia, CA",
  "San Marino, CA",
  "Pasadena, CA",
  "Rowland Heights, CA",
  "Diamond Bar, CA",
  "Walnut, CA",
  "Temple City, CA",
];

export default function SearchPage() {
  const [mode, setMode] = useState<"buy" | "rent">("buy");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  const fetchSuggestions = useCallback(
    async (text: string) => {
      setQuery(text);
      if (text.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(
          `${API_BASE}/api/browse/autocomplete?q=${encodeURIComponent(text)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(
            (data.suggestions || []).slice(0, 5).map((s: any) => s.display || s)
          );
        }
      } catch {}
    },
    []
  );

  const doSearch = useCallback(
    async (location: string) => {
      setQuery(location);
      setSuggestions([]);
      setLoading(true);
      setSearched(true);
      try {
        const params = new URLSearchParams({
          location,
          status: mode === "rent" ? "forRent" : "forSale",
        });
        const res = await fetch(
          `${API_BASE}/api/browse/search?${params}`
        );
        if (res.ok) {
          const data = await res.json();
          setListings(data.listings || []);
        }
      } catch (err) {
        console.error("search error:", err);
      } finally {
        setLoading(false);
      }
    },
    [mode]
  );

  // Detail view
  if (selectedListing) {
    const l = selectedListing;
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.detailHeader}>
          <TouchableOpacity
            onPress={() => setSelectedListing(null)}
            style={s.backBtn}
          >
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={s.detailHeaderTitle} numberOfLines={1}>
            {l.address}
          </Text>
        </View>
        <ScrollView contentContainerStyle={s.detailContent}>
          {l.imageUrl ? (
            <Image
              source={{ uri: l.imageUrl }}
              style={s.detailImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[s.detailImage, s.placeholderImage]}>
              <Home size={40} color="#d1d5db" />
            </View>
          )}
          <View style={s.detailBody}>
            <Text style={s.detailPrice}>{l.priceFormatted}</Text>
            <Text style={s.detailAddress}>
              {l.address}, {l.city}, {l.state} {l.zipcode}
            </Text>
            <View style={s.detailSpecs}>
              <View style={s.specItem}>
                <BedDouble size={16} color="#6b7280" />
                <Text style={s.specText}>{l.beds} 卧</Text>
              </View>
              <View style={s.specItem}>
                <Bath size={16} color="#6b7280" />
                <Text style={s.specText}>{l.baths} 卫</Text>
              </View>
              <View style={s.specItem}>
                <Ruler size={16} color="#6b7280" />
                <Text style={s.specText}>
                  {l.sqft?.toLocaleString()} sqft
                </Text>
              </View>
            </View>
            <View style={s.detailMeta}>
              <Text style={s.metaLabel}>类型</Text>
              <Text style={s.metaValue}>
                {HOME_TYPE_LABELS[l.homeType] || l.homeType}
              </Text>
            </View>
            <View style={s.detailMeta}>
              <Text style={s.metaLabel}>状态</Text>
              <Text style={s.metaValue}>{l.status}</Text>
            </View>
            <View style={s.detailMeta}>
              <Text style={s.metaLabel}>上线天数</Text>
              <Text style={s.metaValue}>{l.daysOnZillow} 天</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.topBar}>
        <Text style={s.pageTitle}>房源搜索</Text>
        <View style={s.modeToggle}>
          <TouchableOpacity
            style={[s.modeBtn, mode === "buy" && s.modeBtnActive]}
            onPress={() => setMode("buy")}
          >
            <Text
              style={[
                s.modeBtnText,
                mode === "buy" && s.modeBtnTextActive,
              ]}
            >
              买房
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeBtn, mode === "rent" && s.modeBtnActive]}
            onPress={() => setMode("rent")}
          >
            <Text
              style={[
                s.modeBtnText,
                mode === "rent" && s.modeBtnTextActive,
              ]}
            >
              租房
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input */}
      <View style={s.searchBox}>
        <Search size={16} color="#9ca3af" />
        <TextInput
          style={s.searchInput}
          placeholder="输入城市、邮编或地址"
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={fetchSuggestions}
          onSubmitEditing={() => query.trim() && doSearch(query.trim())}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery("");
              setSuggestions([]);
            }}
          >
            <X size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <View style={s.suggestions}>
          {suggestions.map((sug, i) => (
            <TouchableOpacity
              key={i}
              style={s.suggestionItem}
              onPress={() => doSearch(sug)}
            >
              <Search size={14} color="#9ca3af" />
              <Text style={s.suggestionText}>{sug}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={s.loadingText}>搜索中...</Text>
        </View>
      ) : !searched ? (
        <ScrollView contentContainerStyle={s.hotAreas}>
          <Text style={s.hotTitle}>热门区域</Text>
          <View style={s.hotGrid}>
            {HOT_AREAS.map((area) => (
              <TouchableOpacity
                key={area}
                style={s.hotChip}
                onPress={() => doSearch(area)}
              >
                <Text style={s.hotChipText}>{area}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : listings.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>未找到房源</Text>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => String(item.zpid)}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.listingCard}
              onPress={() => setSelectedListing(item)}
              activeOpacity={0.7}
            >
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={s.listingImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[s.listingImage, s.placeholderImage]}>
                  <Home size={24} color="#d1d5db" />
                </View>
              )}
              <View style={s.listingInfo}>
                <Text style={s.listingPrice}>
                  {item.buildingName || item.priceFormatted}
                </Text>
                {item.buildingName && (
                  <Text style={s.listingSubPrice}>
                    {item.minPrice && item.maxPrice
                      ? `$${(item.minPrice / 1000).toFixed(0)}K - $${(item.maxPrice / 1000).toFixed(0)}K`
                      : item.priceFormatted}
                  </Text>
                )}
                <Text style={s.listingAddress} numberOfLines={1}>
                  {item.address}, {item.city}
                </Text>
                <View style={s.listingSpecs}>
                  <Text style={s.specSmall}>
                    {item.beds}卧 · {item.baths}卫 ·{" "}
                    {item.sqft?.toLocaleString()}sqft
                  </Text>
                </View>
                <Text style={s.listingType}>
                  {HOME_TYPE_LABELS[item.homeType] || item.homeType}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  pageTitle: { fontSize: 22, fontWeight: "700", color: "#111827" },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 2,
  },
  modeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modeBtnActive: { backgroundColor: "#1e293b" },
  modeBtnText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  modeBtnTextActive: { color: "#fff" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },
  suggestions: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    marginTop: 4,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
  },
  suggestionText: { fontSize: 14, color: "#374151" },
  loadingText: { fontSize: 14, color: "#6b7280", marginTop: 8 },
  hotAreas: { padding: 16 },
  hotTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  hotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  hotChip: {
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  hotChipText: { fontSize: 13, color: "#374151" },
  emptyText: { fontSize: 14, color: "#9ca3af" },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  listingCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
    marginBottom: 10,
  },
  listingImage: {
    width: "100%",
    height: 180,
    backgroundColor: "#f3f4f6",
  },
  placeholderImage: {
    alignItems: "center",
    justifyContent: "center",
  },
  listingInfo: { padding: 12 },
  listingPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  listingSubPrice: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 1,
  },
  listingAddress: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },
  listingSpecs: { marginTop: 6 },
  specSmall: { fontSize: 13, color: "#4b5563" },
  listingType: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 4,
  },
  // Detail
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#fff",
  },
  backBtn: { padding: 8 },
  detailHeaderTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  detailContent: { paddingBottom: 40 },
  detailImage: {
    width: "100%",
    height: 240,
    backgroundColor: "#f3f4f6",
  },
  detailBody: { padding: 16 },
  detailPrice: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  detailAddress: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  detailSpecs: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
  },
  specItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  specText: { fontSize: 14, color: "#4b5563" },
  detailMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
  },
  metaLabel: { fontSize: 14, color: "#6b7280" },
  metaValue: { fontSize: 14, color: "#111827", fontWeight: "500" },
});
