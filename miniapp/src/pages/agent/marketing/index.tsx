import { View, Text } from '@tarojs/components'
import AgentTabBar from '../../../components/AgentTabBar'
import './index.scss'

export default function MarketingPage() {
  return (
    <View className='marketing-page'>
      <View className='marketing-content'>
        <Text className='marketing-icon'>📢</Text>
        <Text className='marketing-title'>营销中心</Text>
        <Text className='marketing-desc'>即将上线</Text>

        <View className='feature-list'>
          <View className='feature-item'>
            <Text className='feature-emoji'>✨</Text>
            <View className='feature-info'>
              <Text className='feature-name'>智能推荐房源</Text>
              <Text className='feature-detail'>根据客户偏好自动推荐匹配房源</Text>
            </View>
          </View>
          <View className='feature-item'>
            <Text className='feature-emoji'>📤</Text>
            <View className='feature-info'>
              <Text className='feature-name'>批量分享</Text>
              <Text className='feature-detail'>一键将精选房源发送给多个客户</Text>
            </View>
          </View>
          <View className='feature-item'>
            <Text className='feature-emoji'>📈</Text>
            <View className='feature-info'>
              <Text className='feature-name'>数据分析</Text>
              <Text className='feature-detail'>客户行为洞察与转化分析</Text>
            </View>
          </View>
        </View>
      </View>
      <AgentTabBar current={4} />
    </View>
  )
}
