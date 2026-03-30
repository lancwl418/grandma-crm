import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

interface AgentTabBarProps {
  current: number
}

const tabs = [
  { icon: '\u{1F3E0}', label: '首页', path: '/pages/agent/index' },
  { icon: '\u{1F441}', label: '访客', path: '/pages/agent/visitors/index' },
  { icon: '\u{1F465}', label: '客户库', path: '/pages/agent/clients/index' },
  { icon: '\u{1F50D}', label: '搜索', path: '/pages/agent/search/index' },
  { icon: '\u{1F464}', label: '我的', path: '/pages/agent/profile/index' },
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
