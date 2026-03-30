import { View, Text, Image, Swiper, SwiperItem, Button } from '@tarojs/components'
import Taro, { useLoad, useRouter, useShareAppMessage } from '@tarojs/taro'
import { useState } from 'react'
import { getListingDetail, trackView, getAgentInfo, sendMessage } from '../../utils/api'
import { getClientId } from '../../utils/auth'
import './index.scss'

interface SchoolInfo {
  name: string
  rating: number
  level: string
  distance: string
}

export default function Detail() {
  const router = useRouter()
  const [detail, setDetail] = useState<any>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [isFavorite, setIsFavorite] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [agentName, setAgentName] = useState('')
  const [agentPhone, setAgentPhone] = useState('')
  const [loading, setLoading] = useState(true)

  // Share individual listing as WeChat card
  useShareAppMessage(() => {
    const address = detail?.address || decodeURIComponent(router.params.address || '')
    const price = detail?.priceFormatted || `$${Number(router.params.price || 0).toLocaleString()}`
    const imageUrl = photos[0] || decodeURIComponent(router.params.imageUrl || '')
    const clientId = getClientId()
    return {
      title: `${price} | ${address}`,
      path: `/pages/detail/index?zpid=${router.params.zpid}&address=${encodeURIComponent(address)}&price=${router.params.price || 0}&imageUrl=${encodeURIComponent(imageUrl)}`,
      imageUrl: imageUrl,
    }
  })

  useLoad(async () => {
    const zpid = router.params.zpid
    const address = decodeURIComponent(router.params.address || '')
    const price = Number(router.params.price || 0)
    const imageUrl = decodeURIComponent(router.params.imageUrl || '')
    let passedPhotos: string[] = []
    try {
      passedPhotos = JSON.parse(decodeURIComponent(router.params.photos || '[]'))
    } catch {
      // ignore
    }

    // Set fallback photos immediately
    if (passedPhotos.length > 0) {
      setPhotos(passedPhotos)
    } else if (imageUrl) {
      setPhotos([imageUrl])
    }

    // Set minimal detail from params
    setDetail({ address, price, zpid })

    // Track view
    const clientId = getClientId()
    if (clientId && zpid) {
      trackView({
        clientId,
        zpid,
        address,
        price,
        imageUrl,
        action: 'view'
      }).catch(() => {})

      // Load agent info
      getAgentInfo(clientId).then(agent => {
        setAgentName(agent.agentName || '')
        setAgentPhone(agent.agentPhone || '')
      }).catch(() => {})
    }

    // Load full detail
    if (zpid) {
      try {
        const fullDetail = await getListingDetail(Number(zpid))
        setDetail(fullDetail)
        if (fullDetail.photos && fullDetail.photos.length > 0) {
          setPhotos(fullDetail.photos)
        } else if (fullDetail.imageUrl) {
          setPhotos(prev => prev.length > 0 ? prev : [fullDetail.imageUrl])
        }
      } catch {
        // Keep fallback data
      }
    }
    setLoading(false)
  })

  const formatPrice = (price: number) => {
    if (!price) return ''
    if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`
    if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`
    return `$${price}`
  }

  const handleFavorite = () => {
    const clientId = getClientId()
    const newFav = !isFavorite
    setIsFavorite(newFav)

    if (clientId && detail) {
      trackView({
        clientId,
        zpid: detail.zpid || router.params.zpid || '',
        address: detail.address || '',
        price: detail.price || 0,
        imageUrl: photos[0] || '',
        action: 'favorite'
      }).catch(() => {})
    }

    Taro.showToast({
      title: newFav ? '已收藏' : '已取消收藏',
      icon: 'none'
    })
  }

  const handleContact = () => {
    Taro.showActionSheet({
      itemList: ['电话联系经纪人', '发送留言咨询'],
      success: (res) => {
        if (res.tapIndex === 0) {
          if (agentPhone) {
            Taro.makePhoneCall({ phoneNumber: agentPhone }).catch(() => {})
          } else {
            Taro.showToast({ title: '暂无经纪人电话', icon: 'none' })
          }
        } else if (res.tapIndex === 1) {
          const clientId = getClientId()
          if (!clientId) {
            Taro.showToast({ title: '请先登录', icon: 'none' })
            return
          }
          sendMessage({
            clientId,
            message: `您好，我对这套房源感兴趣：${detail?.address || ''}`,
            listingAddress: detail?.address,
            listingPrice: detail?.price
          }).then(() => {
            Taro.showToast({ title: '留言已发送', icon: 'success' })
          }).catch(() => {
            Taro.showToast({ title: '发送失败', icon: 'none' })
          })
        }
      }
    })
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'rating-green'
    if (rating >= 5) return 'rating-yellow'
    return 'rating-gray'
  }

  if (loading && !detail) {
    return (
      <View className='detail-page'>
        <View className='loading-state'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      </View>
    )
  }

  const schools: SchoolInfo[] = detail?.schools || []
  const zestimate = detail?.zestimate || detail?.zestimateFormatted
  const zillowUrl = detail?.url || (detail?.zpid ? `https://www.zillow.com/homedetails/${detail.zpid}_zpid/` : '')
  const brokerName = detail?.brokerName || detail?.attributionInfo?.brokerName || detail?.broker || ''
  const mlsId = detail?.mlsId || ''
  const description = detail?.description || ''
  const yearBuilt = detail?.yearBuilt || ''
  const beds = detail?.beds || detail?.bedrooms || 0
  const baths = detail?.baths || detail?.bathrooms || 0
  const sqft = detail?.sqft || detail?.livingArea || 0

  return (
    <View className='detail-page'>
      {/* Photo Carousel */}
      {photos.length > 0 && (
        <View className='carousel-wrapper'>
          <Swiper
            className='photo-swiper'
            indicatorDots={false}
            autoplay={false}
            circular
            onChange={(e) => setCurrentSlide(e.detail.current)}
          >
            {photos.map((img, i) => (
              <SwiperItem key={i}>
                <Image className='swiper-image' src={img} mode='aspectFill' />
              </SwiperItem>
            ))}
          </Swiper>
          <View className='slide-counter'>
            <Text className='counter-text'>{currentSlide + 1} / {photos.length}</Text>
          </View>
        </View>
      )}

      {/* Price & Address */}
      <View className='price-section'>
        <Text className='price'>{detail?.priceFormatted || formatPrice(detail?.price || 0)}</Text>
        <Text className='address'>{detail?.address || ''}</Text>
        {detail?.city && <Text className='city'>{detail.city}, {detail.state}</Text>}
      </View>

      {/* Stats Row */}
      <View className='stats-row'>
        {beds > 0 && (
          <View className='stat-box'>
            <Text className='stat-value'>{beds}</Text>
            <Text className='stat-label'>卧</Text>
          </View>
        )}
        {baths > 0 && (
          <View className='stat-box'>
            <Text className='stat-value'>{baths}</Text>
            <Text className='stat-label'>卫</Text>
          </View>
        )}
        {sqft > 0 && (
          <View className='stat-box'>
            <Text className='stat-value'>{sqft.toLocaleString()}</Text>
            <Text className='stat-label'>sqft</Text>
          </View>
        )}
        {yearBuilt ? (
          <View className='stat-box'>
            <Text className='stat-value'>{yearBuilt}</Text>
            <Text className='stat-label'>建造</Text>
          </View>
        ) : null}
      </View>

      {/* Zestimate */}
      {zestimate && (
        <View className='zestimate-box'>
          <Text className='zestimate-label'>Zestimate 估值</Text>
          <Text className='zestimate-value'>{typeof zestimate === 'number' ? formatPrice(zestimate) : zestimate}</Text>
        </View>
      )}

      {/* Zillow Link */}
      {zillowUrl ? (
        <View className='zillow-link' onClick={() => {
          Taro.setClipboardData({
            data: zillowUrl,
            success: () => Taro.showToast({ title: '链接已复制', icon: 'none' })
          })
        }}>
          <Text className='zillow-text'>在 Zillow 查看详情 (点击复制链接)</Text>
        </View>
      ) : null}

      {/* Description */}
      {description ? (
        <View className='content-section'>
          <Text className='content-title'>房源描述</Text>
          <Text className='content-text'>{description}</Text>
        </View>
      ) : null}

      {/* Schools */}
      {schools.length > 0 && (
        <View className='content-section'>
          <Text className='content-title'>附近学校</Text>
          {schools.map((school: SchoolInfo, i: number) => (
            <View key={i} className='school-item'>
              <View className='school-info'>
                <Text className='school-name'>{school.name || school}</Text>
                {school.level && <Text className='school-level'>{school.level}</Text>}
                {school.distance && <Text className='school-distance'>{school.distance}</Text>}
              </View>
              {school.rating != null && (
                <View className={`school-rating ${getRatingColor(school.rating)}`}>
                  <Text className='rating-num'>{school.rating}</Text>
                  <Text className='rating-max'>/10</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Broker */}
      {(brokerName || mlsId) ? (
        <View className='content-section'>
          <Text className='content-title'>经纪公司</Text>
          {brokerName ? <Text className='broker-text'>{brokerName}</Text> : null}
          {mlsId ? <Text className='mls-text'>MLS# {mlsId}</Text> : null}
        </View>
      ) : null}

      {/* Agent Card */}
      {agentName ? (
        <View className='content-section'>
          <Text className='content-title'>您的经纪人</Text>
          <View className='agent-row'>
            <View className='agent-avatar-placeholder'>
              <Text className='agent-initial'>{agentName[0]}</Text>
            </View>
            <View className='agent-info-col'>
              <Text className='agent-name-text'>{agentName}</Text>
              {agentPhone && <Text className='agent-phone-text'>{agentPhone}</Text>}
            </View>
          </View>
        </View>
      ) : null}

      {/* Bottom spacer */}
      <View className='bottom-spacer' />

      {/* Fixed Bottom Bar */}
      <View className='bottom-bar'>
        <View className='favorite-btn' onClick={handleFavorite}>
          <Text className={`fav-heart ${isFavorite ? 'active' : ''}`}>{isFavorite ? '\u2665' : '\u2661'}</Text>
          <Text className='fav-label'>收藏</Text>
        </View>
        <Button className='share-btn' openType='share'>
          <Text className='share-icon'>↗</Text>
          <Text className='share-label'>分享</Text>
        </Button>
        <Button className='contact-btn' onClick={handleContact}>联系经纪人</Button>
      </View>
    </View>
  )
}
