import { View, Text, Input, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getAgentFullProfile, updateAgentProfile } from '../../../utils/api'
import { getAgentSession, isLoggedIn, getRole, logout } from '../../../utils/auth'
import AgentTabBar from '../../../components/AgentTabBar'
import './index.scss'

export default function AgentProfile() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [wechat, setWechat] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  useDidShow(() => {
    if (!isLoggedIn() || getRole() !== 'agent') {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }
    loadProfile()
  })

  const loadProfile = async () => {
    setLoading(true)
    try {
      const session = getAgentSession()
      if (!session) return
      const profile = await getAgentFullProfile(session.userId)
      setUsername(profile.username || '')
      setDisplayName(profile.displayName || '')
      setPhone(profile.phone || '')
      setWechat(profile.wechat || '')
      setEmail(profile.email || '')
      setTitle(profile.title || '')
      setAvatarUrl(profile.avatarUrl || '')
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!displayName.trim()) {
      Taro.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      const session = getAgentSession()
      if (!session) return
      await updateAgentProfile(session.userId, {
        displayName: displayName.trim(),
        phone: phone.trim(),
        wechat: wechat.trim(),
        email: email.trim(),
        title: title.trim(),
      })
      Taro.showToast({ title: '保存成功', icon: 'success' })
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
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

  if (loading) {
    return (
      <View className='profile-page'>
        <View className='loading-wrap'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='profile-page'>
      <ScrollView scrollY className='profile-scroll'>
        {/* Avatar Section */}
        <View className='avatar-section'>
          {avatarUrl ? (
            <Image className='avatar-image' src={avatarUrl} mode='aspectFill' />
          ) : (
            <View className='avatar-large'>
              <Text className='avatar-letter'>{(displayName || username || 'A')[0]}</Text>
            </View>
          )}
          {avatarUrl ? (
            <Text className='avatar-hint'>WeChat 头像</Text>
          ) : (
            <Text className='avatar-hint'>默认头像</Text>
          )}
        </View>

        {/* Form */}
        <View className='form-section'>
          <View className='form-group'>
            <Text className='form-label'>用户名</Text>
            <View className='form-input-wrap readonly'>
              <Text className='form-readonly'>{username || '-'}</Text>
            </View>
          </View>

          <View className='form-group'>
            <Text className='form-label'>姓名 *</Text>
            <View className='form-input-wrap'>
              <Input
                className='form-input'
                placeholder='请输入姓名'
                value={displayName}
                onInput={(e) => setDisplayName(e.detail.value)}
              />
            </View>
          </View>

          <View className='form-group'>
            <Text className='form-label'>职称</Text>
            <View className='form-input-wrap'>
              <Input
                className='form-input'
                placeholder='如: 资深房产经纪人'
                value={title}
                onInput={(e) => setTitle(e.detail.value)}
              />
            </View>
          </View>

          <View className='form-group'>
            <Text className='form-label'>电话</Text>
            <View className='form-input-wrap'>
              <Input
                className='form-input'
                placeholder='请输入电话号码'
                type='number'
                value={phone}
                onInput={(e) => setPhone(e.detail.value)}
              />
            </View>
          </View>

          <View className='form-group'>
            <Text className='form-label'>微信</Text>
            <View className='form-input-wrap'>
              <Input
                className='form-input'
                placeholder='请输入微信号'
                value={wechat}
                onInput={(e) => setWechat(e.detail.value)}
              />
            </View>
          </View>

          <View className='form-group'>
            <Text className='form-label'>邮箱</Text>
            <View className='form-input-wrap'>
              <Input
                className='form-input'
                placeholder='请输入邮箱地址'
                value={email}
                onInput={(e) => setEmail(e.detail.value)}
              />
            </View>
          </View>
        </View>

        {/* Save Button */}
        <View className='button-section'>
          <View className={`save-btn ${saving ? 'disabled' : ''}`} onClick={saving ? undefined : handleSave}>
            <Text className='save-btn-text'>{saving ? '保存中...' : '保存修改'}</Text>
          </View>
        </View>

        {/* Logout */}
        <View className='button-section'>
          <View className='logout-btn' onClick={handleLogout}>
            <Text className='logout-text'>退出登录</Text>
          </View>
        </View>

        <View className='bottom-spacer' />
      </ScrollView>
      <AgentTabBar current={4} />
    </View>
  )
}
