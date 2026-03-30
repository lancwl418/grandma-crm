import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo } from 'react'
import { getAgentVisitors } from '../../../utils/api'
import { getAgentSession, isLoggedIn, getRole } from '../../../utils/auth'
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

export default function Visitors() {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('所有访客')

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

  const goDetail = (clientId: string) => {
    Taro.navigateTo({ url: `/pages/agent/client-detail/index?clientId=${clientId}` })
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
            <View key={v.clientId} className='visitor-card' onClick={() => goDetail(v.clientId)}>
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
                <Text className='detail-link'>查看详情 {'>'}</Text>
              </View>
            </View>
          ))}
          <View className='bottom-spacer' />
        </ScrollView>
      )}
    </View>
  )
}
