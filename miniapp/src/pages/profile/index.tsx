import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { clientLoginByPhone, getBrowseHistory, getAgentInfo } from '../../utils/api'
import { getClientId, setClientId, getUserInfo, setUserInfo, clearAuth, isLoggedIn, getRole, type StoredUserInfo } from '../../utils/auth'
import './index.scss'

export default function Profile() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [userInfo, setLocalUserInfo] = useState<StoredUserInfo | null>(null)
  const [viewCount, setViewCount] = useState(0)
  const [favCount, setFavCount] = useState(0)
  const [agentName, setAgentName] = useState('')
  const [agentTitle, setAgentTitle] = useState('')
  const [agentAvatar, setAgentAvatar] = useState('')
  const [agentPhone, setAgentPhone] = useState('')

  useDidShow(() => {
    // If agent, redirect to agent home
    if (getRole() === 'agent') {
      Taro.redirectTo({ url: '/pages/agent/index' })
      return
    }
    const stored = getUserInfo()
    if (stored && isLoggedIn()) {
      setLoggedIn(true)
      setLocalUserInfo(stored)
      loadData(stored.id)
    }
  })

  const loadData = async (clientId: string) => {
    // Load browse history stats
    try {
      const res = await getBrowseHistory(clientId)
      const views = res.views || []
      setViewCount(views.filter((v: any) => v.action === 'view').length)
      setFavCount(views.filter((v: any) => v.action === 'favorite').length)
    } catch {
      // ignore
    }

    // Load agent info
    try {
      const agent = await getAgentInfo(clientId)
      setAgentName(agent.agentName || '')
      setAgentTitle(agent.agentTitle || '')
      setAgentAvatar(agent.agentAvatar || '')
      setAgentPhone(agent.agentPhone || '')
    } catch {
      // ignore
    }
  }

  const handleWechatLogin = () => {
    Taro.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        const info: StoredUserInfo = {
          id: 'wx_' + Date.now(),
          phone: '',
          name: res.userInfo.nickName,
          avatar: res.userInfo.avatarUrl
        }
        setClientId(info.id)
        setUserInfo(info)
        setLocalUserInfo(info)
        setLoggedIn(true)
        Taro.showToast({ title: '登录成功', icon: 'success' })
      },
      fail: () => {
        Taro.showToast({ title: '授权已取消', icon: 'none' })
      }
    })
  }

  const handlePhoneLogin = () => {
    Taro.showModal({
      title: '手机号登录',
      editable: true,
      placeholderText: '请输入手机号',
      success: async (res) => {
        if (res.confirm && res.content) {
          const phone = res.content.trim()
          if (!phone) return
          try {
            const result = await clientLoginByPhone(phone)
            if (result.clientId) {
              const info: StoredUserInfo = {
                id: result.clientId,
                phone,
                name: phone
              }
              setClientId(result.clientId)
              setUserInfo(info)
              setLocalUserInfo(info)
              setLoggedIn(true)
              loadData(result.clientId)
              Taro.showToast({ title: '登录成功', icon: 'success' })
            } else {
              Taro.showToast({ title: '未找到关联账号', icon: 'none' })
            }
          } catch {
            Taro.showToast({ title: '登录失败', icon: 'none' })
          }
        }
      }
    })
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          clearAuth()
          setLoggedIn(false)
          setLocalUserInfo(null)
          setViewCount(0)
          setFavCount(0)
          setAgentName('')
          Taro.showToast({ title: '已退出登录', icon: 'none' })
          setTimeout(() => {
            Taro.redirectTo({ url: '/pages/login/index' })
          }, 500)
        }
      }
    })
  }

  const goSearch = () => {
    Taro.switchTab({ url: '/pages/search/index' })
  }

  const contactAgent = () => {
    if (agentPhone) {
      Taro.makePhoneCall({ phoneNumber: agentPhone }).catch(() => {})
    } else {
      Taro.showToast({ title: '暂无经纪人电话', icon: 'none' })
    }
  }

  return (
    <View className='profile-page'>
      {/* Header */}
      <View className='profile-header'>
        {loggedIn && userInfo ? (
          <View className='header-user'>
            {userInfo.avatar ? (
              <Image className='header-avatar' src={userInfo.avatar} mode='aspectFill' />
            ) : (
              <View className='header-avatar-placeholder'>
                <Text className='avatar-letter'>{(userInfo.name || '用')[0]}</Text>
              </View>
            )}
            <Text className='header-name'>{userInfo.name || '用户'}</Text>
            {userInfo.phone && <Text className='header-phone'>{userInfo.phone}</Text>}
          </View>
        ) : (
          <View className='header-guest'>
            <View className='header-avatar-placeholder'>
              <Text className='avatar-letter'>?</Text>
            </View>
            <Text className='header-name'>未登录</Text>
            <Text className='header-subtitle'>登录后享受更多服务</Text>
          </View>
        )}
      </View>

      {/* Login buttons - show when not logged in */}
      {!loggedIn && (
        <View className='login-section'>
          <Button className='wechat-btn' onClick={handleWechatLogin}>
            <Text className='btn-text-white'>微信快捷登录</Text>
          </Button>
          <View className='phone-login-link' onClick={handlePhoneLogin}>
            <Text className='phone-link-text'>手机号登录</Text>
          </View>
        </View>
      )}

      {/* Stats Cards */}
      {loggedIn && (
        <View className='stats-section'>
          <View className='stats-card'>
            <View className='stat-item'>
              <Text className='stat-num'>{viewCount}</Text>
              <Text className='stat-label'>浏览记录</Text>
            </View>
            <View className='stat-divider' />
            <View className='stat-item'>
              <Text className='stat-num'>{favCount}</Text>
              <Text className='stat-label'>收藏</Text>
            </View>
          </View>
        </View>
      )}

      {/* Agent Card */}
      {loggedIn && agentName ? (
        <View className='section'>
          <Text className='section-label'>我的经纪人</Text>
          <View className='agent-card'>
            {agentAvatar ? (
              <Image className='agent-img' src={agentAvatar} mode='aspectFill' />
            ) : (
              <View className='agent-img-placeholder'>
                <Text className='agent-img-letter'>{agentName[0]}</Text>
              </View>
            )}
            <View className='agent-detail'>
              <Text className='agent-name-text'>{agentName}</Text>
              {agentTitle && <Text className='agent-title-text'>{agentTitle}</Text>}
            </View>
            {agentPhone && (
              <View className='agent-call-btn' onClick={contactAgent}>
                <Text className='call-btn-text'>拨打</Text>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {/* Menu Items */}
      <View className='menu-section'>
        <View className='menu-item' onClick={goSearch}>
          <Text className='menu-icon'>&#x1F50D;</Text>
          <Text className='menu-text'>搜索房源</Text>
          <Text className='menu-arrow'>{'>'}</Text>
        </View>
        {loggedIn && (
          <View className='menu-item'>
            <Text className='menu-icon'>&#x1F4C3;</Text>
            <Text className='menu-text'>浏览记录</Text>
            <Text className='menu-arrow'>{'>'}</Text>
          </View>
        )}
        <View className='menu-item' onClick={contactAgent}>
          <Text className='menu-icon'>&#x1F4DE;</Text>
          <Text className='menu-text'>联系经纪人</Text>
          <Text className='menu-arrow'>{'>'}</Text>
        </View>
      </View>

      {/* Logout */}
      {loggedIn && (
        <View className='logout-section'>
          <View className='logout-btn' onClick={handleLogout}>
            <Text className='logout-text'>退出登录</Text>
          </View>
        </View>
      )}
    </View>
  )
}
