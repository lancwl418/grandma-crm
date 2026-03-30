import { View, Text, Image, Swiper, SwiperItem, Button } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { getListingDetail, trackView, getAgentInfo, sendMessage, Listing, AgentInfo } from '../../utils/api'
import { getClientId } from '../../utils/auth'
import './index.scss'

export default function Detail() {
  const router = useRouter()
  const [listing, setListing] = useState<Listing | null>(null)
  const [agent, setAgent] = useState<AgentInfo | null>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)

  useLoad(async () => {
    const id = router.params.id
    if (!id) return

    try {
      const detail = await getListingDetail(id)
      setListing(detail)

      // Track view
      const clientId = getClientId()
      if (clientId) {
        trackView(id, clientId).catch(() => {})
      }

      // Load agent info
      if (detail.agent_id) {
        try {
          const agentInfo = await getAgentInfo(detail.agent_id)
          setAgent(agentInfo)
        } catch {
          // Agent info optional
        }
      }
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
  })

  const handleFavorite = () => {
    setIsFavorite(!isFavorite)
    Taro.showToast({
      title: isFavorite ? '已取消收藏' : '已收藏',
      icon: 'none'
    })
  }

  const handleContact = () => {
    Taro.showActionSheet({
      itemList: ['电话联系经纪人', '发送咨询消息'],
      success: (res) => {
        if (res.tapIndex === 0) {
          if (agent?.phone) {
            Taro.makePhoneCall({ phoneNumber: agent.phone }).catch(() => {})
          } else {
            Taro.showToast({ title: '暂无经纪人电话', icon: 'none' })
          }
        } else if (res.tapIndex === 1) {
          const clientId = getClientId()
          if (!clientId) {
            Taro.showToast({ title: '请先登录', icon: 'none' })
            return
          }
          if (listing && agent) {
            sendMessage({
              clientId,
              agentId: agent.id,
              listingId: listing.id,
              message: `您好，我对这套房源感兴趣：${listing.address}`
            }).then(() => {
              Taro.showToast({ title: '消息已发送', icon: 'success' })
            }).catch(() => {
              Taro.showToast({ title: '发送失败', icon: 'none' })
            })
          }
        }
      }
    })
  }

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`
    if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`
    return `$${price}`
  }

  if (!listing) {
    return (
      <View className='detail-page'>
        <View className='loading'>
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='detail-page'>
      {/* Photo Carousel */}
      {listing.images && listing.images.length > 0 && (
        <View className='carousel-wrapper'>
          <Swiper
            className='photo-swiper'
            indicatorDots={false}
            autoplay={false}
            circular
            onChange={(e) => setCurrentSlide(e.detail.current)}
          >
            {listing.images.map((img, i) => (
              <SwiperItem key={i}>
                <Image className='swiper-image' src={img} mode='aspectFill' />
              </SwiperItem>
            ))}
          </Swiper>
          <View className='slide-counter'>
            <Text>{currentSlide + 1}/{listing.images.length}</Text>
          </View>
        </View>
      )}

      {/* Basic Info */}
      <View className='info-section'>
        <Text className='price'>{formatPrice(listing.price)}</Text>
        <View className='specs'>
          <Text className='spec-item'>{listing.beds}卧</Text>
          <Text className='spec-divider'>|</Text>
          <Text className='spec-item'>{listing.baths}卫</Text>
          <Text className='spec-divider'>|</Text>
          <Text className='spec-item'>{listing.sqft} sqft</Text>
        </View>
        <Text className='address'>{listing.address}</Text>
        <Text className='city'>{listing.city}</Text>
      </View>

      {/* Description */}
      {listing.description && (
        <View className='detail-section'>
          <Text className='detail-title'>房源描述</Text>
          <Text className='detail-text'>{listing.description}</Text>
        </View>
      )}

      {/* Schools */}
      {listing.schools && listing.schools.length > 0 && (
        <View className='detail-section'>
          <Text className='detail-title'>附近学校</Text>
          {listing.schools.map((school, i) => (
            <View key={i} className='school-item'>
              <Text>🏫 {school}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Agent Card */}
      {agent && (
        <View className='detail-section agent-card'>
          <Text className='detail-title'>经纪人</Text>
          <View className='agent-info'>
            {agent.avatar && <Image className='agent-avatar' src={agent.avatar} />}
            <View className='agent-text'>
              <Text className='agent-name'>{agent.name}</Text>
              {agent.title && <Text className='agent-title'>{agent.title}</Text>}
            </View>
          </View>
        </View>
      )}

      {/* Spacer for bottom bar */}
      <View className='bottom-spacer' />

      {/* Bottom Action Bar */}
      <View className='bottom-bar'>
        <View className='favorite-btn' onClick={handleFavorite}>
          <Text className={`fav-icon ${isFavorite ? 'active' : ''}`}>{isFavorite ? '♥' : '♡'}</Text>
          <Text className='fav-text'>收藏</Text>
        </View>
        <Button className='contact-btn' onClick={handleContact}>联系经纪人</Button>
      </View>
    </View>
  )
}
