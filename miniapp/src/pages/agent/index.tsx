import { View, Text, Button, ScrollView, Image, Swiper, SwiperItem } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useState } from 'react'
import { Notice, Share, Edit, Search, Category, Star, Service } from '@nutui/icons-react-taro'
import { getAgentStats, getAgentActivity, getAgentFullProfile } from '../../utils/api'
import { getAgentSession, isLoggedIn, getRole } from '../../utils/auth'
import AgentTabBar from '../../components/AgentTabBar'
import './index.scss'

interface Activity {
  clientId: string
  zpid?: string
  clientName: string
  action: string
  address: string
  imageUrl?: string
  createdAt: string
}

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

export default function AgentHome() {
  const [agentName, setAgentName] = useState('')
  const [agentTitle, setAgentTitle] = useState('')
  const [agentAvatar, setAgentAvatar] = useState('')
  const [agentUserId, setAgentUserId] = useState('')
  const [stats, setStats] = useState({ totalClients: 0, newThisMonth: 0, visitors: 0, interested: 0 })
  const [activities, setActivities] = useState<Activity[]>([])

  useDidShow(() => {
    if (!isLoggedIn() || getRole() !== 'agent') {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }
    const session = getAgentSession()
    if (session) {
      setAgentName(session.displayName || session.email)
      setAgentUserId(session.userId)
      loadStats(session.userId)
      loadActivity(session.userId)
      // Load avatar
      getAgentFullProfile(session.userId).then((p) => {
        if (p.avatarUrl) setAgentAvatar(p.avatarUrl)
        setAgentTitle((p.title || '').trim())
      }).catch(() => {})
    }
  })

  useShareAppMessage(() => {
    return {
      title: `${agentName}邀请您使用小程序找房`,
      path: `/pages/login/index?agentId=${agentUserId}`
    }
  })

  const loadStats = async (userId: string) => {
    try {
      const result = await getAgentStats(userId)
      setStats({
        totalClients: result.totalClients || 0,
        newThisMonth: result.newThisMonth || 0,
        visitors: result.visitors || 0,
        interested: result.interested || 0
      })
    } catch {
      // ignore
    }
  }

  const loadActivity = async (userId: string) => {
    try {
      const result = await getAgentActivity(userId)
      const seenViewKeys = new Set<string>()
      const deduped = (result.activities || []).filter((item) => {
        if (item.action !== '浏览了') return true
        const propertyKey = (item.zpid || item.address || '').trim().toLowerCase()
        if (!propertyKey) return true
        const key = `${item.clientId}::${propertyKey}`
        if (seenViewKeys.has(key)) return false
        seenViewKeys.add(key)
        return true
      })
      setActivities(deduped)
    } catch {
      // ignore
    }
  }

  const goVisitors = () => {
    Taro.navigateTo({ url: '/pages/agent/visitors/index' })
  }

  const goClients = () => {
    Taro.navigateTo({ url: '/pages/agent/clients/index' })
  }

  const goSearch = () => {
    Taro.navigateTo({ url: '/pages/agent/search/index' })
  }

  const goProfile = () => {
    Taro.navigateTo({ url: '/pages/agent/profile/index' })
  }

  const goMarketing = () => {
    Taro.redirectTo({ url: '/pages/agent/marketing/index' })
  }

  const showToastSoon = () => {
    Taro.showToast({ title: '即将上线', icon: 'none' })
  }

  const sharePath = `/pages/login/index?agentId=${agentUserId}`

  return (
    <View className='agent-page'>
      <ScrollView scrollY className='agent-scroll'>
        <View className='agent-topbar'>
          <View className='brand-left'>
            {agentAvatar ? (
              <Image className='brand-avatar' src={agentAvatar} mode='aspectFill' />
            ) : (
              <View className='brand-avatar brand-avatar-fallback'>
                <Text className='brand-avatar-text'>{agentName ? agentName[0] : '经'}</Text>
              </View>
            )}
            <View className='brand-text-wrap'>
              <Text className='brand-title'>经纪人工作台</Text>
              <Text className='brand-subtitle'>欢迎回来，{agentName || '经纪人'}</Text>
            </View>
          </View>
          <View className='brand-notice'>
            <Notice size={16} fallback />
          </View>
        </View>

        <View className='profile-card'>
          {agentAvatar ? (
            <Image className='profile-avatar' src={agentAvatar} mode='aspectFill' />
          ) : (
            <View className='profile-avatar profile-avatar-fallback'>
              <Text className='profile-avatar-text'>{agentName ? agentName[0] : '经'}</Text>
            </View>
          )}
          <Text className='profile-name'>{agentName || '经纪人'}</Text>
          <Text className='profile-subtitle'>{agentTitle || '资深置业顾问'}</Text>

          <View className='profile-actions'>
            <Button className='profile-btn' openType='share'>
              <View className='profile-btn-inner'>
                <Share size={14} fallback />
                <Text className='profile-btn-text'>分享</Text>
              </View>
            </Button>
            <View className='profile-btn' onClick={goProfile}>
              <View className='profile-btn-inner'>
                <Edit size={14} fallback />
                <Text className='profile-btn-text'>编辑资料</Text>
              </View>
            </View>
          </View>
        </View>

        <View className='stats-grid'>
          <View className='stats-card' onClick={goClients}>
            <Text className='stats-label'>客户总数</Text>
            <Text className='stats-value'>{stats.totalClients.toLocaleString()}</Text>
          </View>
          <View className='stats-card'>
            <Text className='stats-label'>本月新增</Text>
            <View className='stats-inline'>
              <Text className='stats-value'>{stats.newThisMonth}</Text>
              <Text className='stats-trend'>+12%</Text>
            </View>
          </View>
          <View className='stats-card' onClick={goVisitors}>
            <Text className='stats-label'>访客人数</Text>
            <Text className='stats-value'>{stats.visitors.toLocaleString()}</Text>
          </View>
          <View className='stats-card'>
            <Text className='stats-label'>高意向客户</Text>
            <Text className='stats-value'>{stats.interested.toLocaleString()}</Text>
          </View>
        </View>

        <View className='toolkit-section'>
          <Text className='section-kicker'>常用工具</Text>
          <View className='toolkit-grid'>
            <View className='toolkit-card' onClick={goSearch}>
              <View className='toolkit-icon'><Search size={18} fallback /></View>
              <Text className='toolkit-title'>房源搜索</Text>
              <Text className='toolkit-subtitle'>房源搜索</Text>
            </View>
            <View className='toolkit-card' onClick={goVisitors}>
              <View className='toolkit-icon'><Category size={18} fallback /></View>
              <Text className='toolkit-title'>任务看板</Text>
              <Text className='toolkit-subtitle'>任务看板</Text>
            </View>
            <View className='toolkit-card' onClick={goMarketing}>
              <View className='toolkit-icon'><Service size={18} fallback /></View>
              <Text className='toolkit-title'>营销中心</Text>
              <Text className='toolkit-subtitle'>营销中心</Text>
            </View>
            <View className='toolkit-card highlight' onClick={showToastSoon}>
              <View className='toolkit-icon'><Star size={18} fallback /></View>
              <Text className='toolkit-title'>智能助手</Text>
              <Text className='toolkit-subtitle'>即将上线</Text>
            </View>
          </View>
        </View>

        <View className='growth-card'>
          <Text className='growth-title'>拓展您的客户网络，精准分享优质房源</Text>
          <Text className='growth-desc'>客户拉新：分享小程序给客户，登录后自动关联到你的账号</Text>
          <Button className='growth-share-btn' openType='share'>
            <Text className='growth-share-text'>分享推广入口</Text>
          </Button>
          <Text className='growth-path'>{sharePath}</Text>
        </View>

        <View className='insights-section'>
          <View className='insights-head'>
            <Text className='section-kicker'>最近动态</Text>
            <Text className='view-all' onClick={goVisitors}>查看全部</Text>
          </View>
          {activities.length > 0 ? (
            <View className='insights-slider-wrap'>
              <Swiper
                className='insights-slider'
                indicatorDots={false}
                circular={activities.length > 1}
                autoplay={activities.length > 1}
                interval={3500}
                duration={450}
              >
                {activities.slice(0, 8).map((a, i) => (
                  <SwiperItem key={`${a.clientId}-${i}`}>
                    <View
                      className='insight-slide-card'
                      onClick={() => Taro.navigateTo({ url: `/pages/agent/client-detail/index?clientId=${a.clientId}` })}
                    >
                      {a.imageUrl ? (
                        <Image className='insight-avatar' src={a.imageUrl} mode='aspectFill' />
                      ) : (
                        <View className='insight-avatar insight-avatar-fallback'>
                          <Text className='insight-avatar-text'>{a.clientName ? a.clientName[0] : '客'}</Text>
                        </View>
                      )}
                      <View className='insight-main'>
                        <Text className='insight-line'>
                          <Text className='insight-name'>{a.clientName}</Text>
                          {' '}
                          {a.action}
                          {' '}
                          <Text className='insight-address'>{a.address}</Text>
                        </Text>
                        <Text className='insight-time'>{timeAgo(a.createdAt)}</Text>
                      </View>
                    </View>
                  </SwiperItem>
                ))}
              </Swiper>
            </View>
          ) : (
            <View className='insight-empty'>
              <Text className='insight-empty-text'>暂无动态，分享给客户后这里会显示访问记录</Text>
            </View>
          )}
        </View>

        <View className='bottom-spacer' />
      </ScrollView>

      <AgentTabBar current={0} />
    </View>
  )
}
