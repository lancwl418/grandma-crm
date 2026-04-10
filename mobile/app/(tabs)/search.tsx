import { useState, useCallback, useEffect, useRef } from "react";
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
  Dimensions,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Search,
  Home,
  ChevronLeft,
  X,
  ExternalLink,
  GraduationCap,
  MapPin,
  Heart,
} from "lucide-react-native";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || "https://grandma-crm.onrender.com";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_IMAGE_HEIGHT = 220;
const DETAIL_IMAGE_HEIGHT = 280;

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

interface PropertyDetail {
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
  description_en?: string | null;
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

interface ZestimatePoint {
  date: string;
  value: number;
}

interface TaxAssessment {
  year: number;
  value: number;
  taxPaid: number | null;
}

interface NearbyProperty {
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

const HOME_TYPE_LABELS: Record<string, string> = {
  SINGLE_FAMILY: "独栋别墅",
  CONDO: "公寓",
  TOWNHOUSE: "联排别墅",
  MULTI_FAMILY: "多户住宅",
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

function formatPrice(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
}

// ── Property Detail View ──

const PropertyDetailView = ({
  listing,
  onBack,
  onSelectListing,
}: {
  listing: Listing;
  onBack: () => void;
  onSelectListing?: (l: Listing) => void;
}) => {
  const [detail, setDetail] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showEnDesc, setShowEnDesc] = useState(false);
  const [zestHistory, setZestHistory] = useState<ZestimatePoint[]>([]);
  const [taxHistory, setTaxHistory] = useState<TaxAssessment[]>([]);
  const [similarProps, setSimilarProps] = useState<NearbyProperty[]>([]);
  const [nearbyProps, setNearbyProps] = useState<NearbyProperty[]>([]);

  useEffect(() => {
    setPhotoIndex(0);
    setShowEnDesc(false);
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/browse/listing/${listing.zpid}`);
        if (res.ok) setDetail(await res.json());
      } catch {}
      setLoading(false);
    })();

    // Fetch extra data in parallel (non-blocking)
    fetch(`${API_BASE}/api/browse/listing/${listing.zpid}/zestimate-history`)
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.history) setZestHistory(d.history); }).catch(() => {});
    fetch(`${API_BASE}/api/browse/listing/${listing.zpid}/tax-history`)
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.assessments) setTaxHistory(d.assessments); }).catch(() => {});
    fetch(`${API_BASE}/api/browse/listing/${listing.zpid}/similar`)
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.properties) setSimilarProps(d.properties); }).catch(() => {});
    fetch(`${API_BASE}/api/browse/listing/${listing.zpid}/nearby`)
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.properties) setNearbyProps(d.properties); }).catch(() => {});
  }, [listing.zpid]);

  const d = detail;
  const photos = d?.photos?.length ? d.photos : listing.photos?.length ? listing.photos : listing.imageUrl ? [listing.imageUrl] : [];

  return (
    <View style={s.rootBg}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Floating back button */}
        <TouchableOpacity onPress={onBack} style={s.floatingBack}>
          <ChevronLeft size={22} color="#000" />
        </TouchableOpacity>

        {loading && !d ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#000" />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Photo carousel */}
            {photos.length > 0 && (
              <View>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
                  }}
                >
                  {photos.map((uri, i) => (
                    <Image
                      key={i}
                      source={{ uri }}
                      style={{ width: SCREEN_WIDTH, height: DETAIL_IMAGE_HEIGHT }}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
                {/* Dots */}
                {photos.length > 1 && (
                  <View style={s.dotsRow}>
                    {photos.slice(0, 8).map((_, i) => (
                      <View
                        key={i}
                        style={[s.dot, photoIndex === i && s.dotActive]}
                      />
                    ))}
                    {photos.length > 8 && <Text style={s.dotMore}>+{photos.length - 8}</Text>}
                  </View>
                )}
              </View>
            )}

            {/* Info Card — overlapping the photo */}
            <View style={s.detailCard}>
              {/* Address */}
              <View style={s.detailLocationRow}>
                <MapPin size={14} color="#999" />
                <Text style={s.detailLocation} numberOfLines={2}>
                  {d?.address || `${listing.address}, ${listing.city}, ${listing.state} ${listing.zipcode}`}
                </Text>
              </View>

              {/* Description snippet — first sentence only */}
              {d?.description && (() => {
                const full = showEnDesc && d.description_en ? d.description_en : d.description;
                const match = full.match(/^[^。.!！？?]+[。.!！？?]?/);
                const firstSentence = match ? match[0] : full;
                return <Text style={s.detailDescSnippet}>{firstSentence}</Text>;
              })()}
              {d?.description && (
                <TouchableOpacity onPress={() => setShowEnDesc(!showEnDesc)}>
                  <Text style={s.readMore}>{showEnDesc ? "查看中文" : d.description_en ? "查看英文" : "查看详情"}</Text>
                </TouchableOpacity>
              )}

              {/* Big Specs */}
              <View style={s.bigSpecsRow}>
                <View style={s.bigSpecItem}>
                  <Text style={s.bigSpecNum}>{d?.beds ?? listing.beds}</Text>
                  <Text style={s.bigSpecLabel}>卧</Text>
                </View>
                <View style={s.bigSpecDivider} />
                <View style={s.bigSpecItem}>
                  <Text style={s.bigSpecNum}>{d?.baths ?? listing.baths}</Text>
                  <Text style={s.bigSpecLabel}>卫</Text>
                </View>
                <View style={s.bigSpecDivider} />
                <View style={s.bigSpecItem}>
                  <Text style={s.bigSpecNum}>{((d?.sqft ?? listing.sqft) / 1000).toFixed(1)}K</Text>
                  <Text style={s.bigSpecLabel}>sqft</Text>
                </View>
              </View>

              {/* Price bar */}
              <View style={s.priceBar}>
                <Text style={s.priceAmount}>
                  {d?.priceFormatted || listing.priceFormatted}
                  {listing.status === "FOR_RENT" || d?.status === "FOR_RENT" ? (
                    <Text style={s.pricePerMonth}> /月</Text>
                  ) : null}
                </Text>
                <TouchableOpacity
                  style={s.inquiryBtn}
                  onPress={() => Linking.openURL(d?.detailUrl || listing.detailUrl)}
                >
                  <Text style={s.inquiryBtnText}>在 Zillow 查看</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Estimates */}
            {(d?.zestimate || d?.rentZestimate) && (
              <View style={s.sectionCard}>
                <Text style={s.sectionTitle}>估价参考</Text>
                {d.zestimate ? (
                  <View style={s.factRow}>
                    <Text style={s.factLabel}>房屋估价</Text>
                    <Text style={s.factValue}>{formatPrice(d.zestimate)}</Text>
                  </View>
                ) : null}
                {d.rentZestimate ? (
                  <View style={s.factRow}>
                    <Text style={s.factLabel}>租金估价</Text>
                    <Text style={s.factValue}>{formatPrice(d.rentZestimate)}/月</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Key Facts */}
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>房屋详情</Text>
              <View style={s.factRow}>
                <Text style={s.factLabel}>类型</Text>
                <Text style={s.factValue}>{HOME_TYPE_LABELS[d?.homeType || listing.homeType] || d?.homeType || "—"}</Text>
              </View>
              {d?.yearBuilt ? (
                <View style={s.factRow}>
                  <Text style={s.factLabel}>建造年份</Text>
                  <Text style={s.factValue}>{d.yearBuilt}</Text>
                </View>
              ) : null}
              {d?.lotSqft ? (
                <View style={s.factRow}>
                  <Text style={s.factLabel}>占地面积</Text>
                  <Text style={s.factValue}>{d.lotSqft.toLocaleString()} sqft</Text>
                </View>
              ) : null}
              <View style={s.factRow}>
                <Text style={s.factLabel}>上市天数</Text>
                <Text style={s.factValue}>{d?.daysOnZillow ?? listing.daysOnZillow}</Text>
              </View>
              {d?.broker ? (
                <View style={s.factRow}>
                  <Text style={s.factLabel}>经纪公司</Text>
                  <Text style={s.factValue} numberOfLines={1}>{d.broker}</Text>
                </View>
              ) : null}
              {d?.mlsId ? (
                <View style={s.factRow}>
                  <Text style={s.factLabel}>MLS #</Text>
                  <Text style={s.factValue}>{d.mlsId}</Text>
                </View>
              ) : null}
            </View>

            {/* Full Description */}
            {d?.description && (
              <View style={s.sectionCard}>
                <Text style={s.sectionTitle}>房源描述</Text>
                <Text style={s.descFullText}>
                  {showEnDesc && d.description_en ? d.description_en : d.description}
                </Text>
              </View>
            )}

            {/* Features */}
            {d?.features && d.features.length > 0 && (
              <View style={s.sectionCard}>
                <Text style={s.sectionTitle}>房屋特色</Text>
                <View style={s.featuresWrap}>
                  {d.features.map((f, i) => (
                    <View key={i} style={s.featurePill}>
                      <Text style={s.featurePillText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Schools */}
            {d?.schools && d.schools.length > 0 && (
              <View style={s.sectionCard}>
                <View style={s.sectionTitleRow}>
                  <GraduationCap size={16} color="#000" />
                  <Text style={s.sectionTitle}>周边学校</Text>
                </View>
                {d.schools.map((school, i) => {
                  const rColor = school.rating >= 8 ? "#16a34a" : school.rating >= 5 ? "#eab308" : "#ef4444";
                  return (
                    <View key={i} style={s.schoolItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.schoolName}>{school.name}</Text>
                        <Text style={s.schoolType}>{school.type}{school.distance ? ` · ${school.distance}` : ""}</Text>
                      </View>
                      {school.rating > 0 && (
                        <View style={[s.ratingPill, { backgroundColor: rColor }]}>
                          <Text style={s.ratingNum}>{school.rating}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Zestimate History */}
            {zestHistory.length > 0 && (
              <View style={s.sectionCard}>
                <Text style={s.sectionTitle}>价格走势</Text>
                {zestHistory.slice(0, 8).map((p, i) => {
                  const prev = zestHistory[i + 1];
                  const change = prev ? ((p.value - prev.value) / prev.value * 100) : null;
                  return (
                    <View key={i} style={s.factRow}>
                      <Text style={s.factLabel}>{p.date}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {change !== null && (
                          <Text style={{ fontSize: 12, color: change >= 0 ? "#16a34a" : "#ef4444" }}>
                            {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                          </Text>
                        )}
                        <Text style={s.factValue}>{formatPrice(p.value)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Tax History */}
            {taxHistory.length > 0 && (
              <View style={s.sectionCard}>
                <Text style={s.sectionTitle}>税务记录</Text>
                {taxHistory.map((t, i) => (
                  <View key={i} style={s.factRow}>
                    <Text style={s.factLabel}>{t.year}</Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={s.factValue}>{formatPrice(t.value)}</Text>
                      {t.taxPaid ? (
                        <Text style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                          税金: {formatPrice(t.taxPaid)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Similar Properties */}
            {similarProps.length > 0 && (
              <View style={s.sectionCardWide}>
                <Text style={[s.sectionTitle, { paddingHorizontal: 20 }]}>类似房源</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                  {similarProps.map((p) => (
                    <TouchableOpacity
                      key={p.zpid}
                      style={s.miniCard}
                      activeOpacity={0.85}
                      onPress={() => {
                        if (onSelectListing) {
                          const asListing: Listing = {
                            ...p, city: "", state: "", zipcode: "", status: "",
                            daysOnZillow: 0, detailUrl: "", photos: [],
                          };
                          onSelectListing(asListing);
                        }
                      }}
                    >
                      {p.imageUrl ? (
                        <Image source={{ uri: p.imageUrl }} style={s.miniCardImage} resizeMode="cover" />
                      ) : (
                        <View style={[s.miniCardImage, { alignItems: "center", justifyContent: "center" }]}>
                          <Home size={20} color="#ddd" />
                        </View>
                      )}
                      <View style={s.miniCardBody}>
                        <Text style={s.miniCardPrice}>{p.priceFormatted}</Text>
                        <Text style={s.miniCardAddr} numberOfLines={1}>{p.address}</Text>
                        <Text style={s.miniCardSpecs}>{p.beds}卧 · {p.baths}卫 · {p.sqft?.toLocaleString()}sqft</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Nearby Properties */}
            {nearbyProps.length > 0 && (
              <View style={s.sectionCardWide}>
                <Text style={[s.sectionTitle, { paddingHorizontal: 20 }]}>附近房源</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                  {nearbyProps.map((p) => (
                    <TouchableOpacity
                      key={p.zpid}
                      style={s.miniCard}
                      activeOpacity={0.85}
                      onPress={() => {
                        if (onSelectListing) {
                          const asListing: Listing = {
                            ...p, city: "", state: "", zipcode: "", status: "",
                            daysOnZillow: 0, detailUrl: "", photos: [],
                          };
                          onSelectListing(asListing);
                        }
                      }}
                    >
                      {p.imageUrl ? (
                        <Image source={{ uri: p.imageUrl }} style={s.miniCardImage} resizeMode="cover" />
                      ) : (
                        <View style={[s.miniCardImage, { alignItems: "center", justifyContent: "center" }]}>
                          <Home size={20} color="#ddd" />
                        </View>
                      )}
                      <View style={s.miniCardBody}>
                        <Text style={s.miniCardPrice}>{p.priceFormatted}</Text>
                        <Text style={s.miniCardAddr} numberOfLines={1}>{p.address}</Text>
                        <Text style={s.miniCardSpecs}>{p.beds}卧 · {p.baths}卫 · {p.sqft?.toLocaleString()}sqft</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
};

// ── Search Page ──

export default function SearchPage() {
  const [mode, setMode] = useState<"buy" | "rent">("buy");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  const fetchSuggestions = useCallback(async (text: string) => {
    setQuery(text);
    if (text.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`${API_BASE}/api/browse/autocomplete?q=${encodeURIComponent(text)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions((data.suggestions || []).slice(0, 5).map((s: any) => s.display || s));
      }
    } catch {}
  }, []);

