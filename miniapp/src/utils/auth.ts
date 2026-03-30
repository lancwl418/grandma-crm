import Taro from '@tarojs/taro'

const CLIENT_ID_KEY = 'estate_client_id'
const USER_INFO_KEY = 'estate_user_info'
const ROLE_KEY = 'estate_role'
const AGENT_SESSION_KEY = 'estate_agent_session'
const AGENT_ID_KEY = 'estate_agent_id'
const OPENID_KEY = 'estate_openid'

export interface StoredUserInfo {
  id: string
  phone: string
  name?: string
  avatar?: string
}

export interface AgentSession {
  userId: string
  email: string
  displayName: string
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

export function getRole(): 'customer' | 'agent' | null {
  return Taro.getStorageSync(ROLE_KEY) || null
}

export function setRole(role: 'customer' | 'agent'): void {
  Taro.setStorageSync(ROLE_KEY, role)
}

export function getAgentSession(): AgentSession | null {
  const session = Taro.getStorageSync(AGENT_SESSION_KEY)
  return session || null
}

export function setAgentSession(session: AgentSession): void {
  Taro.setStorageSync(AGENT_SESSION_KEY, session)
}

export function getStoredAgentId(): string | null {
  return Taro.getStorageSync(AGENT_ID_KEY) || null
}

export function setStoredAgentId(agentId: string): void {
  Taro.setStorageSync(AGENT_ID_KEY, agentId)
}

export function getOpenid(): string | null {
  return Taro.getStorageSync(OPENID_KEY) || null
}

export function setOpenid(openid: string): void {
  Taro.setStorageSync(OPENID_KEY, openid)
}

export function isLoggedIn(): boolean {
  const role = getRole()
  if (role === 'agent') {
    return !!getAgentSession()
  }
  return !!getClientId()
}

export function logout(): void {
  Taro.removeStorageSync(CLIENT_ID_KEY)
  Taro.removeStorageSync(USER_INFO_KEY)
  Taro.removeStorageSync(ROLE_KEY)
  Taro.removeStorageSync(AGENT_SESSION_KEY)
  Taro.removeStorageSync(AGENT_ID_KEY)
  Taro.removeStorageSync(OPENID_KEY)
}

// Keep backward-compatible alias
export function clearAuth(): void {
  logout()
}
