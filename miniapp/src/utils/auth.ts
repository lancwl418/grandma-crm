import Taro from '@tarojs/taro'

const CLIENT_ID_KEY = 'estate_client_id'
const USER_INFO_KEY = 'estate_user_info'

export interface StoredUserInfo {
  id: string
  phone: string
  name?: string
  avatar?: string
}

export function getClientId(): string | null {
  return Taro.getStorageSync(CLIENT_ID_KEY) || null
}

export function setClientId(id: string): void {
  Taro.setStorageSync(CLIENT_ID_KEY, id)
}

export function getUserInfo(): StoredUserInfo | null {
  const info = Taro.getStorageSync(USER_INFO_KEY)
  return info || null
}

export function setUserInfo(info: StoredUserInfo): void {
  Taro.setStorageSync(USER_INFO_KEY, info)
}

export function clearAuth(): void {
  Taro.removeStorageSync(CLIENT_ID_KEY)
  Taro.removeStorageSync(USER_INFO_KEY)
}

export function isLoggedIn(): boolean {
  return !!getClientId()
}
