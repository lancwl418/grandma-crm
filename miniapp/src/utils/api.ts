import Taro from '@tarojs/taro'

const BASE_URL = 'https://grandma-crm.onrender.com'

function request<T>(url: string, options: { method?: 'GET' | 'POST'; data?: any } = {}): Promise<T> {
  const { method = 'GET', data } = options
  return new Promise((resolve, reject) => {
    Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json'
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T)
        } else {
          reject(new Error(`Request failed: ${res.statusCode}`))
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

export interface Listing {
  id: string
  title: string
  price: number
  address: string
  city: string
  beds: number
  baths: number
  sqft: number
  images: string[]
  description: string
  schools: string[]
  type: 'buy' | 'rent'
  agent_id?: string
}

export interface AgentInfo {
  id: string
  name: string
  phone: string
  wechat?: string
  avatar?: string
  title?: string
}

export interface UserInfo {
  id: string
  phone: string
  name?: string
  avatar?: string
}

export function searchListings(params: {
  type?: 'buy' | 'rent'
  keyword?: string
  city?: string
  page?: number
  pageSize?: number
}) {
  const query = new URLSearchParams()
  if (params.type) query.append('type', params.type)
  if (params.keyword) query.append('keyword', params.keyword)
  if (params.city) query.append('city', params.city)
  if (params.page) query.append('page', String(params.page))
  if (params.pageSize) query.append('pageSize', String(params.pageSize))
  return request<{ listings: Listing[]; total: number }>(`/api/browse/listings?${query.toString()}`)
}

export function autocomplete(keyword: string) {
  return request<{ suggestions: string[] }>(`/api/browse/autocomplete?keyword=${encodeURIComponent(keyword)}`)
}

export function getListingDetail(id: string) {
  return request<Listing>(`/api/browse/listings/${id}`)
}

export function trackView(listingId: string, clientId: string) {
  return request<{ success: boolean }>('/api/browse/track-view', {
    method: 'POST',
    data: { listingId, clientId }
  })
}

export function getAgentInfo(agentId: string) {
  return request<AgentInfo>(`/api/browse/agents/${agentId}`)
}

export function sendMessage(data: { clientId: string; agentId: string; listingId: string; message: string }) {
  return request<{ success: boolean }>('/api/browse/messages', {
    method: 'POST',
    data
  })
}

export function clientLoginByPhone(phone: string, code: string) {
  return request<UserInfo>('/api/browse/login', {
    method: 'POST',
    data: { phone, code }
  })
}

export function getBrowseHistory(clientId: string) {
  return request<{ history: { listingId: string; viewedAt: string; listing: Listing }[] }>(
    `/api/browse/history/${clientId}`
  )
}

export function registerClient(data: { phone: string; name?: string; avatar?: string }) {
  return request<UserInfo>('/api/browse/register', {
    method: 'POST',
    data
  })
}
