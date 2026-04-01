import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Home, Eye, User, Search, Notice } from '@nutui/icons-react-taro'
import './index.scss'

interface AgentTabBarProps {
  current: number
}

const tabs = [
  { icon: Home, label: '首页', path: '/pages/agent/index' },
  { icon: Eye, label: '访客', path: '/pages/agent/visitors/index' },
  { icon: User, label: '客户库', path: '/pages/agent/clients/index' },
  { icon: Search, label: '搜索', path: '/pages/agent/search/index' },
  { icon: Notice, label: '营销中心', path: '/pages/agent/marketing/index' },
]

export default function AgentTabBar({ current }: AgentTabBarProps) {
  const handleTap = (index: number) => {
    if (index === current) return
    Taro.redirectTo({ url: tabs[index].path })
  }

  return (
    <View className='agent-tab-bar'>
      {tabs.map((tab, i) => {
        const TabIcon = tab.icon
        return (
          <View
            key={tab.path}
            className={`tab-item ${i === current ? 'active' : ''}`}
            onClick={() => handleTap(i)}
          >
            <View className={`tab-icon-shell ${i === current ? 'active' : ''}`}>
              <View className={`tab-icon ${i === current ? 'active' : ''}`}>
                <TabIcon size={18} fallback />
              </View>
            </View>
            <Text className={`tab-label ${i === current ? 'active' : ''}`}>{tab.label}</Text>
          </View>
        )
      })}
    </View>
  )
}
