import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

interface AgentTabBarProps {
  current: number
}

const tabs = [
  { icon: '🏠', label: '首页', path: '/pages/agent/index' },
  { icon: '📊', label: '访客', path: '/pages/agent/visitors/index' },
  { icon: '👥', label: '客户库', path: '/pages/agent/clients/index' },
  { icon: '🔍', label: '搜索', path: '/pages/agent/search/index' },
  { icon: '📢', label: '营销中心', path: '/pages/agent/marketing/index' },
]

export default function AgentTabBar({ current }: AgentTabBarProps) {
  const handleTap = (index: number) => {
    if (index === current) return
    Taro.redirectTo({ url: tabs[index].path })
  }

  return (
    <View className='agent-tab-bar'>
      {tabs.map((tab, i) => (
        <View
          key={tab.path}
          className={`tab-item ${i === current ? 'active' : ''}`}
          onClick={() => handleTap(i)}
        >
          <Text className={`tab-icon ${i === current ? 'active' : ''}`}>{tab.icon}</Text>
          <Text className={`tab-label ${i === current ? 'active' : ''}`}>{tab.label}</Text>
        </View>
      ))}
    </View>
  )
}
