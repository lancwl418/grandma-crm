import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getAgentVisitors } from '../../../utils/api'
import { getAgentSession, isLoggedIn, getRole } from '../../../utils/auth'
import './index.scss'

interface Visitor {
  clientId: string
  clientName: string
  lastActive: string
  viewCount: number
}

export default function Visitors() {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [loading, setLoading] = useState(true)

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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <View className='visitors-page'>
      {loading ? (
        <View className='loading-wrap'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      ) : visitors.length === 0 ? (
        <View className='empty-wrap'>
          <Text className='empty-text'>暂无访客记录</Text>
          <Text className='empty-hint'>分享小程序给客户，他们的浏览记录将显示在这里</Text>
        </View>
      ) : (
        <ScrollView scrollY className='visitor-list'>
          {visitors.map((v) => (
            <View key={v.clientId} className='visitor-card'>
              <View className='visitor-avatar'>
                <Text className='visitor-initial'>{(v.clientName || '访')[0]}</Text>
              </View>
              <View className='visitor-info'>
                <Text className='visitor-name'>{v.clientName || '未知访客'}</Text>
                <Text className='visitor-meta'>最近活跃: {formatDate(v.lastActive)}</Text>
              </View>
              <View className='visitor-badge'>
                <Text className='badge-text'>{v.viewCount} 次浏览</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
