import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { searchListings, autocomplete, type Listing } from '../../utils/api'
import './index.scss'

const HOME_TYPE_LABELS: Record<string, string> = {
  SINGLE_FAMILY: '独栋', CONDO: '公寓', TOWNHOUSE: '联排', APARTMENT: '公寓楼',
}

const HOT_AREAS = [
  { name: 'Irvine', label: 'Irvine, CA' },
  { name: 'Arcadia', label: 'Arcadia, CA' },
  { name: 'San Marino', label: 'San Marino, CA' },
  { name: 'Pasadena', label: 'Pasadena, CA' },
  { name: 'Chino Hills', label: 'Chino Hills, CA' },
  { name: 'Walnut', label: 'Walnut, CA' },
  { name: 'Diamond Bar', label: 'Diamond Bar, CA' },
  { name: 'Rowland Heights', label: 'Rowland Heights, CA' },
]

export default function Index() {
  const [listingType, setListingType] = useState<'sale' | 'rent'>('sale')
  const [location, setLocation] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ display: string; type: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const timerRef = useRef<any>(null)

  const doSearch = useCallback(async (loc: string) => {
    if (!loc.trim()) return
    setLocation(loc)
    setLoading(true)
    setSearched(true)
    setShowSuggestions(false)
    try {
      const res = await searchListings({ location: loc, listingType })
      setListings(res.results || [])
    } catch {
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [listingType])

  const handleInput = (val: string) => {
    setLocation(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (val.length < 2) { setSuggestions([]); return }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await autocomplete(val)
        setSuggestions(res.results || [])
        setShowSuggestions(true)
      } catch { setSuggestions([]) }
    }, 300)
  }

  const goDetail = (listing: Listing) => {
    Taro.navigateTo({
      url: `/pages/detail/index?zpid=${listing.zpid}&address=${encodeURIComponent(listing.address)}&price=${listing.price}&imageUrl=${encodeURIComponent(listing.imageUrl || '')}&photos=${encodeURIComponent(JSON.stringify((listing.photos || []).slice(0, 5)))}`
    })
  }

  return (
    <View className='index-page'>
      {/* Toggle */}
      <View className='type-toggle'>
        <View className={`toggle-btn ${listingType === 'sale' ? 'active' : ''}`} onClick={() => setListingType('sale')}>
          <Text>买房</Text>
        </View>
        <View className={`toggle-btn ${listingType === 'rent' ? 'active' : ''}`} onClick={() => setListingType('rent')}>
          <Text>租房</Text>
        </View>
      </View>

      {/* Search */}
      <View className='search-bar'>
        <Input
          className='search-input'
          placeholder='输入城市、邮编或地址...'
          value={location}
          onInput={(e) => handleInput(e.detail.value)}
          onConfirm={() => doSearch(location)}
          confirmType='search'
        />
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

      <ScrollView scrollY className='content-scroll'>
        {/* Hot Areas */}
        {!searched && (
          <View className='section'>
            <Text className='section-title'>热门区域</Text>
            <View className='area-grid'>
              {HOT_AREAS.map((area) => (
                <View key={area.name} className='area-item' onClick={() => doSearch(area.label)}>
                  <Text>{area.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Results */}
        <View className='section'>
          {loading && <View className='empty-state'><Text>搜索中...</Text></View>}

          {!loading && searched && listings.length === 0 && (
            <View className='empty-state'><Text>暂无房源，试试搜索其他区域</Text></View>
          )}

          {listings.map((item) => (
            <View key={item.zpid || item.address} className='listing-card' onClick={() => goDetail(item)}>
              {item.imageUrl && (
                <Image className='listing-image' src={item.imageUrl} mode='aspectFill' lazyLoad />
              )}
              <View className='listing-info'>
                {item.buildingName && item.price === 0 ? (
                  <View>
                    <Text className='listing-price'>{item.buildingName}</Text>
                    {item.minPrice && item.maxPrice && (
                      <Text className='listing-rent'>${item.minPrice.toLocaleString()} - ${item.maxPrice.toLocaleString()}/月</Text>
                    )}
                  </View>
                ) : (
                  <Text className='listing-price'>{item.priceFormatted}</Text>
                )}
                <View className='listing-specs'>
                  {item.beds > 0 && <Text>{item.beds}卧</Text>}
                  {item.baths > 0 && <Text> {item.baths}卫</Text>}
                  {item.sqft > 0 && <Text> {item.sqft.toLocaleString()}sqft</Text>}
                  <Text> {HOME_TYPE_LABELS[item.homeType] || item.homeType}</Text>
                </View>
                <Text className='listing-address'>{item.address}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
