import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { registerClient } from '../../utils/api'
import { setClientId, setUserInfo, setRole, setAgentSession, isLoggedIn, getRole } from '../../utils/auth'
import { agentLogin } from '../../utils/api'
import './index.scss'

export default function Login() {
  const [mode, setMode] = useState<'choose' | 'agent'>('choose')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)

  useEffect(() => {
    // If already logged in, redirect
    if (isLoggedIn()) {
      const role = getRole()
      if (role === 'agent') {
        Taro.redirectTo({ url: '/pages/agent/index' })
      } else {
        Taro.switchTab({ url: '/pages/home/index' })
      }
      return
    }

    // Capture agentId from share link
    const launchOptions = Taro.getLaunchOptionsSync()
    const query = launchOptions?.query
    if (query?.agentId) {
      setAgentId(query.agentId)
    }

    // Also check current page params
    const instance = Taro.getCurrentInstance()
    const params = instance?.router?.params
    if (params?.agentId) {
      setAgentId(params.agentId)
    }
  }, [])

  const handleCustomerLogin = () => {
    Taro.getUserProfile({
      desc: '用于完善用户资料',
      success: async (res) => {
        const nickName = res.userInfo.nickName || '微信用户'
        const avatarUrl = res.userInfo.avatarUrl || ''

        // If we have agentId from share, register as client
        if (agentId) {
          try {
            const result = await registerClient({
              agentId,
              name: nickName
            })
            if (result.ok && result.clientId) {
              setClientId(result.clientId)
              setUserInfo({
                id: result.clientId,
                phone: '',
                name: nickName,
                avatar: avatarUrl
              })
              setRole('customer')
              Taro.showToast({ title: '登录成功', icon: 'success' })
              setTimeout(() => {
                Taro.switchTab({ url: '/pages/home/index' })
              }, 500)
              return
            }
          } catch {
            // Fall through to local registration
          }
        }

        // No agentId or registration failed - local login
        const localId = 'wx_' + Date.now()
        setClientId(localId)
        setUserInfo({
          id: localId,
          phone: '',
          name: nickName,
          avatar: avatarUrl
        })
        setRole('customer')
        Taro.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/home/index' })
        }, 500)
      },
      fail: () => {
        Taro.showToast({ title: '授权已取消', icon: 'none' })
      }
    })
  }

  const handleAgentLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Taro.showToast({ title: '请填写账号和密码', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const result = await agentLogin(email.trim(), password.trim())
      setAgentSession({
        userId: result.userId,
        email: result.email,
        displayName: result.displayName
      })
      setRole('agent')
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/agent/index' })
      }, 500)
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '登录失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'agent') {
    return (
      <View className='login-page'>
        <View className='login-header'>
          <View className='logo-circle'>
            <Text className='logo-text'>E</Text>
          </View>
          <Text className='app-name'>Estate Epic</Text>
          <Text className='app-desc'>经纪人登录</Text>
        </View>

        <View className='login-form'>
          <View className='form-group'>
            <Text className='form-label'>邮箱 / 用户名</Text>
            <Input
              className='form-input'
              placeholder='请输入邮箱或用户名'
              value={email}
              onInput={(e) => setEmail(e.detail.value)}
            />
          </View>
          <View className='form-group'>
            <Text className='form-label'>密码</Text>
            <Input
              className='form-input'
              placeholder='请输入密码'
              password
              value={password}
              onInput={(e) => setPassword(e.detail.value)}
            />
          </View>

          <Button
            className='agent-login-btn'
            onClick={handleAgentLogin}
            loading={loading}
            disabled={loading}
          >
            <Text className='btn-text-white'>登录</Text>
          </Button>

          <View className='back-link' onClick={() => setMode('choose')}>
            <Text className='back-text'>返回选择</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className='login-page'>
      <View className='login-header'>
        <View className='logo-circle'>
          <Text className='logo-text'>E</Text>
        </View>
        <Text className='app-name'>Estate Epic</Text>
        <Text className='app-desc'>您的智能找房助手</Text>
      </View>

      <View className='login-choices'>
        <Button className='customer-btn' onClick={handleCustomerLogin}>
          <Text className='btn-text-white'>我是客户（微信登录）</Text>
        </Button>

        <Button className='agent-btn' onClick={() => setMode('agent')}>
          <Text className='btn-text-blue'>我是经纪人（账号登录）</Text>
        </Button>
      </View>

      <View className='login-footer'>
        <Text className='footer-text'>登录即表示您同意我们的服务条款</Text>
      </View>
    </View>
  )
}
