import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo } from 'react'
import { getAgentVisitors, getBrowseHistory } from '../../../utils/api'
import { getAgentSession, isLoggedIn, getRole } from '../../../utils/auth'
import AgentTabBar from '../../../components/AgentTabBar'
import './index.scss'

interface Visitor {
  clientId: string
  clientName: string
  lastActive: string
  viewCount: number
  hasInquiry?: boolean
}

const FILTER_TABS = ['所有访客', '活跃(7天内)', '感兴趣']

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function isWithin7Days(dateStr: string): boolean {
  if (!dateStr) return false
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  return (now - then) < 7 * 24 * 3600 * 1000
}

interface BrowseItem {
  zpid: string
  address: string
  price: number
  imageUrl: string
  createdAt: string
}

function formatPrice(price: number): string {
  if (!price) return ''
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`
  if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`
  return `$${price}`
}

export default function Visitors() {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('所有访客')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [browseCache, setBrowseCache] = useState<Record<string, BrowseItem[]>>({})

  useDidShow(() => {
    if (!isLoggedIn() || getRole() !== 'agent') {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }
    loadVisitors()
  })

  const loadVisitors = async () => {
    setLoading(true)
    try {
      const session = getAgentSession()
      if (!session) return
      const result = await getAgentVisitors(session.userId)
      setVisitors(result.visitors || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const filteredVisitors = useMemo(() => {
    if (activeTab === '活跃(7天内)') {
      return visitors.filter(v => isWithin7Days(v.lastActive))
    }
    if (activeTab === '感兴趣') {
      return visitors.filter(v => v.viewCount >= 5 || v.hasInquiry)
    }
    return visitors
  }, [visitors, activeTab])

  const toggleExpand = async (clientId: string) => {
    if (expandedId === clientId) {
      setExpandedId(null)
      return
    }
    setExpandedId(clientId)
    if (!browseCache[clientId]) {
      try {
        const res = await getBrowseHistory(clientId)
        const seen = new Set<string>()
        const mapped: any[] = []
        for (const v of res.views || []) {
          if (seen.has(v.zpid)) continue
          seen.add(v.zpid)
          mapped.push({ ...v, imageUrl: v.image_url || v.imageUrl || '' })
        }
        setBrowseCache(prev => ({ ...prev, [clientId]: mapped }))
      } catch {
        setBrowseCache(prev => ({ ...prev, [clientId]: [] }))
      }
    }
  }

  const goDetail = (clientId: string) => {
    Taro.navigateTo({ url: `/pages/agent/client-detail/index?clientId=${clientId}` })
  }

  const goListing = (zpid: string) => {
    Taro.navigateTo({ url: `/pages/detail/index?zpid=${zpid}` })
  }

  return (
    <View className='visitors-page'>
      {/* Filter Tabs */}
      <View className='filter-tabs'>
        {FILTER_TABS.map((tab) => (
          <View
            key={tab}
            className={`filter-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <Text className={`tab-text ${activeTab === tab ? 'active' : ''}`}>{tab}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View className='loading-wrap'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      ) : filteredVisitors.length === 0 ? (
        <View className='empty-wrap'>
          <Text className='empty-text'>暂无访客记录</Text>
          <Text className='empty-hint'>分享小程序给客户，他们的浏览记录将显示在这里</Text>
        </View>
      ) : (
        <ScrollView scrollY className='visitor-list'>
          <View className='list-count'>
            <Text className='count-text'>共 {filteredVisitors.length} 位访客</Text>
          </View>
          {filteredVisitors.map((v) => (
            <View key={v.clientId} className='visitor-card-wrap'>
              <View className='visitor-card' onClick={() => toggleExpand(v.clientId)}>
                <View className='visitor-avatar'>
                  <Text className='visitor-initial'>{(v.clientName || '访')[0]}</Text>
                </View>
                <View className='visitor-info'>
                  <View className='visitor-name-row'>
                    <Text className='visitor-name'>{v.clientName || '未知访客'}</Text>
                    {v.hasInquiry && (
                      <View className='inquiry-badge'>
                        <Text className='inquiry-text'>有咨询</Text>
                      </View>
                    )}
                  </View>
                  <Text className='visitor-meta'>最近活跃: {timeAgo(v.lastActive)}</Text>
                </View>
                <View className='visitor-right'>
                  <View className='visitor-badge'>
                    <Text className='badge-text'>{v.viewCount} 次浏览</Text>
                  </View>
                  <Text className='expand-arrow'>{expandedId === v.clientId ? '收起' : '展开'}</Text>
                </View>
              </View>
              {expandedId === v.clientId && (
                <View className='visitor-expanded'>
                  <View className='expanded-actions'>
                    <View className='expanded-action-btn' onClick={() => goDetail(v.clientId)}>
                      <Text className='action-btn-text'>查看详情</Text>
                    </View>
                  </View>
                  {browseCache[v.clientId] && browseCache[v.clientId].length > 0 ? (
                    <View className='browse-section'>
                      <Text className='browse-title'>浏览记录</Text>
                      <ScrollView scrollX className='browse-scroll'>
                        {browseCache[v.clientId].map((item, i) => (
                          <View key={i} className='browse-card' onClick={() => goListing(item.zpid)}>
                            {item.imageUrl ? (
                              <Image className='browse-image' src={item.imageUrl} mode='aspectFill' lazyLoad />
                            ) : (
                              <View className='browse-image browse-placeholder'>
                                <Text className='browse-placeholder-text'>暂无图片</Text>
                              </View>
                            )}
                            <View className='browse-info'>
                              <Text className='browse-price'>{formatPrice(item.price)}</Text>
                              <Text className='browse-addr'>{item.address}</Text>
                            </View>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  ) : browseCache[v.clientId] ? (
                    <View className='browse-empty'>
                      <Text className='browse-empty-text'>暂无浏览记录</Text>
                    </View>
                  ) : (
                    <View className='browse-empty'>
                      <Text className='browse-empty-text'>加载中...</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}
          <View className='bottom-spacer' />
        </ScrollView>
      )}
      <AgentTabBar current={1} />
    </View>
  )
}
