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

const BED_OPTIONS = ['不限', '1+', '2+', '3+', '4+', '5+']
const TYPE_OPTIONS = ['不限', '独栋', '公寓', '联排', '公寓楼']
const TYPE_MAP: Record<string, string> = {
  '独栋': 'SINGLE_FAMILY',
  '公寓': 'CONDO',
  '联排': 'TOWNHOUSE',
  '公寓楼': 'APARTMENT',
}

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

export default function Search() {
  const [listingType, setListingType] = useState<'sale' | 'rent'>('sale')
  const [location, setLocation] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ display: string; type: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [allListings, setAllListings] = useState<Listing[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [bedIndex, setBedIndex] = useState(0)
  const [typeIndex, setTypeIndex] = useState(0)
  const [displayCount, setDisplayCount] = useState(10)
  const timerRef = useRef<any>(null)

  useDidShow(() => {
    // Check for pre-filled location
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

  const applyFilters = useCallback((items: Listing[], min: string, max: string, beds: number, typeIdx: number) => {
    let filtered = [...items]

    // Price filter
    const minP = min ? parseInt(min) : 0
    const maxP = max ? parseInt(max) : 0
    if (minP > 0) {
      filtered = filtered.filter(l => l.price >= minP)
    }
    if (maxP > 0) {
      filtered = filtered.filter(l => l.price <= maxP)
    }

    // Beds filter
    if (beds > 0) {
      filtered = filtered.filter(l => l.beds >= beds)
    }

    // Type filter
    const typeName = TYPE_OPTIONS[typeIdx]
    if (typeName !== '不限') {
      const typeVal = TYPE_MAP[typeName]
      if (typeVal) {
        filtered = filtered.filter(l => l.homeType === typeVal)
      }
    }

    return filtered
  }, [])

  const doSearch = useCallback(async (loc: string) => {
    if (!loc.trim()) return
    setLocation(loc)
    setLoading(true)
    setSearched(true)
    setShowSuggestions(false)
    setDisplayCount(10)

    // Save to search history
    try {
      let history: string[] = Taro.getStorageSync('search_history') || []
      history = [loc, ...history.filter(h => h !== loc)].slice(0, 10)
      Taro.setStorageSync('search_history', history)
    } catch {
      // ignore
    }

    try {
      const res = await searchListings({ location: loc, listingType })
      const results = res.results || []
      setAllListings(results)
      const filtered = applyFilters(results, minPrice, maxPrice, bedIndex, typeIndex)
      setListings(filtered)
    } catch {
      setAllListings([])
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [listingType, minPrice, maxPrice, bedIndex, typeIndex, applyFilters])

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

  const handleFilterChange = (min: string, max: string, beds: number, typeIdx: number) => {
    const filtered = applyFilters(allListings, min, max, beds, typeIdx)
    setListings(filtered)
    setDisplayCount(10)
  }

  const goDetail = (listing: Listing) => {
    const photos = (listing.photos || []).slice(0, 8)
    Taro.navigateTo({
      url: `/pages/detail/index?zpid=${listing.zpid}&address=${encodeURIComponent(listing.address)}&price=${listing.price}&imageUrl=${encodeURIComponent(listing.imageUrl || '')}&photos=${encodeURIComponent(JSON.stringify(photos))}`
    })
  }

  const loadMore = () => {
    if (displayCount < listings.length) {
      setDisplayCount(prev => prev + 10)
    }
  }

  const displayedListings = listings.slice(0, displayCount)

  return (
    <View className='search-page'>
      {/* Toggle */}
      <View className='type-toggle'>
        <View
          className={`toggle-btn ${listingType === 'sale' ? 'active' : ''}`}
          onClick={() => { setListingType('sale'); if (searched && location) doSearch(location) }}
        >
          <Text>买房</Text>
        </View>
        <View
          className={`toggle-btn ${listingType === 'rent' ? 'active' : ''}`}
          onClick={() => { setListingType('rent'); if (searched && location) doSearch(location) }}
        >
          <Text>租房</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View className='search-bar'>
        <View className='search-input-wrap'>
          <Text className='search-icon'>&#x1F50D;</Text>
          <Input
            className='search-input'
            placeholder='输入城市、邮编或地址...'
            value={location}
            onInput={(e) => handleInput(e.detail.value)}
            onConfirm={() => doSearch(location)}
            confirmType='search'
          />
        </View>
      </View>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <View className='suggestions'>
          {suggestions.map((s, i) => (
            <View key={i} className='suggestion-item' onClick={() => { setShowSuggestions(false); doSearch(s.display) }}>
              <Text className='suggestion-text'>{s.display}</Text>
              <Text className='suggestion-type'>{s.type}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Filter Row */}
      {searched && (
        <View className='filter-row'>
          <Input
            className='filter-input'
            placeholder='最低价'
            type='number'
            value={minPrice}
            onInput={(e) => {
              setMinPrice(e.detail.value)
              handleFilterChange(e.detail.value, maxPrice, bedIndex, typeIndex)
            }}
          />
          <Text className='filter-dash'>-</Text>
          <Input
            className='filter-input'
            placeholder='最高价'
            type='number'
            value={maxPrice}
            onInput={(e) => {
              setMaxPrice(e.detail.value)
              handleFilterChange(minPrice, e.detail.value, bedIndex, typeIndex)
            }}
          />
          <Picker
            mode='selector'
            range={BED_OPTIONS}
            value={bedIndex}
            onChange={(e) => {
              const idx = Number(e.detail.value)
              setBedIndex(idx)
              handleFilterChange(minPrice, maxPrice, idx, typeIndex)
            }}
          >
            <View className='filter-select'>
              <Text>{BED_OPTIONS[bedIndex] === '不限' ? '卧室' : BED_OPTIONS[bedIndex] + '卧'}</Text>
            </View>
          </Picker>
          <Picker
            mode='selector'
            range={TYPE_OPTIONS}
            value={typeIndex}
            onChange={(e) => {
              const idx = Number(e.detail.value)
              setTypeIndex(idx)
              handleFilterChange(minPrice, maxPrice, bedIndex, idx)
            }}
          >
            <View className='filter-select'>
              <Text>{TYPE_OPTIONS[typeIndex] === '不限' ? '类型' : TYPE_OPTIONS[typeIndex]}</Text>
            </View>
          </Picker>
        </View>
      )}

      <ScrollView
        scrollY
        className='results-scroll'
        onScrollToLower={loadMore}
        lowerThreshold={200}
      >
        {/* Hot Areas - show when not searched */}
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

        {/* Loading */}
        {loading && (
          <View className='empty-state'>
            <Text className='empty-text'>搜索中...</Text>
          </View>
        )}

        {/* No results */}
        {!loading && searched && listings.length === 0 && (
          <View className='empty-state'>
            <Text className='empty-icon'>&#x1F3E0;</Text>
            <Text className='empty-text'>暂无房源，试试搜索其他区域</Text>
          </View>
        )}

        {/* Results count */}
        {!loading && searched && listings.length > 0 && (
          <View className='results-count'>
            <Text className='results-count-text'>找到 {listings.length} 套房源</Text>
          </View>
        )}

        {/* Listing Cards */}
        <View className='results-list'>
          {displayedListings.map((item) => (
            <View key={item.zpid || item.address} className='listing-card' onClick={() => goDetail(item)}>
              {item.imageUrl ? (
                <Image className='listing-image' src={item.imageUrl} mode='aspectFill' lazyLoad />
              ) : (
                <View className='listing-image-placeholder'>
                  <Text className='placeholder-text'>暂无图片</Text>
                </View>
              )}
              <View className='listing-info'>
                {item.buildingName && item.price === 0 ? (
                  <View>
                    <Text className='listing-building'>{item.buildingName}</Text>
                    {item.minPrice != null && item.maxPrice != null && (
                      <Text className='listing-rent-range'>${item.minPrice.toLocaleString()} - ${item.maxPrice.toLocaleString()}/月</Text>
                    )}
                  </View>
                ) : (
                  <Text className='listing-price'>{item.priceFormatted}</Text>
                )}
                <View className='listing-specs'>
                  {item.beds > 0 && <Text className='spec-item'>{item.beds}卧</Text>}
                  {item.baths > 0 && <Text className='spec-item'>{item.baths}卫</Text>}
                  {item.sqft > 0 && <Text className='spec-item'>{item.sqft.toLocaleString()} sqft</Text>}
                  <Text className='spec-type'>{HOME_TYPE_LABELS[item.homeType] || item.homeType}</Text>
                </View>
                <Text className='listing-address'>{item.address}</Text>
                {item.city && <Text className='listing-city'>{item.city}, {item.state}</Text>}
              </View>
            </View>
          ))}
        </View>

        {/* Load More */}
        {displayCount < listings.length && (
          <View className='load-more' onClick={loadMore}>
            <Text className='load-more-text'>加载更多 ({listings.length - displayCount} 套)</Text>
          </View>
        )}

        {displayCount >= listings.length && searched && listings.length > 0 && (
          <View className='list-end'>
            <Text className='list-end-text'>已显示全部房源</Text>
          </View>
        )}

        <View className='bottom-spacer' />
      </ScrollView>
    </View>
  )
}
