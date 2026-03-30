import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getAgentInfo, getBrowseHistory } from '../../utils/api'
import { getClientId, isLoggedIn, getRole } from '../../utils/auth'
import './index.scss'

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

interface FavoriteItem {
  zpid: string
  address: string
  price: number
  imageUrl?: string
  action?: string
}

export default function Home() {
  const [agentName, setAgentName] = useState('')
  const [agentAvatar, setAgentAvatar] = useState('')
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [recentViews, setRecentViews] = useState<FavoriteItem[]>([])

  useDidShow(() => {
    // Redirect if not logged in
    if (!isLoggedIn()) {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }
    // If agent, redirect to agent home
    if (getRole() === 'agent') {
      Taro.redirectTo({ url: '/pages/agent/index' })
      return
    }
    loadData()
  })

  const loadData = async () => {
    // Load search history
    try {
      const history: string[] = Taro.getStorageSync('search_history') || []
      setSearchHistory(history.slice(0, 5))
    } catch {
      // ignore
    }

    // Load agent info and favorites
    const clientId = getClientId()
    if (clientId) {
      try {
        const agent = await getAgentInfo(clientId)
        setAgentName(agent.agentName || '')
        setAgentAvatar(agent.agentAvatar || '')
      } catch {
        // ignore
      }

      try {
        const res = await getBrowseHistory(clientId)
        const views = res.views || []
        // Favorites
        const favs = views.filter((v: any) => v.action === 'favorite')
        setFavorites(favs.slice(0, 10))
        // Recently viewed (deduplicate by zpid)
        const seen = new Set<string>()
        const recent: FavoriteItem[] = []
        for (const v of views) {
          if (!seen.has(v.zpid)) {
            seen.add(v.zpid)
            recent.push(v)
          }
          if (recent.length >= 10) break
        }
        setRecentViews(recent)
      } catch {
        // ignore
      }
    }
  }

  const goSearch = (keyword?: string) => {
    if (keyword) {
      // Save to search history
      try {
        let history: string[] = Taro.getStorageSync('search_history') || []
        history = [keyword, ...history.filter(h => h !== keyword)].slice(0, 10)
        Taro.setStorageSync('search_history', history)
      } catch {
        // ignore
      }
    }
    Taro.switchTab({ url: '/pages/search/index' })
    // Store pre-fill location for search page
    if (keyword) {
      Taro.setStorageSync('search_prefill', keyword)
    }
  }

  const goDetail = (item: FavoriteItem) => {
    Taro.navigateTo({
      url: `/pages/detail/index?zpid=${item.zpid}&address=${encodeURIComponent(item.address)}&price=${item.price}&imageUrl=${encodeURIComponent(item.imageUrl || '')}`
    })
  }

  const clearHistory = () => {
    Taro.setStorageSync('search_history', [])
    setSearchHistory([])
    Taro.showToast({ title: '已清除', icon: 'none' })
  }

  const formatPrice = (price: number) => {
    if (!price) return ''
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`
    if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`
    return `$${price}`
  }

  return (
    <ScrollView scrollY className='home-page'>
      {/* Logo Area */}
      <View className='logo-area'>
        <View className='logo-row'>
          <View className='logo-icon'>
            <Text className='logo-letter'>E</Text>
          </View>
          <View className='logo-text-wrap'>
            <Text className='logo-title'>Estate Epic</Text>
            <Text className='logo-subtitle'>您的智能找房助手</Text>
          </View>
        </View>
      </View>

      {/* Agent Card */}
      {agentName ? (
        <View className='agent-card'>
          <View className='agent-row'>
            {agentAvatar ? (
              <Image className='agent-avatar' src={agentAvatar} mode='aspectFill' />
            ) : (
              <View className='agent-avatar-placeholder'>
                <Text className='agent-initial'>{agentName[0]}</Text>
              </View>
            )}
            <View className='agent-info'>
              <Text className='agent-name'>{agentName}</Text>
              <Text className='agent-label'>您的专属经纪人</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Quick Search */}
      <View className='quick-search' onClick={() => goSearch()}>
        <View className='search-placeholder-bar'>
          <Text className='search-icon-text'>&#x1F50D;</Text>
          <Text className='search-placeholder-text'>搜索城市、邮编或地址...</Text>
        </View>
      </View>

      {/* Recent Searches */}
      {searchHistory.length > 0 && (
        <View className='section'>
          <View className='section-header'>
            <Text className='section-title'>最近搜索</Text>
            <Text className='section-action' onClick={clearHistory}>清除</Text>
          </View>
          <View className='history-tags'>
            {searchHistory.map((item, i) => (
              <View key={i} className='history-tag' onClick={() => goSearch(item)}>
                <Text className='history-tag-text'>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Recently Viewed */}
      {recentViews.length > 0 && (
        <View className='section'>
          <Text className='section-title'>最近浏览</Text>
          <ScrollView scrollX className='favorites-scroll' enhanced showScrollbar={false}>
            {recentViews.map((item, i) => (
              <View key={i} className='favorite-card' onClick={() => goDetail(item)}>
                {item.imageUrl ? (
                  <Image className='favorite-image' src={item.imageUrl} mode='aspectFill' lazyLoad />
                ) : (
                  <View className='favorite-image-placeholder'>
                    <Text className='placeholder-text'>暂无图片</Text>
                  </View>
                )}
                <View className='favorite-info'>
                  <Text className='favorite-price'>{formatPrice(item.price)}</Text>
                  <Text className='favorite-address'>{item.address}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Favorites */}
      {favorites.length > 0 && (
        <View className='section'>
          <Text className='section-title'>最近收藏</Text>
          <ScrollView scrollX className='favorites-scroll' enhanced showScrollbar={false}>
            {favorites.map((item, i) => (
              <View key={i} className='favorite-card' onClick={() => goDetail(item)}>
                {item.imageUrl ? (
                  <Image className='favorite-image' src={item.imageUrl} mode='aspectFill' lazyLoad />
                ) : (
                  <View className='favorite-image-placeholder'>
                    <Text className='placeholder-text'>暂无图片</Text>
                  </View>
                )}
                <View className='favorite-info'>
                  <Text className='favorite-price'>{formatPrice(item.price)}</Text>
                  <Text className='favorite-address'>{item.address}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Hot Areas */}
      <View className='section'>
        <Text className='section-title'>热门区域</Text>
        <View className='area-grid'>
          {HOT_AREAS.map((area) => (
            <View key={area.name} className='area-item' onClick={() => goSearch(area.label)}>
              <Text className='area-name'>{area.name}</Text>
              <Text className='area-state'>CA</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='bottom-spacer' />
    </ScrollView>
  )
}
