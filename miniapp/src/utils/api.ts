import Taro from '@tarojs/taro'

const BASE_URL = 'https://grandma-crm.onrender.com'

function request<T>(url: string, options: { method?: 'GET' | 'POST'; data?: any } = {}): Promise<T> {
  const { method = 'GET', data } = options
  return new Promise((resolve, reject) => {
    Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      timeout: 30000,
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T)
        } else {
          const errMsg = (res.data as any)?.error || `Request failed: ${res.statusCode}`
          reject(new Error(errMsg))
        }
      },
      fail: (err) => reject(err)
    })
  })
}

export interface Listing {
  zpid: number
  address: string
  city: string
  state: string
  price: number
  priceFormatted: string
  beds: number
  baths: number
  sqft: number
  homeType: string
  status: string
  imageUrl: string
  photos: string[]
  buildingName?: string | null
  unitsAvailable?: number | null
  minPrice?: number | null
  maxPrice?: number | null
}

// ── Search ──────────────────────────────────────
export function searchListings(params: {
  location: string
  listingType?: string
}) {
  const query = new URLSearchParams()
  query.set('location', params.location)
  if (params.listingType) query.set('listingType', params.listingType)
  return request<{ results: Listing[]; totalPages: number }>(`/api/browse/search?${query.toString()}`)
}

// ── Autocomplete ────────────────────────────────
export function autocomplete(query: string) {
  return request<{ results: Array<{ display: string; type: string }> }>(
    `/api/browse/autocomplete?query=${encodeURIComponent(query)}`
  )
}

// ── Detail ──────────────────────────────────────
export function getListingDetail(zpid: number) {
  return request<any>(`/api/browse/listing/${zpid}`)
}

// ── Track ───────────────────────────────────────
export function trackView(data: {
  clientId: string
  zpid: number | string
  address: string
  price: number
  imageUrl?: string
  action: 'view' | 'favorite' | 'inquiry'
}) {
  return request('/api/browse/track', { method: 'POST', data })
}

// ── Agent info ──────────────────────────────────
export function getAgentInfo(clientId: string) {
  return request<{
    agentName: string
    agentTitle?: string
    agentPhone?: string
    agentWechat?: string
    agentEmail?: string
    agentAvatar?: string
  }>(`/api/browse/agent/${clientId}`)
}

// ── Message ─────────────────────────────────────
export function sendMessage(data: {
  clientId: string
  message: string
  listingAddress?: string
  listingPrice?: number
}) {
  return request('/api/browse/message', { method: 'POST', data })
}

// ── Client login ────────────────────────────────
export function clientLoginByPhone(phone: string) {
  return request<{ clientId: string | null }>('/api/browse/client-login', {
    method: 'POST',
    data: { phone }
  })
}

// ── Browse history ──────────────────────────────
export function getBrowseHistory(clientId: string) {
  return request<{ views: any[] }>(`/api/browse/history/${clientId}`)
}

// ── Register ────────────────────────────────────
export function registerClient(data: {
  agentId: string
  name?: string
  phone?: string
  email?: string
  wechat?: string
}) {
  return request<{ ok: boolean; clientId: string }>('/api/browse/register', {
    method: 'POST',
    data
  })
}

// ── Client name ─────────────────────────────────
export function getClientName(clientId: string) {
  return request<{ name: string }>(`/api/browse/client-name/${clientId}`)
}

// ── Agent login ─────────────────────────────────
export function agentLogin(email: string, password: string) {
  return request<{ userId: string; email: string; displayName: string }>('/api/browse/agent-login', {
    method: 'POST',
    data: { email, password }
  })
}

// ── Agent stats ─────────────────────────────────
export function getAgentStats(userId: string) {
  return request<{ totalClients: number; visitors: number; interested: number }>(`/api/browse/agent-stats/${userId}`)
}

// ── Agent visitors ──────────────────────────────
export function getAgentVisitors(userId: string) {
  return request<{ visitors: Array<{ clientId: string; clientName: string; lastActive: string; viewCount: number }> }>(`/api/browse/agent-visitors/${userId}`)
}

// ── Agent clients ───────────────────────────────
export function getAgentClients(userId: string) {
  return request<{ clients: Array<{ id: string; name: string; phone: string; status: string; urgency: string }> }>(`/api/browse/agent-clients/${userId}`)
}
