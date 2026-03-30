import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
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

export default function AgentClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <View className='clients-page'>
      {loading ? (
        <View className='loading-wrap'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      ) : clients.length === 0 ? (
        <View className='empty-wrap'>
          <Text className='empty-text'>暂无客户</Text>
          <Text className='empty-hint'>分享小程序给客户，他们注册后会自动出现在这里</Text>
        </View>
      ) : (
        <ScrollView scrollY className='client-list'>
          {clients.map((c) => (
            <View key={c.id} className='client-card'>
              <View className='client-avatar'>
                <Text className='client-initial'>{(c.name || '客')[0]}</Text>
              </View>
              <View className='client-info'>
                <Text className='client-name'>{c.name || '未命名客户'}</Text>
                {c.phone && <Text className='client-phone'>{c.phone}</Text>}
              </View>
              <View className='status-badge' style={{ background: (STATUS_COLORS[c.status] || '#64748b') + '1a' }}>
                <Text className='status-text' style={{ color: STATUS_COLORS[c.status] || '#64748b' }}>{c.status || '新客户'}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
