import { View, Text } from '@tarojs/components'
import { Notice, Star, Share, ArrowUp } from '@nutui/icons-react-taro'
import AgentTabBar from '../../../components/AgentTabBar'
import './index.scss'

export default function MarketingPage() {
  return (
    <View className='marketing-page'>
      <View className='marketing-content'>
        <View className='marketing-icon'>
          <Notice size={42} />
        </View>
        <Text className='marketing-title'>营销中心</Text>
        <Text className='marketing-desc'>即将上线</Text>

        <View className='feature-list'>
          <View className='feature-item'>
            <View className='feature-icon'>
              <Star size={22} />
            </View>
            <View className='feature-info'>
              <Text className='feature-name'>智能推荐房源</Text>
              <Text className='feature-detail'>根据客户偏好自动推荐匹配房源</Text>
            </View>
          </View>
          <View className='feature-item'>
            <View className='feature-icon'>
              <Share size={22} />
            </View>
            <View className='feature-info'>
              <Text className='feature-name'>批量分享</Text>
              <Text className='feature-detail'>一键将精选房源发送给多个客户</Text>
            </View>
          </View>
          <View className='feature-item'>
            <View className='feature-icon'>
              <ArrowUp size={22} />
            </View>
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
