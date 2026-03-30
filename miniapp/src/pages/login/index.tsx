import { View, Text, Input, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { registerClient, wxLogin, agentBind, agentRegister } from '../../utils/api'
import {
  setClientId, setUserInfo, setRole, setAgentSession,
  setOpenid, isLoggedIn, getRole
} from '../../utils/auth'
import './index.scss'

type Step = 'wx' | 'role' | 'customer-done' | 'agent-choice' | 'agent-bind' | 'agent-register'

export default function Login() {
  const [step, setStep] = useState<Step>('wx')
  const [loading, setLoading] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)

  // WeChat profile info (set after Step 1)
  const [nickName, setNickName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [openid, setOpenidState] = useState('')

  // Agent bind fields
  const [bindUsername, setBindUsername] = useState('')

  // Agent register fields
  const [regUsername, setRegUsername] = useState('')
  const [regDisplayName, setRegDisplayName] = useState('')

  useEffect(() => {
    if (isLoggedIn()) {
      const role = getRole()
      if (role === 'agent') {
        Taro.redirectTo({ url: '/pages/agent/index' })
      } else {
        Taro.switchTab({ url: '/pages/home/index' })
      }
      return
    }

    const launchOptions = Taro.getLaunchOptionsSync()
    const query = launchOptions && launchOptions.query ? launchOptions.query : null
    if (query && query.agentId) {
      setAgentId(query.agentId)
    }

    const instance = Taro.getCurrentInstance()
    const params = instance && instance.router ? instance.router.params : null
    if (params && params.agentId) {
      setAgentId(params.agentId)
    }
  }, [])

  const redirectAgent = useCallback((userId: string, displayName: string) => {
    setAgentSession({ userId, email: '', displayName })
    setRole('agent')
    Taro.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      Taro.redirectTo({ url: '/pages/agent/index' })
    }, 500)
  }, [])

  const redirectCustomer = useCallback((clientId: string, name: string, avatar: string) => {
    setClientId(clientId)
    setUserInfo({ id: clientId, phone: '', name, avatar })
    setRole('customer')
    Taro.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      Taro.switchTab({ url: '/pages/home/index' })
    }, 500)
  }, [])

  // Step 1: WeChat login
  const handleWxLogin = () => {
    Taro.getUserProfile({
      desc: '用于完善用户资料',
      success: (profileRes) => {
        const name = profileRes.userInfo.nickName || '微信用户'
        const avatar = profileRes.userInfo.avatarUrl || ''
        setNickName(name)
        setAvatarUrl(avatar)
        setRegUsername(name)
        setRegDisplayName(name)

        setLoading(true)
        Taro.login({
          success: async (loginRes) => {
            if (!loginRes.code) {
              setLoading(false)
              Taro.showToast({ title: '微信登录失败', icon: 'none' })
              return
            }

            try {
              const result = await wxLogin(loginRes.code)
              const oid = result.openid
              setOpenidState(oid)
              setOpenid(oid)

              // Already bound as agent?
              if (result.agentUserId) {
                redirectAgent(result.agentUserId, result.agentDisplayName || name)
                return
              }

              // Already bound as customer?
              if (result.clientId) {
                redirectCustomer(result.clientId, name, avatar)
                return
              }

              // New user → role selection (or auto-customer if agentId)
              if (agentId) {
                await doCustomerRegister(oid, name, avatar)
              } else {
                setStep('role')
              }
            } catch {
              Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
            } finally {
              setLoading(false)
            }
          },
          fail: () => {
            setLoading(false)
            Taro.showToast({ title: '微信登录失败', icon: 'none' })
          }
        })
      },
      fail: () => {
        Taro.showToast({ title: '授权已取消', icon: 'none' })
      }
    })
  }

  // Customer register helper
  const doCustomerRegister = async (oid: string, name: string, avatar: string) => {
    if (agentId) {
      try {
        const result = await registerClient({
          agentId,
          name,
          wechat: `wx:${oid}`
        })
        if (result.ok && result.clientId) {
          redirectCustomer(result.clientId, name, avatar)
          return
        }
      } catch {
        // fall through
      }
    }

    // No agentId or registration failed — local login
    const localId = 'wx_' + Date.now()
    redirectCustomer(localId, name, avatar)
  }

  // Step 2: Role selection
  const handleSelectCustomer = async () => {
    setLoading(true)
    try {
      await doCustomerRegister(openid, nickName, avatarUrl)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAgent = () => {
    setStep('agent-choice')
  }

  // Step 3b: Agent bind existing account
  const handleAgentBind = async () => {
    if (!bindUsername.trim()) {
      Taro.showToast({ title: '请输入用户名', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      const result = await agentBind({
        username: bindUsername.trim(),
        openid,
        nickName,
        avatarUrl
      })
      redirectAgent(result.userId, result.displayName)
    } catch (err: any) {
      const errorMessage = err && err.message ? err.message : '关联失败'
      Taro.showToast({ title: errorMessage, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // Step 4: Agent register
  const handleAgentRegister = async () => {
    if (!regUsername.trim()) {
      Taro.showToast({ title: '请输入用户名', icon: 'none' })
      return
    }
    if (!regDisplayName.trim()) {
      Taro.showToast({ title: '请输入显示名称', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      const result = await agentRegister({
        username: regUsername.trim(),
        displayName: regDisplayName.trim(),
        avatarUrl,
        openid
      })
      redirectAgent(result.userId, result.displayName)
    } catch (err: any) {
      const errorMessage = err && err.message ? err.message : '注册失败'
      Taro.showToast({ title: errorMessage, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // ── Header (shared across steps) ──
  const renderHeader = (subtitle: string) => (
    <View className='login-header'>
      <View className='logo-circle'>
        <Text className='logo-text'>E</Text>
      </View>
      <Text className='app-name'>Estate Epic</Text>
      <Text className='app-desc'>{subtitle}</Text>
    </View>
  )

  // ── Step: wx ──
  if (step === 'wx') {
    return (
      <View className='login-page'>
        {renderHeader(agentId ? '你的专属经纪人邀请你找房' : '您的智能找房助手')}
        <View className='login-choices'>
          <Button className='customer-btn' onClick={handleWxLogin} loading={loading} disabled={loading}>
            <Text className='btn-text-white'>微信登录</Text>
          </Button>
        </View>
        <View className='login-footer'>
          <Text className='footer-text'>授权微信登录后即可使用</Text>
        </View>
      </View>
    )
  }

  // ── Step: role ──
  if (step === 'role') {
    return (
      <View className='login-page'>
        {renderHeader('请选择您的身份')}
        <View className='login-choices'>
          <Button className='customer-btn' onClick={handleSelectCustomer} loading={loading} disabled={loading}>
            <Text className='btn-text-white'>我是客户</Text>
          </Button>
          <Button className='agent-btn' onClick={handleSelectAgent}>
            <Text className='btn-text-blue'>我是经纪人</Text>
          </Button>
        </View>
        <View className='login-footer'>
          <Text className='footer-text'>选择身份后即可开始使用</Text>
        </View>
      </View>
    )
  }

  // ── Step: agent-choice ──
  if (step === 'agent-choice') {
    return (
      <View className='login-page'>
        {renderHeader('经纪人入驻')}
        {avatarUrl ? (
          <View className='avatar-row'>
            <Image className='wx-avatar' src={avatarUrl} mode='aspectFill' />
            <Text className='avatar-name'>{nickName}</Text>
          </View>
        ) : null}
        <View className='login-choices'>
          <Button className='customer-btn' onClick={() => setStep('agent-bind')}>
            <Text className='btn-text-white'>关联已有账号</Text>
          </Button>
          <Button className='agent-btn' onClick={() => setStep('agent-register')}>
            <Text className='btn-text-blue'>首次注册</Text>
          </Button>
        </View>
        <View className='back-link' onClick={() => setStep('role')}>
          <Text className='back-text'>返回选择身份</Text>
        </View>
      </View>
    )
  }

  // ── Step: agent-bind ──
  if (step === 'agent-bind') {
    return (
      <View className='login-page'>
        {renderHeader('关联已有账号')}
        <View className='login-form'>
          <View className='form-group'>
            <Text className='form-label'>用户名</Text>
            <Input
              className='form-input'
              placeholder='请输入已注册的用户名'
              value={bindUsername}
              onInput={(e) => setBindUsername(e.detail.value)}
            />
          </View>
          <Button
            className='agent-login-btn'
            onClick={handleAgentBind}
            loading={loading}
            disabled={loading}
          >
            <Text className='btn-text-white'>关联账号</Text>
          </Button>
          <View className='back-link' onClick={() => setStep('agent-choice')}>
            <Text className='back-text'>返回</Text>
          </View>
        </View>
      </View>
    )
  }

  // ── Step: agent-register ──
  return (
    <View className='login-page'>
      {renderHeader('注册经纪人账号')}
      {avatarUrl ? (
        <View className='avatar-row'>
          <Image className='wx-avatar' src={avatarUrl} mode='aspectFill' />
        </View>
      ) : null}
      <View className='login-form'>
        <View className='form-group'>
          <Text className='form-label'>用户名（唯一标识）</Text>
          <Input
            className='form-input'
            placeholder='请输入用户名'
            value={regUsername}
            onInput={(e) => setRegUsername(e.detail.value)}
          />
        </View>
        <View className='form-group'>
          <Text className='form-label'>显示名称</Text>
          <Input
            className='form-input'
            placeholder='请输入显示名称'
            value={regDisplayName}
            onInput={(e) => setRegDisplayName(e.detail.value)}
          />
        </View>
        <Button
          className='agent-login-btn'
          onClick={handleAgentRegister}
          loading={loading}
          disabled={loading}
        >
          <Text className='btn-text-white'>注册</Text>
        </Button>
        <View className='back-link' onClick={() => setStep('agent-choice')}>
          <Text className='back-text'>返回</Text>
        </View>
      </View>
    </View>
  )
}
