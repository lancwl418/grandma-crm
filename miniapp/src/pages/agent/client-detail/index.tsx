import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getClientDetail, type ClientDetail } from '../../../utils/api'
import './index.scss'

const STATUS_COLORS: Record<string, string> = {
  '新客户': '#3b82f6',
  '看房中': '#f59e0b',
  '意向强烈': '#ef4444',
  '已下 Offer': '#8b5cf6',
  '已成交': '#10b981',
  '停滞': '#64748b',
  '暂缓': '#94a3b8',
}

const URGENCY_MAP: Record<string, { text: string; color: string }> = {
  high: { text: '紧急', color: '#ef4444' },
  medium: { text: '一般', color: '#f59e0b' },
  low: { text: '不急', color: '#94a3b8' },
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatPrice(price: number): string {
  if (!price) return ''
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`
  if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`
  return `$${price}`
}

export default function ClientDetailPage() {
  const router = useRouter()
  const clientId = router.params.clientId || ''
  const [detail, setDetail] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (clientId) loadDetail()
  }, [clientId])

  const loadDetail = async () => {
    setLoading(true)
    try {
      const result = await getClientDetail(clientId)
      setDetail(result)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleCall = (phone: string) => {
    if (!phone) return
    Taro.makePhoneCall({ phoneNumber: phone })
  }

  const handleCopyWechat = (wechat: string) => {
    if (!wechat) return
    Taro.setClipboardData({ data: wechat })
  }

  const goListing = (zpid: string) => {
    Taro.navigateTo({ url: `/pages/detail/index?zpid=${zpid}` })
  }

  const handleShareLink = () => {
    if (!clientId) return
    const browseUrl = `pages/index/index?clientId=${clientId}`
    Taro.setClipboardData({
      data: browseUrl,
      success: () => Taro.showToast({ title: '浏览链接已复制', icon: 'none' })
    })
  }

  if (loading) {
    return (
      <View className='detail-page'>
        <View className='loading-wrap'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      </View>
    )
  }

  if (!detail) {
    return (
      <View className='detail-page'>
        <View className='loading-wrap'>
          <Text className='loading-text'>客户不存在</Text>
        </View>
      </View>
    )
  }

  const { client, logs, browseHistory, favorites } = detail
  const urgencyInfo = URGENCY_MAP[client.urgency] || URGENCY_MAP.medium

  return (
    <View className='detail-page'>
      <ScrollView scrollY className='detail-scroll'>
        {/* Client Header */}
        <View className='client-header'>
          <View className='header-top'>
            <View className='header-avatar'>
              <Text className='header-initial'>{(client.name || '客')[0]}</Text>
            </View>
            <View className='header-info'>
              <Text className='header-name'>{client.name}</Text>
              <View className='header-badges'>
                <View className='badge' style={{ background: (STATUS_COLORS[client.status] || '#64748b') + '1a' }}>
                  <Text className='badge-text' style={{ color: STATUS_COLORS[client.status] || '#64748b' }}>{client.status}</Text>
                </View>
                <View className='badge' style={{ background: urgencyInfo.color + '1a' }}>
                  <Text className='badge-text' style={{ color: urgencyInfo.color }}>{urgencyInfo.text}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Contact Info */}
        <View className='section'>
          <Text className='section-title'>联系方式</Text>
          <View className='info-card'>
            {client.phone ? (
              <View className='info-row' onClick={() => handleCall(client.phone)}>
                <Text className='info-label'>电话</Text>
                <Text className='info-value link'>{client.phone}</Text>
                <Text className='info-action'>拨打</Text>
              </View>
            ) : null}
            {client.wechat ? (
              <View className='info-row' onClick={() => handleCopyWechat(client.wechat)}>
                <Text className='info-label'>微信</Text>
                <Text className='info-value'>{client.wechat}</Text>
                <Text className='info-action'>复制</Text>
              </View>
            ) : null}
            {!client.phone && !client.wechat && (
              <View className='info-row'>
                <Text className='info-empty'>暂无联系方式</Text>
              </View>
            )}
          </View>
        </View>

        {/* Share Browse Link */}
        <View className='section'>
          <View className='share-btn' onClick={handleShareLink}>
            <Text className='share-btn-text'>分享浏览链接</Text>
          </View>
        </View>

        {/* Tags & Needs */}
        {(client.tags.length > 0 || client.budget || client.needs) && (
          <View className='section'>
            <Text className='section-title'>客户需求</Text>
            <View className='info-card'>
              {client.budget && (
                <View className='info-row'>
                  <Text className='info-label'>预算</Text>
                  <Text className='info-value'>{client.budget}</Text>
                </View>
              )}
              {client.needs && (
                <View className='info-row'>
                  <Text className='info-label'>需求</Text>
                  <Text className='info-value'>{client.needs}</Text>
                </View>
              )}
              {client.tags.length > 0 && (
                <View className='tags-row'>
                  {client.tags.map((tag, i) => (
                    <View key={i} className='tag'>
                      <Text className='tag-text'>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Favorites */}
        {favorites.length > 0 && (
          <View className='section'>
            <Text className='section-title'>收藏房源 ({favorites.length})</Text>
            <ScrollView scrollX className='listing-scroll'>
              {favorites.map((item, i) => (
                <View key={i} className='listing-card' onClick={() => goListing(item.zpid)}>
                  {item.imageUrl ? (
                    <Image className='listing-image' src={item.imageUrl} mode='aspectFill' lazyLoad />
                  ) : (
                    <View className='listing-image listing-placeholder'>
                      <Text className='placeholder-text'>暂无图片</Text>
                    </View>
                  )}
                  <View className='listing-info'>
                    <Text className='listing-price'>{formatPrice(item.price)}</Text>
                    <Text className='listing-addr'>{item.address}</Text>
                  </View>
                  <View className='fav-mark'>
                    <Text className='fav-icon'>&#10084;</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Browse History */}
        {browseHistory.length > 0 && (
          <View className='section'>
            <Text className='section-title'>浏览记录 ({browseHistory.length})</Text>
            <ScrollView scrollX className='listing-scroll'>
              {browseHistory.map((item, i) => (
                <View key={i} className='listing-card' onClick={() => goListing(item.zpid)}>
                  {item.imageUrl ? (
                    <Image className='listing-image' src={item.imageUrl} mode='aspectFill' lazyLoad />
                  ) : (
                    <View className='listing-image listing-placeholder'>
                      <Text className='placeholder-text'>暂无图片</Text>
                    </View>
                  )}
                  <View className='listing-info'>
                    <Text className='listing-price'>{formatPrice(item.price)}</Text>
                    <Text className='listing-addr'>{item.address}</Text>
                  </View>
                  <Text className='listing-time'>{formatDate(item.createdAt)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Follow-up Logs */}
        <View className='section'>
          <Text className='section-title'>跟进记录 ({logs.length})</Text>
          {logs.length === 0 ? (
            <View className='empty-section'>
              <Text className='empty-section-text'>暂无跟进记录</Text>
            </View>
          ) : (
            <View className='logs-list'>
              {logs.map((log) => (
                <View key={log.id} className='log-item'>
                  <View className='log-dot' />
                  <View className='log-content'>
                    <Text className='log-date'>{formatDate(log.date)}</Text>
                    <Text className='log-text'>{log.content}</Text>
                    {log.nextAction && (
                      <Text className='log-next'>下一步: {log.nextAction}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className='bottom-spacer' />
      </ScrollView>
    </View>
  )
}
