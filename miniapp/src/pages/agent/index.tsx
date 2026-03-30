import { View, Text, Button, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useState } from 'react'
import { getAgentStats, getAgentActivity } from '../../utils/api'
import { getAgentSession, isLoggedIn, getRole } from '../../utils/auth'
import './index.scss'

interface Activity {
  clientId: string
  clientName: string
  action: string
  address: string
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
    }
  })

  useShareAppMessage(() => {
    return {
      title: `${agentName}邀请您使用 Estate Epic 找房`,
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
      setActivities(result.activities || [])
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

  return (
    <View className='agent-page'>
      {/* Header */}
      <View className='agent-header'>
        <View className='header-content'>
          <View className='avatar-circle'>
            <Text className='avatar-text'>{agentName ? agentName[0] : 'A'}</Text>
          </View>
          <View className='header-info'>
            <Text className='welcome-text'>欢迎回来</Text>
            <Text className='agent-name-text'>{agentName || '经纪人'}</Text>
          </View>
          <View className='header-actions'>
            <Button className='header-share-btn' openType='share'>
              <Text className='header-share-text'>分享</Text>
            </Button>
          </View>
        </View>

        {/* Stats Cards — inside header */}
        <View className='stats-row'>
          <View className='stat-card' onClick={goClients}>
            <Text className='stat-number'>{stats.totalClients}</Text>
            <Text className='stat-label'>客户总数</Text>
          </View>
          <View className='stat-card'>
            <Text className='stat-number stat-green'>{stats.newThisMonth}</Text>
            <Text className='stat-label'>本月新增</Text>
          </View>
          <View className='stat-card' onClick={goVisitors}>
            <Text className='stat-number stat-orange'>{stats.visitors}</Text>
            <Text className='stat-label'>访客</Text>
          </View>
          <View className='stat-card'>
            <Text className='stat-number stat-red'>{stats.interested}</Text>
            <Text className='stat-label'>感兴趣</Text>
          </View>
        </View>
      </View>

      <ScrollView scrollY className='agent-scroll'>
        {/* Quick Actions Grid */}
        <View className='actions-section'>
          <Text className='section-title'>快捷操作</Text>
          <View className='action-grid'>
            <View className='grid-item' onClick={goClients}>
              <View className='grid-icon blue-bg'>
                <Text className='grid-icon-text'>客</Text>
              </View>
              <Text className='grid-label'>客户管理</Text>
            </View>
            <View className='grid-item' onClick={goVisitors}>
              <View className='grid-icon green-bg'>
                <Text className='grid-icon-text grid-green'>访</Text>
              </View>
              <Text className='grid-label'>访客记录</Text>
            </View>
            <View className='grid-item' onClick={goSearch}>
              <View className='grid-icon orange-bg'>
                <Text className='grid-icon-text grid-orange'>搜</Text>
              </View>
              <Text className='grid-label'>房源搜索</Text>
            </View>
            <View className='grid-item' onClick={goProfile}>
              <View className='grid-icon purple-bg'>
                <Text className='grid-icon-text grid-purple'>我</Text>
              </View>
              <Text className='grid-label'>个人资料</Text>
            </View>
          </View>
        </View>

        {/* Share Section */}
        <View className='share-section'>
          <Button className='share-btn' openType='share'>
            <Text className='share-btn-text'>生成推广链接</Text>
          </Button>
          <Text className='share-hint'>分享小程序给客户，自动关联到您的账号</Text>
        </View>

        {/* Activity Feed */}
        <View className='activity-section'>
          <Text className='section-title'>最近动态</Text>
          {activities.length === 0 ? (
            <View className='activity-empty'>
              <Text className='activity-empty-text'>暂无客户动态</Text>
            </View>
          ) : (
            <View className='activity-list'>
              {activities.map((a, i) => (
                <View
                  key={i}
                  className='activity-item'
                  onClick={() => Taro.navigateTo({ url: `/pages/agent/client-detail/index?clientId=${a.clientId}` })}
                >
                  <View className='activity-dot' />
                  <View className='activity-content'>
                    <Text className='activity-text'>
                      <Text className='activity-name'>{a.clientName}</Text>
                      {' '}{a.action}{' '}
                      <Text className='activity-address'>{a.address}</Text>
                    </Text>
                    <Text className='activity-time'>{timeAgo(a.createdAt)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className='bottom-spacer' />
      </ScrollView>
    </View>
  )
}
