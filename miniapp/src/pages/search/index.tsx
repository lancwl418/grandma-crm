import { View, Text, Input, Image, ScrollView, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { searchListings, autocomplete, type Listing } from '../../utils/api'
import './index.scss'

const HOME_TYPE_LABELS: Record<string, string> = {
  SINGLE_FAMILY: '独栋',
  CONDO: '公寓',
  TOWNHOUSE: '联排',
  APARTMENT: '公寓楼',
  MULTI_FAMILY: '多户',
  LOT: '地块',
}

const TYPE_OPTIONS = ['不限', '独栋', '公寓', '联排', '公寓楼']
const TYPE_MAP: Record<string, string> = {
  '独栋': 'SINGLE_FAMILY',
  '公寓': 'CONDO',
  '联排': 'TOWNHOUSE',
  '公寓楼': 'APARTMENT',
}

const DEFAULT_BEDROOM_OPTIONS = [1, 2, 3, 4]

const SALE_PRICE_PRESETS = [
  { label: '不限', min: '', max: '' },
  { label: '$500K 以下', min: '', max: '500000' },
  { label: '$500K - $1M', min: '500000', max: '1000000' },
  { label: '$1M - $2M', min: '1000000', max: '2000000' },
  { label: '$2M 以上', min: '2000000', max: '' },
]

const RENT_PRICE_PRESETS = [
  { label: '不限', min: '', max: '' },
  { label: '$2,000 以下', min: '', max: '2000' },
  { label: '$2,000 - $4,000', min: '2000', max: '4000' },
  { label: '$4,000 - $8,000', min: '4000', max: '8000' },
  { label: '$8,000 以上', min: '8000', max: '' },
]

const HOT_AREAS = [
  { name: 'Irvine', label: 'Irvine, CA' },
  { name: 'Arcadia', label: 'Arcadia, CA' },
  { name: 'San Marino', label: 'San Marino, CA' },
  { name: 'Pasadena', label: 'Pasadena, CA' },
  { name: 'Chino Hills', label: 'Chino Hills, CA' },
  { name: 'Walnut', label: 'Walnut, CA' },
  { name: 'Diamond Bar', label: 'Diamond Bar, CA' },
  { name: 'Rowland Hts', label: 'Rowland Heights, CA' },
]

const LOCATION_PRESETS = ['当前输入位置', ...HOT_AREAS.map((h) => h.label)]

type PricePreset = { label: string; min: string; max: string }

function formatMoney(v: number, type: 'sale' | 'rent'): string {
  if (type === 'rent') return `$${Math.round(v).toLocaleString()}`
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${Math.round(v / 1000)}K`
  return `$${Math.round(v)}`
}

function normalizePriceBounds(rawBounds: number[], type: 'sale' | 'rent'): number[] {
  const step = type === 'rent' ? 100 : 50000
  const rounded = rawBounds.map((v) => Math.max(step, Math.round(v / step) * step))
  for (let i = 1; i < rounded.length; i += 1) {
    if (rounded[i] <= rounded[i - 1]) rounded[i] = rounded[i - 1] + step
  }
  return rounded
}

function getListingPriceRange(listing: Listing): { low: number; high: number } | null {
  const hasRange = typeof listing.minPrice === 'number' && typeof listing.maxPrice === 'number' && listing.maxPrice > 0
  if (hasRange) {
    const low = Math.min(Number(listing.minPrice), Number(listing.maxPrice))
    const high = Math.max(Number(listing.minPrice), Number(listing.maxPrice))
    if (high > 0) return { low, high }
  }

  if (typeof listing.price === 'number' && listing.price > 0) {
    return { low: listing.price, high: listing.price }
  }

  if (typeof listing.minPrice === 'number' && listing.minPrice > 0) {
    return { low: listing.minPrice, high: listing.minPrice }
  }

  return null
}

function buildDynamicPricePresets(items: Listing[], type: 'sale' | 'rent'): PricePreset[] {
  const fallback = type === 'rent' ? RENT_PRICE_PRESETS : SALE_PRICE_PRESETS
  const prices = items
    .map((i) => getListingPriceRange(i))
    .filter((r): r is { low: number; high: number } => !!r)
    .flatMap((r) => {
      const mid = (r.low + r.high) / 2
      return [r.low, mid, r.high]
    })
    .filter((p) => p > 0)
    .sort((a, b) => a - b)
  if (prices.length < 6) return fallback

  const at = (ratio: number) => prices[Math.min(prices.length - 1, Math.floor((prices.length - 1) * ratio))]
  const [p25, p50, p75] = normalizePriceBounds([at(0.25), at(0.5), at(0.75)], type)
  if (!(p25 < p50 && p50 < p75)) return fallback

  return [
    { label: '不限', min: '', max: '' },
    { label: `${formatMoney(p25, type)} 以下`, min: '', max: String(p25) },
    { label: `${formatMoney(p25, type)} - ${formatMoney(p50, type)}`, min: String(p25), max: String(p50) },
    { label: `${formatMoney(p50, type)} - ${formatMoney(p75, type)}`, min: String(p50), max: String(p75) },
    { label: `${formatMoney(p75, type)} 以上`, min: String(p75), max: '' },
  ]
}

function buildDynamicTypeOptions(items: Listing[]): string[] {
  const unique = new Set<string>()
  for (const i of items) {
    const label = HOME_TYPE_LABELS[i.homeType] || i.homeType
    if (label) unique.add(label)
  }
  return ['不限', ...Array.from(unique)]
}

function buildDynamicBedroomOptions(items: Listing[]): number[] {
  const values = new Set<number>()
  for (const i of items) {
    const beds = Number(i.beds || 0)
    if (beds > 0) values.add(Math.round(beds * 10) / 10)
  }
  const sorted = Array.from(values).sort((a, b) => a - b)
  return sorted.length > 0 ? sorted : DEFAULT_BEDROOM_OPTIONS
}

function getListingTitle(listing: Listing): string {
  if (listing.buildingName) return listing.buildingName
  if (!listing.address) return '房源'
  const firstChunk = listing.address.split(',')[0]
  return firstChunk || listing.address
}

export default function Search() {
  const [listingType, setListingType] = useState<'sale' | 'rent'>('sale')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [location, setLocation] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ display: string; type: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [allListings, setAllListings] = useState<Listing[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const [pricePresetIndex, setPricePresetIndex] = useState(0)
  const [typeIndex, setTypeIndex] = useState(0)
  const [selectedBedrooms, setSelectedBedrooms] = useState<number[]>([])
  const [showBedroomPicker, setShowBedroomPicker] = useState(false)
  const [dynamicPricePresets, setDynamicPricePresets] = useState<PricePreset[]>(SALE_PRICE_PRESETS)
  const [dynamicTypeOptions, setDynamicTypeOptions] = useState<string[]>(TYPE_OPTIONS)
  const [dynamicBedroomOptions, setDynamicBedroomOptions] = useState<number[]>(DEFAULT_BEDROOM_OPTIONS)

  const timerRef = useRef<any>(null)
  const pricePresets = dynamicPricePresets

  useDidShow(() => {
    try {
      const prefill = Taro.getStorageSync('search_prefill')
      if (prefill) {
        Taro.removeStorageSync('search_prefill')
        setLocation(prefill)
        doSearch(prefill)
      }
    } catch {
      // ignore
    }
  })

  const applyFilters = useCallback((
    items: Listing[],
    priceIdx: number,
    bedrooms: number[],
    homeTypeIdx: number,
    type: 'sale' | 'rent'
  ) => {
    let filtered = [...items]

    const presets = dynamicPricePresets.length > 0 ? dynamicPricePresets : (type === 'rent' ? RENT_PRICE_PRESETS : SALE_PRICE_PRESETS)
    const safeIdx = Math.max(0, Math.min(priceIdx, presets.length - 1))
    const preset = presets[safeIdx]
    const minP = preset.min ? parseInt(preset.min) : 0
    const maxP = preset.max ? parseInt(preset.max) : 0
    if (minP > 0 || maxP > 0) {
      filtered = filtered.filter((l) => {
        const range = getListingPriceRange(l)
        if (!range) return false
        if (minP > 0 && maxP > 0) return range.low <= maxP && range.high >= minP
        if (minP > 0) return range.high >= minP
        return range.low <= maxP
      })
    }

    if (bedrooms.length > 0) {
      filtered = filtered.filter((l) => {
        const beds = Math.round(Number(l.beds || 0) * 10) / 10
        return bedrooms.some((v) => Math.abs(v - beds) < 0.01)
      })
    }

    const typeName = dynamicTypeOptions[homeTypeIdx] || '不限'
    if (typeName !== '不限') {
      const typeVal = TYPE_MAP[typeName]
      if (typeVal) {
        filtered = filtered.filter((l) => l.homeType === typeVal)
      } else {
        filtered = filtered.filter((l) => (HOME_TYPE_LABELS[l.homeType] || l.homeType) === typeName)
      }
    }

    return filtered
  }, [dynamicPricePresets, dynamicTypeOptions])

  const doSearch = useCallback(async (loc: string, typeOverride?: 'sale' | 'rent', resetFilters = false) => {
    if (!loc.trim()) return
    const effectiveType = typeOverride || listingType
    setLocation(loc)
    setLoading(true)
    setSearched(true)
    setShowSuggestions(false)

    try {
      const history = (Taro.getStorageSync('search_history') || []) as string[]
      const nextHistory = [loc, ...history.filter((h) => h !== loc)].slice(0, 10)
      Taro.setStorageSync('search_history', nextHistory)
    } catch {
      // ignore
    }

    try {
      const res = await searchListings({ location: loc, listingType: effectiveType })
      const results = res.results || []
      const nextPricePresets = buildDynamicPricePresets(results, effectiveType)
      const nextTypeOptions = buildDynamicTypeOptions(results)
      const nextBedroomOptions = buildDynamicBedroomOptions(results)
      setDynamicPricePresets(nextPricePresets)
      setDynamicTypeOptions(nextTypeOptions)
      setDynamicBedroomOptions(nextBedroomOptions)

      setAllListings(results)
      const rawPriceIndex = resetFilters ? 0 : pricePresetIndex
      const rawTypeIndex = resetFilters ? 0 : typeIndex
      const rawBedrooms = resetFilters ? [] : selectedBedrooms
      const safePriceIndex = Math.min(rawPriceIndex, nextPricePresets.length - 1)
      const safeTypeIndex = Math.min(rawTypeIndex, nextTypeOptions.length - 1)
      const safeBedrooms = rawBedrooms.filter((v) => nextBedroomOptions.some((o) => Math.abs(o - v) < 0.01))
      if (safePriceIndex !== pricePresetIndex) setPricePresetIndex(safePriceIndex)
      if (safeTypeIndex !== typeIndex) setTypeIndex(safeTypeIndex)
      if (safeBedrooms.length !== selectedBedrooms.length) setSelectedBedrooms(safeBedrooms)
      setListings(applyFilters(results, safePriceIndex, safeBedrooms, safeTypeIndex, effectiveType))
    } catch {
      setAllListings([])
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [listingType, applyFilters, pricePresetIndex, selectedBedrooms, typeIndex])

  const handleInput = (val: string) => {
    setLocation(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (val.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    timerRef.current = setTimeout(async () => {
      try {
        const res = await autocomplete(val)
        setSuggestions(res.results || [])
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      }
    }, 300)
  }

  const refreshWithFilters = (nextPriceIdx: number, nextBedrooms: number[], nextTypeIdx: number) => {
    setListings(applyFilters(allListings, nextPriceIdx, nextBedrooms, nextTypeIdx, listingType))
  }

  const handleClearFilters = () => {
    setPricePresetIndex(0)
    setTypeIndex(0)
    setSelectedBedrooms([])
    refreshWithFilters(0, [], 0)
  }

  const toggleBedroom = (value: number) => {
    const exists = selectedBedrooms.some((v) => Math.abs(v - value) < 0.01)
    const next = exists
      ? selectedBedrooms.filter((v) => Math.abs(v - value) >= 0.01)
      : [...selectedBedrooms, value].sort((a, b) => a - b)
    setSelectedBedrooms(next)
    refreshWithFilters(pricePresetIndex, next, typeIndex)
  }

  const goDetail = (listing: Listing) => {
    const photos = (listing.photos || []).slice(0, 8)
    Taro.navigateTo({
      url: `/pages/detail/index?zpid=${listing.zpid}&address=${encodeURIComponent(listing.address)}&price=${listing.price}&imageUrl=${encodeURIComponent(listing.imageUrl || '')}&photos=${encodeURIComponent(JSON.stringify(photos))}`,
    })
  }

  const filterSummary = [
    `类型：${listingType === 'rent' ? '租房' : '买房'}`,
    `价格：${pricePresets[pricePresetIndex]?.label || '不限'}`,
    `房型：${dynamicTypeOptions[typeIndex] || '不限'}`,
    `几房：${selectedBedrooms.length > 0 ? selectedBedrooms.map((v) => `${v}房`).join('、') : '不限'}`,
  ].join('  |  ')
  const priceChipText = pricePresetIndex > 0 ? (pricePresets[pricePresetIndex]?.label || '价格区间') : '价格区间'
  const typeChipText = typeIndex > 0 ? (dynamicTypeOptions[typeIndex] || '房源类型') : '房源类型'
  const bedroomChipText = selectedBedrooms.length === 0
    ? '几房'
    : (selectedBedrooms.length === 1 ? `${selectedBedrooms[0]}房` : `${selectedBedrooms.length}项`)

  return (
    <View className='search-page'>
      <ScrollView scrollY className='results-scroll'>
        <View className='search-hero'>
          <Text className='hero-title'>房源搜索</Text>

          <View className='type-toggle'>
            <View
              className={`toggle-btn ${listingType === 'sale' ? 'active' : ''}`}
              onClick={() => {
                setListingType('sale')
                setPricePresetIndex(0)
                setTypeIndex(0)
                setSelectedBedrooms([])
                if (searched && location) doSearch(location, 'sale', true)
              }}
            >
              <Text>买房</Text>
            </View>
            <View
              className={`toggle-btn ${listingType === 'rent' ? 'active' : ''}`}
              onClick={() => {
                setListingType('rent')
                setPricePresetIndex(0)
                setTypeIndex(0)
                setSelectedBedrooms([])
                if (searched && location) doSearch(location, 'rent', true)
              }}
            >
              <Text>租房</Text>
            </View>
          </View>

          <View className='search-input-wrap'>
            <Text className='search-icon'>&#x1F50D;</Text>
            <Input
              className='search-input'
              placeholder='按区域、小区或邮编搜索'
              value={location}
              onInput={(e) => handleInput(e.detail.value)}
              onConfirm={() => doSearch(location)}
              confirmType='search'
            />
          </View>

          {showSuggestions && suggestions.length > 0 && (
            <View className='suggestions'>
              {suggestions.map((s, i) => (
                <View
                  key={i}
                  className='suggestion-item'
                  onClick={() => {
                    setShowSuggestions(false)
                    doSearch(s.display)
                  }}
                >
                  <Text className='suggestion-text'>{s.display}</Text>
                  <Text className='suggestion-type'>{s.type}</Text>
                </View>
              ))}
            </View>
          )}

          <View className='chip-row'>
            <Picker
              mode='selector'
              range={LOCATION_PRESETS}
              value={0}
              onChange={(e) => {
                const idx = Number(e.detail.value)
                if (idx > 0) doSearch(LOCATION_PRESETS[idx])
              }}
            >
              <View className='filter-chip active'>
                <Text className='chip-text'>{location ? location.split(',')[0] : '区域'}</Text>
                <Text className='chip-arrow'>⌄</Text>
              </View>
            </Picker>

            <Picker
              mode='selector'
              range={pricePresets.map((p) => p.label)}
              value={pricePresetIndex}
              onChange={(e) => {
                const idx = Number(e.detail.value)
                setPricePresetIndex(idx)
                refreshWithFilters(idx, selectedBedrooms, typeIndex)
              }}
            >
              <View className='filter-chip'>
                <Text className='chip-text'>{priceChipText}</Text>
                <Text className='chip-arrow'>⌄</Text>
              </View>
            </Picker>

            <Picker
              mode='selector'
              range={dynamicTypeOptions}
              value={typeIndex}
              onChange={(e) => {
                const idx = Number(e.detail.value)
                setTypeIndex(idx)
                refreshWithFilters(pricePresetIndex, selectedBedrooms, idx)
              }}
            >
              <View className='filter-chip'>
                <Text className='chip-text'>{typeChipText}</Text>
                <Text className='chip-arrow'>⌄</Text>
              </View>
            </Picker>

            <View className='filter-chip' onClick={() => setShowBedroomPicker(true)}>
              <Text className='chip-text'>{bedroomChipText}</Text>
              <Text className='chip-arrow'>⌄</Text>
            </View>
          </View>

          <View className='view-toggle'>
            <View className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
              <Text>列表</Text>
            </View>
            <View className={`view-btn ${viewMode === 'map' ? 'active' : ''}`} onClick={() => setViewMode('map')}>
              <Text>地图</Text>
            </View>
          </View>
        </View>

        {!searched && (
          <View className='section'>
            <Text className='section-title'>热门区域</Text>
            <View className='area-grid'>
              {HOT_AREAS.map((area) => (
                <View key={area.name} className='area-item' onClick={() => doSearch(area.label)}>
                  <Text className='area-name'>{area.name}</Text>
                  <Text className='area-state'>CA</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {loading && (
          <View className='empty-state'>
            <Text className='empty-text'>搜索中...</Text>
          </View>
        )}

        {!loading && searched && viewMode === 'map' && (
          <View className='map-placeholder'>
            <Text className='map-title'>地图模式（即将上线）</Text>
            <Text className='map-desc'>列表与筛选逻辑已对齐，后续可直接接入地图标注与聚合。</Text>
          </View>
        )}

        {!loading && searched && viewMode === 'list' && listings.length === 0 && (
          <View className='empty-state'>
            <Text className='empty-text'>暂无结果，请尝试其他区域或筛选条件。</Text>
          </View>
        )}

        {!loading && searched && viewMode === 'list' && listings.length > 0 && (
          <View className='results-count'>
            <View className='results-count-head'>
              <Text className='results-count-text'>{listings.length} 套房源</Text>
              {(pricePresetIndex > 0 || typeIndex > 0 || selectedBedrooms.length > 0) && (
                <View className='clear-filter-btn' onClick={handleClearFilters}>
                  <Text className='clear-filter-text'>清空筛选</Text>
                </View>
              )}
            </View>
            <Text className='results-filter-debug'>{filterSummary}</Text>
          </View>
        )}

        {viewMode === 'list' && (
          <View className='results-list'>
            {listings.map((item, index) => (
              <View key={item.zpid || item.address} className='listing-card' onClick={() => goDetail(item)}>
                {item.imageUrl ? (
                  <View className='image-wrap'>
                    <Image className='listing-image' src={item.imageUrl} mode='aspectFill' lazyLoad />
                    <View className='badge-row'>
                      <Text className='listing-badge'>{index % 2 === 0 ? '精选' : '独家'}</Text>
                      <Text className='listing-badge dark'>{listingType === 'rent' ? '出租' : '新上架'}</Text>
                    </View>
                    <View className='fav-chip'>♡</View>
                  </View>
                ) : (
                  <View className='listing-image-placeholder'>
                    <Text className='placeholder-text'>暂无图片</Text>
                  </View>
                )}

                <View className='listing-info'>
                  <Text className='listing-building'>{getListingTitle(item)}</Text>
                  <Text className='listing-address'>{item.address}</Text>

                  <View className='listing-specs'>
                    {item.beds > 0 && <Text className='spec-item'>{item.beds} 卧</Text>}
                    {item.baths > 0 && <Text className='spec-item'>• {item.baths} 卫</Text>}
                    {item.sqft > 0 && <Text className='spec-item'>• {item.sqft.toLocaleString()} 平方英尺</Text>}
                  </View>

                  {item.buildingName && item.price === 0 ? (
                    item.minPrice != null && item.maxPrice != null ? (
                      <Text className='listing-price'>${item.minPrice.toLocaleString()} - ${item.maxPrice.toLocaleString()}/月</Text>
                    ) : null
                  ) : (
                    <Text className='listing-price'>{item.priceFormatted}</Text>
                  )}

                  <Text className='spec-type'>{HOME_TYPE_LABELS[item.homeType] || item.homeType}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View className='bottom-spacer' />
      </ScrollView>

      {showBedroomPicker && (
        <View className='bedroom-modal-overlay' onClick={() => setShowBedroomPicker(false)}>
          <View className='bedroom-modal-content' onClick={(e) => e.stopPropagation()}>
            <Text className='bedroom-modal-title'>选择几房（可多选）</Text>
            <ScrollView scrollY className='bedroom-modal-list'>
              <View
                className={`bedroom-modal-item ${selectedBedrooms.length === 0 ? 'active' : ''}`}
                onClick={() => {
                  setSelectedBedrooms([])
                  refreshWithFilters(pricePresetIndex, [], typeIndex)
                }}
              >
                <Text className='bedroom-modal-item-text'>不限</Text>
              </View>
              {dynamicBedroomOptions.map((value) => {
                const selected = selectedBedrooms.some((v) => Math.abs(v - value) < 0.01)
                return (
                  <View
                    key={String(value)}
                    className={`bedroom-modal-item ${selected ? 'active' : ''}`}
                    onClick={() => toggleBedroom(value)}
                  >
                    <Text className='bedroom-modal-item-text'>{value}房</Text>
                  </View>
                )
              })}
            </ScrollView>
            <View className='bedroom-modal-actions'>
              <View className='bedroom-modal-btn' onClick={() => setShowBedroomPicker(false)}>
                <Text className='bedroom-modal-btn-text'>完成</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