  const doSearch = useCallback(async (location: string, forceMode?: "buy" | "rent") => {
    const m = forceMode || mode;
    setQuery(location);
    setSuggestions([]);
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ location, listingType: m === "rent" ? "rent" : "sale" });
      const res = await fetch(`${API_BASE}/api/browse/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data.results || data.listings || []);
      }
    } catch (err) {
      console.error("search error:", err);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  const switchMode = (newMode: "buy" | "rent") => {
    if (mode === newMode) return;
    setMode(newMode);
    if (query.trim() && searched) doSearch(query.trim(), newMode);
  };

  if (selectedListing) {
    return (
      <PropertyDetailView
        listing={selectedListing}
        onBack={() => setSelectedListing(null)}
        onSelectListing={(l) => setSelectedListing(l)}
      />
    );
  }

  return (
    <View style={s.rootBg}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Title */}
        <View style={s.topSection}>
          <View style={s.titleRow}>
            <Text style={s.heroTitle}>
              {searched ? `找到 ${listings.length} 套房源` : "探索你身边的\n理想家园"}
            </Text>
            {searched && (
              <TouchableOpacity
                style={s.resetBtn}
                onPress={() => { setSearched(false); setListings([]); setQuery(""); }}
              >
                <X size={16} color="#000" />
              </TouchableOpacity>
            )}
          </View>
          {searched && query ? (
            <Text style={s.heroSub}>{query}</Text>
          ) : !searched ? (
            <Text style={s.heroSub}>开始搜索你的梦想之家</Text>
          ) : null}
        </View>

        {/* Mode toggle */}
        <View style={s.modeRow}>
          <TouchableOpacity
            style={[s.modeBtn, mode === "buy" && s.modeBtnActive]}
            onPress={() => switchMode("buy")}
          >
            <Text style={[s.modeBtnText, mode === "buy" && s.modeBtnTextActive]}>买房</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeBtn, mode === "rent" && s.modeBtnActive]}
            onPress={() => switchMode("rent")}
          >
            <Text style={[s.modeBtnText, mode === "rent" && s.modeBtnTextActive]}>租房</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchBar}>
          <Search size={18} color="#aaa" />
          <TextInput
            style={s.searchInput}
            placeholder="输入城市、邮编或地址"
            placeholderTextColor="#bbb"
            value={query}
            onChangeText={fetchSuggestions}
            onSubmitEditing={() => query.trim() && doSearch(query.trim())}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(""); setSuggestions([]); }}>
              <X size={16} color="#aaa" />
            </TouchableOpacity>
          )}
        </View>

        {/* Suggestions dropdown */}
        {suggestions.length > 0 && (
          <View style={s.suggestionsBox}>
            {suggestions.map((sug, i) => (
              <TouchableOpacity key={i} style={s.sugItem} onPress={() => doSearch(sug)}>
                <MapPin size={14} color="#bbb" />
                <Text style={s.sugText}>{sug}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Content */}
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#000" />
          </View>
        ) : !searched ? (
          <ScrollView contentContainerStyle={s.hotSection}>
            <Text style={s.hotLabel}>热门区域</Text>
            <View style={s.hotWrap}>
              {HOT_AREAS.map((area) => (
                <TouchableOpacity key={area} style={s.hotPill} onPress={() => doSearch(area)}>
                  <Text style={s.hotPillText}>{area}</Text>
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
            contentContainerStyle={s.listPad}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.card}
                onPress={() => setSelectedListing(item)}
                activeOpacity={0.85}
              >
                <View style={s.cardImageWrap}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={s.cardImage} resizeMode="cover" />
                  ) : (
                    <View style={[s.cardImage, s.cardPlaceholder]}>
                      <Home size={28} color="#d1d5db" />
                    </View>
                  )}
                  {/* Price overlay */}
                  <View style={s.cardPriceOverlay}>
                    <Text style={s.cardPriceText}>
                      {item.buildingName || item.priceFormatted}
                    </Text>
                  </View>
                  {/* Type badge */}
                  {item.homeType ? (
                    <View style={s.cardTypeBadge}>
                      <Text style={s.cardTypeBadgeText}>
                        {HOME_TYPE_LABELS[item.homeType] || item.homeType}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={s.cardBody}>
                  <Text style={s.cardAddress} numberOfLines={1}>
                    {item.address}, {item.city}
                  </Text>
                  <View style={s.cardSpecsRow}>
                    <Text style={s.cardSpec}>{item.beds} <Text style={s.cardSpecLabel}>卧</Text></Text>
                    <Text style={s.cardSpecDot}>·</Text>
                    <Text style={s.cardSpec}>{item.baths} <Text style={s.cardSpecLabel}>卫</Text></Text>
                    <Text style={s.cardSpecDot}>·</Text>
                    <Text style={s.cardSpec}>{item.sqft?.toLocaleString()} <Text style={s.cardSpecLabel}>sqft</Text></Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

// ── Styles ──

const s = StyleSheet.create({
  rootBg: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // ─ Search Page ─
  topSection: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  heroTitle: { fontSize: 26, fontWeight: "800", color: "#000", lineHeight: 32 },
  heroSub: { fontSize: 14, color: "#999", marginTop: 4 },

  modeRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 20, marginTop: 16,
  },
  modeBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 24, backgroundColor: "#f5f5f5",
  },
  modeBtnActive: { backgroundColor: "#000" },
  modeBtnText: { fontSize: 14, fontWeight: "600", color: "#888" },
  modeBtnTextActive: { color: "#fff" },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 20, marginTop: 16,
    backgroundColor: "#f5f5f5", borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#000" },

  suggestionsBox: {
    marginHorizontal: 20, marginTop: 4,
    backgroundColor: "#fff", borderRadius: 16,
    borderWidth: 1, borderColor: "#eee",
    overflow: "hidden",
  },
  sugItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#f5f5f5",
  },
  sugText: { fontSize: 14, color: "#333" },

  hotSection: { padding: 20, paddingTop: 24 },
  hotLabel: { fontSize: 16, fontWeight: "700", color: "#000", marginBottom: 14 },
  hotWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  hotPill: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 24, backgroundColor: "#f5f5f5",
  },
  hotPillText: { fontSize: 13, fontWeight: "500", color: "#333" },

  emptyText: { fontSize: 15, color: "#aaa" },

  // ─ Listing cards ─
  listPad: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30 },
  card: {
    borderRadius: 20, overflow: "hidden",
    marginBottom: 16, backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardImageWrap: { position: "relative" },
  cardImage: { width: "100%", height: CARD_IMAGE_HEIGHT, backgroundColor: "#f0f0f0" },
  cardPlaceholder: { alignItems: "center", justifyContent: "center" },
  cardPriceOverlay: {
    position: "absolute", bottom: 12, left: 12,
    backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 12,
  },
  cardPriceText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  cardTypeBadge: {
    position: "absolute", top: 12, left: 12,
    backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
  },
  cardTypeBadgeText: { fontSize: 11, fontWeight: "600", color: "#333" },
  cardBody: { paddingHorizontal: 16, paddingVertical: 14 },
  cardAddress: { fontSize: 14, color: "#666", marginBottom: 6 },
  cardSpecsRow: { flexDirection: "row", alignItems: "center" },
  cardSpec: { fontSize: 14, fontWeight: "600", color: "#000" },
  cardSpecLabel: { fontWeight: "400", color: "#999" },
  cardSpecDot: { fontSize: 14, color: "#ccc", marginHorizontal: 6 },

  // ─ Detail ─
  floatingBack: {
    position: "absolute", top: 54, left: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  dotsRow: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    gap: 6, paddingVertical: 12,
    backgroundColor: "#fff",
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ddd" },
  dotActive: { backgroundColor: "#000", width: 20 },
  dotMore: { fontSize: 11, color: "#aaa", marginLeft: 2 },

  detailCard: {
    backgroundColor: "#fff", borderRadius: 24,
    marginHorizontal: 16, marginTop: -24,
    padding: 20,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: -4 },
    elevation: 5,
  },
  detailLocationRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 8 },
  detailLocation: { fontSize: 14, color: "#888", flex: 1, lineHeight: 20 },
  detailDescSnippet: { fontSize: 14, color: "#555", lineHeight: 22, marginBottom: 2 },
  readMore: { fontSize: 13, fontWeight: "600", color: "#000", marginBottom: 16 },

  bigSpecsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 20,
    borderTopWidth: 1, borderTopColor: "#f0f0f0",
  },
  bigSpecItem: { flex: 1, alignItems: "center" },
  bigSpecNum: { fontSize: 32, fontWeight: "800", color: "#000" },
  bigSpecLabel: { fontSize: 13, color: "#aaa", marginTop: 2 },
  bigSpecDivider: { width: 1, height: 40, backgroundColor: "#eee" },

  priceBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: "#f0f0f0",
    paddingTop: 16,
  },
  priceAmount: { fontSize: 22, fontWeight: "800", color: "#000" },
  pricePerMonth: { fontSize: 14, fontWeight: "400", color: "#999" },
  inquiryBtn: {
    backgroundColor: "#000", paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 14,
  },
  inquiryBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // ─ Detail sections ─
  sectionCard: {
    backgroundColor: "#fff", borderRadius: 20,
    marginHorizontal: 16, marginTop: 12,
    padding: 20,
    borderWidth: 1, borderColor: "#f0f0f0",
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#000", marginBottom: 12 },
  factRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f9f9f9",
  },
  factLabel: { fontSize: 14, color: "#888" },
  factValue: { fontSize: 14, fontWeight: "600", color: "#000", flex: 1, textAlign: "right" },

  descFullText: { fontSize: 14, color: "#444", lineHeight: 24 },

  featuresWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  featurePill: {
    backgroundColor: "#f5f5f5", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  featurePillText: { fontSize: 12, color: "#555" },

  schoolItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f9f9f9",
  },
  schoolName: { fontSize: 14, fontWeight: "500", color: "#000" },
  schoolType: { fontSize: 12, color: "#aaa", marginTop: 2 },
  ratingPill: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  ratingNum: { fontSize: 13, fontWeight: "800", color: "#fff" },

  // Title row with reset
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  resetBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#f0f0f0", alignItems: "center", justifyContent: "center",
    marginTop: 4,
  },

  // Mini cards for similar / nearby
  sectionCardWide: {
    backgroundColor: "#fff", borderRadius: 20,
    marginTop: 12, paddingVertical: 20,
    borderWidth: 1, borderColor: "#f0f0f0",
  },
  miniCard: {
    width: 180, borderRadius: 16, overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  miniCardImage: { width: 180, height: 120, backgroundColor: "#f0f0f0" },
  miniCardBody: { padding: 10 },
  miniCardPrice: { fontSize: 15, fontWeight: "700", color: "#000" },
  miniCardAddr: { fontSize: 12, color: "#888", marginTop: 2 },
  miniCardSpecs: { fontSize: 11, color: "#aaa", marginTop: 4 },
});
