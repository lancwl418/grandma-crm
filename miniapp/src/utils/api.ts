import Taro from "@tarojs/taro";

const API_BASE = "https://grandma-crm.onrender.com";

// ── Generic request ─────────────────────────────────────────

export async function request<T>(url: string, options?: { method?: "GET" | "POST"; data?: any }): Promise<T> {
  const res = await Taro.request({
    url: `${API_BASE}${url}`,
    method: options?.method || "GET",
    data: options?.data,
    header: { "Content-Type": "application/json" },
  });
  return res.data as T;
}

// ── Search listings ─────────────────────────────────────────

export interface Listing {
  zpid: number;
  address: string;
  city: string;
  state: string;
  price: number;
  priceFormatted: string;
  beds: number;
  baths: number;
  sqft: number;
  homeType: string;
  status: string;
  imageUrl: string;
  photos: string[];
  buildingName?: string | null;
  unitsAvailable?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
}

export async function searchListings(params: {
  location: string;
  listingType?: string;
  minPrice?: string;
  maxPrice?: string;
  bedsMin?: string;
  homeType?: string;
}) {
  const query = new URLSearchParams();
  query.set("location", params.location);
  if (params.listingType) query.set("listingType", params.listingType);
  if (params.minPrice) query.set("minPrice", params.minPrice);
  if (params.maxPrice) query.set("maxPrice", params.maxPrice);
  if (params.bedsMin) query.set("bedsMin", params.bedsMin);
  if (params.homeType) query.set("homeType", params.homeType);

  return request<{ results: Listing[]; totalPages: number }>(`/api/browse/search?${query}`);
}

// ── Autocomplete ────────────────────────────────────────────

export async function autocomplete(query: string) {
  return request<{ results: Array<{ display: string; type: string }> }>(`/api/browse/autocomplete?query=${encodeURIComponent(query)}`);
}

// ── Listing detail ──────────────────────────────────────────

export async function getListingDetail(zpid: number) {
  return request<any>(`/api/browse/listing/${zpid}`);
}

// ── Track ───────────────────────────────────────────────────

export async function trackView(data: {
  clientId: string;
  zpid: number | string;
  address: string;
  price: number;
  imageUrl?: string;
  action: "view" | "favorite" | "inquiry";
}) {
  return request(`/api/browse/track`, { method: "POST", data });
}

// ── Client login ────────────────────────────────────────────

export async function clientLoginByPhone(phone: string) {
  return request<{ clientId: string | null }>(`/api/browse/client-login`, { method: "POST", data: { phone } });
}

// ── Register ────────────────────────────────────────────────

export async function registerClient(data: {
  agentId: string;
  name?: string;
  phone?: string;
  email?: string;
  wechat?: string;
}) {
  return request<{ ok: boolean; clientId: string }>(`/api/browse/register`, { method: "POST", data });
}

// ── Agent info ──────────────────────────────────────────────

export async function getAgentInfo(clientId: string) {
  return request<{
    agentName: string;
    agentTitle?: string;
    agentPhone?: string;
    agentWechat?: string;
    agentEmail?: string;
    agentAvatar?: string;
  }>(`/api/browse/agent/${clientId}`);
}

// ── Message ─────────────────────────────────────────────────

export async function sendMessage(data: {
  clientId: string;
  message: string;
  listingAddress?: string;
  listingPrice?: number;
}) {
  return request(`/api/browse/message`, { method: "POST", data });
}

// ── Browse history ──────────────────────────────────────────

export async function getBrowseHistory(clientId: string) {
  return request<{ views: any[] }>(`/api/browse/history/${clientId}`);
}
