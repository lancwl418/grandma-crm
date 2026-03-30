import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { isLoggedIn, getRole, setStoredAgentId } from './utils/auth'

import '@nutui/nutui-react-taro/dist/style.css'
import './app.scss'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')

    // Capture agentId from launch params (e.g. from share link)
    const launchOptions = Taro.getLaunchOptionsSync()
    const query = launchOptions && launchOptions.query ? launchOptions.query : null
    if (query && query.agentId) {
      setStoredAgentId(query.agentId)
    }

    // Check login state and redirect appropriately
    if (isLoggedIn()) {
      const role = getRole()
      if (role === 'agent') {
        Taro.redirectTo({ url: '/pages/agent/index' })
      }
      // Customer role: stays on login page initially, which will redirect to home
      // Or if they land on home tab, that's fine
    }
  })

  // children 是将要会渲染的页面
  return children
}


export default App
