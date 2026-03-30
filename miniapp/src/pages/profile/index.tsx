import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { clientLoginByPhone, registerClient, getBrowseHistory, getAgentInfo, AgentInfo } from '../../utils/api'
import { getClientId, setClientId, getUserInfo, setUserInfo, clearAuth, isLoggedIn, StoredUserInfo } from '../../utils/auth'
import './index.scss'

export default function Profile() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [userInfo, setLocalUserInfo] = useState<StoredUserInfo | null>(null)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [viewCount, setViewCount] = useState(0)
  const [agent, setAgent] = useState<AgentInfo | null>(null)
  const [showLogin, setShowLogin] = useState(false)

  useLoad(() => {
    const stored = getUserInfo()
    if (stored && isLoggedIn()) {
      setLoggedIn(true)
      setLocalUserInfo(stored)
      loadStats(stored.id)
    }
  })

  const loadStats = async (clientId: string) => {
    try {
      const res = await getBrowseHistory(clientId)
      setViewCount(res.history?.length || 0)
    } catch {
      // ignore
    }
  }

  const handleWechatLogin = () => {
    Taro.getUserProfile({
      desc: '用于完善用户资料',
      success: async (res) => {
        try {
          const result = await registerClient({
            name: res.userInfo.nickName,
            avatar: res.userInfo.avatarUrl
          })
          const info: StoredUserInfo = {
            id: result.id,
            phone: result.phone || '',
            name: res.userInfo.nickName,
            avatar: res.userInfo.avatarUrl
          }
          setClientId(result.id)
          setUserInfo(info)
          setLocalUserInfo(info)
          setLoggedIn(true)
          loadStats(result.id)
          Taro.showToast({ title: '登录成功', icon: 'success' })
        } catch {
          Taro.showToast({ title: '登录失败', icon: 'none' })
        }
      },
      fail: () => {
        Taro.showToast({ title: '授权已取消', icon: 'none' })
      }
    })
  }

  const handlePhoneLogin = async () => {
    if (!phone) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (!code) {
      Taro.showToast({ title: '请输入验证码', icon: 'none' })
      return
    }
    try {
      const result = await clientLoginByPhone(phone, code)
      const info: StoredUserInfo = {
        id: result.id,
        phone: result.phone,
        name: result.name,
        avatar: result.avatar
      }
      setClientId(result.id)
      setUserInfo(info)
      setLocalUserInfo(info)
      setLoggedIn(true)
      setShowLogin(false)
      loadStats(result.id)
      Taro.showToast({ title: '登录成功', icon: 'success' })
    } catch {
      Taro.showToast({ title: '登录失败', icon: 'none' })
    }
  }

  const handleLogout = () => {
    clearAuth()
    setLoggedIn(false)
    setLocalUserInfo(null)
    setViewCount(0)
    setAgent(null)
    Taro.showToast({ title: '已退出登录', icon: 'none' })
  }

  return (
    <View className='profile-page'>
      {loggedIn && userInfo ? (
        <View className='profile-content'>
          {/* User Card */}
          <View className='user-card'>
            <View className='user-header'>
              {userInfo.avatar ? (
                <Image className='user-avatar' src={userInfo.avatar} />
              ) : (
                <View className='user-avatar-placeholder'>
                  <Text>{(userInfo.name || '用户')[0]}</Text>
                </View>
              )}
              <View className='user-text'>
                <Text className='user-name'>{userInfo.name || '用户'}</Text>
                {userInfo.phone && <Text className='user-phone'>{userInfo.phone}</Text>}
              </View>
            </View>
          </View>

          {/* Stats */}
          <View className='stats-card'>
            <Text className='stats-title'>浏览统计</Text>
            <View className='stats-grid'>
              <View className='stat-item'>
                <Text className='stat-value'>{viewCount}</Text>
                <Text className='stat-label'>浏览房源</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-value'>0</Text>
                <Text className='stat-label'>收藏</Text>
              </View>
              <View className='stat-item'>
                <Text className='stat-value'>0</Text>
                <Text className='stat-label'>咨询</Text>
              </View>
            </View>
          </View>

          {/* Agent Card */}
          {agent && (
            <View className='agent-section'>
              <Text className='section-title'>我的经纪人</Text>
              <View className='agent-card'>
                {agent.avatar && <Image className='agent-avatar' src={agent.avatar} />}
                <View className='agent-text'>
                  <Text className='agent-name'>{agent.name}</Text>
                  {agent.title && <Text className='agent-title'>{agent.title}</Text>}
                  {agent.phone && <Text className='agent-phone'>{agent.phone}</Text>}
                </View>
              </View>
            </View>
          )}

          <Button className='logout-btn' onClick={handleLogout}>退出登录</Button>
        </View>
      ) : (
        <View className='login-content'>
          <View className='login-header'>
            <Text className='login-title'>Estate Epic</Text>
            <Text className='login-subtitle'>登录后享受更多服务</Text>
          </View>

          <Button className='wechat-login-btn' onClick={handleWechatLogin}>
            微信快捷登录
          </Button>

          <View className='divider'>
            <View className='divider-line' />
            <Text className='divider-text'>或</Text>
            <View className='divider-line' />
          </View>

          {showLogin ? (
            <View className='phone-login-form'>
              <Input
                className='form-input'
                placeholder='手机号'
                type='number'
                value={phone}
                onInput={(e) => setPhone(e.detail.value)}
              />
              <Input
                className='form-input'
                placeholder='验证码'
                type='number'
                value={code}
                onInput={(e) => setCode(e.detail.value)}
              />
              <Button className='phone-login-btn' onClick={handlePhoneLogin}>登录</Button>
              <View className='cancel-link' onClick={() => setShowLogin(false)}>
                <Text>取消</Text>
              </View>
            </View>
          ) : (
            <View className='phone-login-link' onClick={() => setShowLogin(true)}>
              <Text>手机号登录</Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}
