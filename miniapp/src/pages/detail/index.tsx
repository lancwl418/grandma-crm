import { View, Text, Image, Swiper, SwiperItem, Button } from '@tarojs/components'
import Taro, { useLoad, useRouter, useShareAppMessage } from '@tarojs/taro'
import { useState } from 'react'
import { Heart, HeartFill } from '@nutui/icons-react-taro'
import { getListingDetail, trackView, getAgentInfo } from '../../utils/api'
import { getClientId, getRole } from '../../utils/auth'
import './index.scss'

interface SchoolInfo {
  name: string
  rating: number
  type: string
  distance: string
}

export default function Detail() {
  const router = useRouter()
  const isAgent = getRole() === 'agent'
  const [detail, setDetail] = useState<any>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [isFavorite, setIsFavorite] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [agentName, setAgentName] = useState('')
  const [agentTitle, setAgentTitle] = useState('')
  const [agentAvatar, setAgentAvatar] = useState('')
  const [agentPhone, setAgentPhone] = useState('')
  const [agentEmail, setAgentEmail] = useState('')
  const [agentWechat, setAgentWechat] = useState('')
  const [loading, setLoading] = useState(true)

  // Share individual listing as WeChat card
  useShareAppMessage(() => {
    const currentDetail = detail || {}
    const address = currentDetail.address || decodeURIComponent(router.params.address || '')
    const price = currentDetail.priceFormatted || `$${Number(router.params.price || 0).toLocaleString()}`
    const imageUrl = photos[0] || decodeURIComponent(router.params.imageUrl || '')
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
    }

    // Load agent info
    if (clientId) {
      getAgentInfo(clientId).then(agent => {
        setAgentName(agent.agentName || '')
        setAgentTitle(agent.agentTitle || '')
        setAgentAvatar(agent.agentAvatar || '')
        setAgentPhone(agent.agentPhone || '')
        setAgentEmail(agent.agentEmail || '')
        setAgentWechat(agent.agentWechat || '')
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
    if (!getClientId()) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const options: Array<{ label: string; type: 'phone' | 'email' | 'wechat' }> = []
    if (agentPhone) options.push({ label: '电话联系中介', type: 'phone' })
    if (agentEmail) options.push({ label: '复制中介邮箱', type: 'email' })
    if (agentWechat) options.push({ label: '复制中介微信', type: 'wechat' })

    if (options.length === 0) {
      Taro.showToast({ title: '暂无中介联系方式', icon: 'none' })
      return
    }

    Taro.showActionSheet({
      itemList: options.map((o) => o.label),
      success: (res) => {
        const chosen = options[res.tapIndex]
        if (!chosen) return

        if (chosen.type === 'phone') {
          if (agentPhone) {
            Taro.makePhoneCall({ phoneNumber: agentPhone }).catch(() => {})
          }
          return
        }

        const data = chosen.type === 'email' ? agentEmail : agentWechat
        if (!data) return
        const label = chosen.type === 'email' ? '邮箱' : '微信'
        Taro.setClipboardData({
          data,
          success: () => {
            Taro.showToast({ title: `${label}已复制`, icon: 'success' })
          }
        })
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

  const currentDetail = detail || {}
  const schools: SchoolInfo[] = currentDetail.schools || []
  const zestimate = currentDetail.zestimate || currentDetail.zestimateFormatted
  const zillowUrl = currentDetail.url || (currentDetail.zpid ? `https://www.zillow.com/homedetails/${currentDetail.zpid}_zpid/` : '')
  const attributionInfo = currentDetail.attributionInfo || {}
  const brokerName = currentDetail.brokerName || attributionInfo.brokerName || currentDetail.broker || ''
  const mlsId = currentDetail.mlsId || ''
  const description = currentDetail.description || ''
  const status = currentDetail.status || ''
  const daysOnZillow = currentDetail.daysOnZillow || 0
  const lotSqft = currentDetail.lotSqft || 0
  const rentZestimate = currentDetail.rentZestimate || null
  const county = currentDetail.county || ''
  const neighborhood = currentDetail.neighborhood || ''
  const hoaFee = currentDetail.hoaFee || null
  const propertyTaxRate = currentDetail.propertyTaxRate || null
  const priceHistory = currentDetail.priceHistory || []
  const yearBuilt = currentDetail.yearBuilt || ''
  const beds = currentDetail.beds || currentDetail.bedrooms || 0
  const baths = currentDetail.baths || currentDetail.bathrooms || 0
  const sqft = currentDetail.sqft || currentDetail.livingArea || 0

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
        <Text className='price'>{currentDetail.priceFormatted || formatPrice(currentDetail.price || 0)}</Text>
        <Text className='address'>{currentDetail.address || ''}</Text>
        {currentDetail.city && <Text className='city'>{currentDetail.city}, {currentDetail.state}</Text>}
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
                <Text className='school-name'>{school.name || '学校信息'}</Text>
                {school.type && <Text className='school-level'>{school.type}</Text>}
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

      {/* Around Info */}
      <View className='content-section'>
        <Text className='content-title'>周边与房源信息</Text>
        {status ? <Text className='info-line'>房源状态：{status}</Text> : null}
        {daysOnZillow ? <Text className='info-line'>在架天数：{daysOnZillow} 天</Text> : null}
        {currentDetail.homeType ? <Text className='info-line'>房源类型：{currentDetail.homeType}</Text> : null}
        {rentZestimate ? <Text className='info-line'>租金估值：{formatPrice(Number(rentZestimate))}/月</Text> : null}
        {lotSqft ? <Text className='info-line'>土地面积：{lotSqft.toLocaleString()} sqft</Text> : null}
        {hoaFee ? <Text className='info-line'>HOA：${Number(hoaFee).toLocaleString()}/月</Text> : null}
        {propertyTaxRate ? <Text className='info-line'>房产税率：{propertyTaxRate}%</Text> : null}
        {neighborhood ? <Text className='info-line'>社区：{neighborhood}</Text> : null}
        {county ? <Text className='info-line'>行政区：{county}</Text> : null}
      </View>

      {/* Price History */}
      {priceHistory.length > 0 && (
        <View className='content-section'>
          <Text className='content-title'>价格历史</Text>
          {priceHistory.slice(0, 5).map((row: any, idx: number) => (
            <View className='history-row' key={idx}>
              <Text className='history-date'>{row.date || row.time || '-'}</Text>
              <Text className='history-event'>{row.event || row.source || '记录'}</Text>
              <Text className='history-price'>{row.price ? `$${Number(row.price).toLocaleString()}` : '-'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Agent Card */}
      {agentName ? (
        <View className='content-section'>
          <Text className='content-title'>您的经纪人</Text>
          <View className='agent-row'>
            {agentAvatar ? (
              <Image className='agent-avatar-placeholder' src={agentAvatar} mode='aspectFill' />
            ) : (
              <View className='agent-avatar-placeholder'>
                <Text className='agent-initial'>{agentName[0]}</Text>
              </View>
            )}
            <View className='agent-info-col'>
              <Text className='agent-name-text'>{agentName}</Text>
              {agentTitle ? <Text className='agent-subtitle-text'>{agentTitle}</Text> : null}
              {agentPhone && <Text className='agent-phone-text'>{agentPhone}</Text>}
              {agentEmail && <Text className='agent-phone-text'>{agentEmail}</Text>}
              {agentWechat && <Text className='agent-phone-text'>微信：{agentWechat}</Text>}
            </View>
          </View>
        </View>
      ) : null}

      {/* Bottom spacer */}
      <View className='bottom-spacer' />

      {/* Fixed Bottom Bar */}
      <View className='bottom-bar'>
        {isAgent ? (
          <>
            <View className='favorite-btn' onClick={handleFavorite}>
              <View className={`fav-heart ${isFavorite ? 'active' : ''}`}>
                {isFavorite ? <HeartFill size={20} fallback /> : <Heart size={20} fallback />}
              </View>
              <Text className='fav-label'>收藏</Text>
            </View>
            <Button className='contact-btn' openType='share'>分享房源</Button>
          </>
        ) : (
          <Button className='contact-btn guest-only' onClick={handleContact}>联系中介</Button>
        )}
      </View>
    </View>
  )
}
