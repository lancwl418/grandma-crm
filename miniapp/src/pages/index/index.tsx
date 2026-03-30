import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { searchListings, autocomplete, Listing } from '../../utils/api'
import './index.scss'

const HOT_AREAS = [
  'Irvine', 'Arcadia', 'San Marino', 'Pasadena',
  'Chino Hills', 'Walnut', 'Diamond Bar', 'Rowland Heights'
]

export default function Index() {
  const [activeType, setActiveType] = useState<'buy' | 'rent'>('buy')
  const [keyword, setKeyword] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)

  useLoad(() => {
    doSearch()
  })

  const doSearch = useCallback(async (city?: string, kw?: string) => {
    setLoading(true)
    setSuggestions([])
    try {
      const res = await searchListings({
        type: activeType,
        keyword: kw || keyword,
        city,
        page: 1,
        pageSize: 20
      })
      setListings(res.listings || [])
    } catch {
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [activeType, keyword])

  const handleInput = useCallback(async (val: string) => {
    setKeyword(val)
    if (val.length >= 2) {
      try {
        const res = await autocomplete(val)
        setSuggestions(res.suggestions || [])
      } catch {
        setSuggestions([])
      }
    } else {
      setSuggestions([])
    }
  }, [])

  const handleSuggestionClick = useCallback((s: string) => {
    setKeyword(s)
    setSuggestions([])
    doSearch(undefined, s)
  }, [doSearch])

  const handleAreaClick = useCallback((area: string) => {
    setKeyword(area)
    doSearch(area)
  }, [doSearch])

  const handleCardClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/detail/index?id=${id}` })
  }, [])

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`
    if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`
    return `$${price}`
  }

  return (
    <View className='index-page'>
      {/* Type Toggle */}
      <View className='type-toggle'>
        <View
          className={`toggle-btn ${activeType === 'buy' ? 'active' : ''}`}
          onClick={() => { setActiveType('buy'); doSearch() }}
        >
          <Text>买房</Text>
        </View>
        <View
          className={`toggle-btn ${activeType === 'rent' ? 'active' : ''}`}
          onClick={() => { setActiveType('rent'); doSearch() }}
        >
          <Text>租房</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View className='search-bar'>
        <Input
          className='search-input'
          placeholder='搜索地址、城市、邮编...'
          value={keyword}
          onInput={(e) => handleInput(e.detail.value)}
          onConfirm={() => doSearch()}
        />
      </View>

      {/* Autocomplete Suggestions */}
      {suggestions.length > 0 && (
        <View className='suggestions'>
          {suggestions.map((s, i) => (
            <View key={i} className='suggestion-item' onClick={() => handleSuggestionClick(s)}>
              <Text>{s}</Text>
            </View>
          ))}
        </View>
      )}

      <ScrollView scrollY className='content-scroll'>
        {/* Hot Areas */}
        <View className='section'>
          <Text className='section-title'>热门区域</Text>
          <View className='area-grid'>
            {HOT_AREAS.map((area) => (
              <View key={area} className='area-item' onClick={() => handleAreaClick(area)}>
                <Text>{area}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Listings */}
        <View className='section'>
          <Text className='section-title'>
            {loading ? '加载中...' : `${activeType === 'buy' ? '在售' : '出租'}房源`}
          </Text>
          {listings.length === 0 && !loading && (
            <View className='empty-state'>
              <Text>暂无房源，试试搜索其他区域</Text>
            </View>
          )}
          {listings.map((item) => (
            <View key={item.id} className='listing-card' onClick={() => handleCardClick(item.id)}>
              {item.images && item.images.length > 0 && (
                <Image className='listing-image' src={item.images[0]} mode='aspectFill' />
              )}
              <View className='listing-info'>
                <Text className='listing-price'>{formatPrice(item.price)}</Text>
                <View className='listing-specs'>
                  <Text>{item.beds}卧 {item.baths}卫 {item.sqft}sqft</Text>
                </View>
                <Text className='listing-address'>{item.address}</Text>
                <Text className='listing-city'>{item.city}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
