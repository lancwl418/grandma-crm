import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useState } from 'react'
import { getAgentStats } from '../../utils/api'
import { getAgentSession, isLoggedIn, getRole, logout } from '../../utils/auth'
import './index.scss'

export default function AgentHome() {
  const [agentName, setAgentName] = useState('')
  const [agentUserId, setAgentUserId] = useState('')
  const [stats, setStats] = useState({ totalClients: 0, visitors: 0, interested: 0 })

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
        visitors: result.visitors || 0,
        interested: result.interested || 0
      })
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
    Taro.switchTab({ url: '/pages/search/index' })
  }

  const handleShare = () => {
    Taro.showShareMenu({ withShareTicket: true })
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          logout()
          Taro.redirectTo({ url: '/pages/login/index' })
        }
      }
    })
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
        </View>
      </View>

      {/* Stats Cards */}
      <View className='stats-row'>
        <View className='stat-card' onClick={goClients}>
          <Text className='stat-number'>{stats.totalClients}</Text>
          <Text className='stat-label'>客户总数</Text>
        </View>
        <View className='stat-card' onClick={goVisitors}>
          <Text className='stat-number'>{stats.visitors}</Text>
          <Text className='stat-label'>访客</Text>
        </View>
        <View className='stat-card'>
          <Text className='stat-number'>{stats.interested}</Text>
          <Text className='stat-label'>感兴趣</Text>
        </View>
      </View>

      {/* Share Button */}
      <View className='share-section'>
        <Button className='share-btn' openType='share' onClick={handleShare}>
          <Text className='share-btn-text'>生成推广链接</Text>
        </Button>
        <Text className='share-hint'>分享小程序给客户，自动关联到您的账号</Text>
      </View>

      {/* Quick Actions */}
      <View className='actions-section'>
        <Text className='section-title'>快捷操作</Text>
        <View className='action-list'>
          <View className='action-item' onClick={goClients}>
            <View className='action-icon-wrap blue-bg'>
              <Text className='action-icon-text'>客</Text>
            </View>
            <Text className='action-text'>客户管理</Text>
            <Text className='action-arrow'>{'>'}</Text>
          </View>
          <View className='action-item' onClick={goVisitors}>
            <View className='action-icon-wrap green-bg'>
              <Text className='action-icon-text'>访</Text>
            </View>
            <Text className='action-text'>访客记录</Text>
            <Text className='action-arrow'>{'>'}</Text>
          </View>
          <View className='action-item' onClick={goSearch}>
            <View className='action-icon-wrap orange-bg'>
              <Text className='action-icon-text'>搜</Text>
            </View>
            <Text className='action-text'>房源搜索</Text>
            <Text className='action-arrow'>{'>'}</Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <View className='logout-section'>
        <View className='logout-btn' onClick={handleLogout}>
          <Text className='logout-text'>退出登录</Text>
        </View>
      </View>
    </View>
  )
}
