import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo } from 'react'
import { getAgentClients } from '../../../utils/api'
import { getAgentSession, isLoggedIn, getRole } from '../../../utils/auth'
import './index.scss'

interface Client {
  id: string
  name: string
  phone: string
  status: string
  urgency: string
}

const STATUS_COLORS: Record<string, string> = {
  '新客户': '#3b82f6',
  '看房中': '#f59e0b',
  '意向强烈': '#ef4444',
  '已下 Offer': '#8b5cf6',
  '已成交': '#10b981',
  '停滞': '#64748b',
  '暂缓': '#94a3b8',
}

const URGENCY_LABELS: Record<string, { text: string; color: string }> = {
  high: { text: '高', color: '#ef4444' },
  medium: { text: '中', color: '#f59e0b' },
  low: { text: '低', color: '#94a3b8' },
}

const FILTER_TABS = ['全部', '看房中', '意向强烈', '已成交']

export default function AgentClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState('全部')

  useDidShow(() => {
    if (!isLoggedIn() || getRole() !== 'agent') {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }
    loadClients()
  })

  const loadClients = async () => {
    setLoading(true)
    try {
      const session = getAgentSession()
      if (!session) return
      const result = await getAgentClients(session.userId)
      setClients(result.clients || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const filteredClients = useMemo(() => {
    let list = clients
    if (activeTab !== '全部') {
      list = list.filter(c => c.status === activeTab)
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      )
    }
    return list
  }, [clients, activeTab, searchText])

  const goDetail = (clientId: string) => {
    Taro.navigateTo({ url: `/pages/agent/client-detail/index?clientId=${clientId}` })
  }

  return (
    <View className='clients-page'>
      {/* Search Bar */}
      <View className='search-bar'>
        <View className='search-input-wrap'>
          <Text className='search-icon'>&#x1F50D;</Text>
          <Input
            className='search-input'
            placeholder='搜索客户姓名或手机号...'
            value={searchText}
            onInput={(e) => setSearchText(e.detail.value)}
          />
        </View>
      </View>

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
      ) : filteredClients.length === 0 ? (
        <View className='empty-wrap'>
          <Text className='empty-text'>
            {searchText ? '未找到匹配客户' : activeTab !== '全部' ? `暂无${activeTab}客户` : '暂无客户'}
          </Text>
          <Text className='empty-hint'>分享小程序给客户，他们注册后会自动出现在这里</Text>
        </View>
      ) : (
        <ScrollView scrollY className='client-list'>
          <View className='list-count'>
            <Text className='count-text'>共 {filteredClients.length} 位客户</Text>
          </View>
          {filteredClients.map((c) => {
            const urgencyInfo = URGENCY_LABELS[c.urgency] || URGENCY_LABELS.medium
            return (
              <View key={c.id} className='client-card' onClick={() => goDetail(c.id)}>
                <View className='client-avatar'>
                  <Text className='client-initial'>{(c.name || '客')[0]}</Text>
                </View>
                <View className='client-info'>
                  <View className='client-name-row'>
                    <Text className='client-name'>{c.name || '未命名客户'}</Text>
                    <View className='urgency-dot' style={{ background: urgencyInfo.color }} />
                  </View>
                  {c.phone && <Text className='client-phone'>{c.phone}</Text>}
                </View>
                <View className='status-badge' style={{ background: (STATUS_COLORS[c.status] || '#64748b') + '1a' }}>
                  <Text className='status-text' style={{ color: STATUS_COLORS[c.status] || '#64748b' }}>{c.status || '新客户'}</Text>
                </View>
                <Text className='card-arrow'>{'>'}</Text>
              </View>
            )
          })}
          <View className='bottom-spacer' />
        </ScrollView>
      )}
    </View>
  )
}
