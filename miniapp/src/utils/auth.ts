import Taro from "@tarojs/taro";

const CLIENT_ID_KEY = "estate_epic_client_id";
const USER_INFO_KEY = "estate_epic_user_info";

export interface UserInfo {
  clientId: string;
  nickName: string;
  avatarUrl: string;
  phone?: string;
}

// ── Storage ─────────────────────────────────────────────────

export function getClientId(): string | null {
  return Taro.getStorageSync(CLIENT_ID_KEY) || null;
}

export function setClientId(id: string) {
  Taro.setStorageSync(CLIENT_ID_KEY, id);
}

export function getUserInfo(): UserInfo | null {
  const raw = Taro.getStorageSync(USER_INFO_KEY);
  return raw ? (JSON.parse(raw) as UserInfo) : null;
}

export function setUserInfo(info: UserInfo) {
  Taro.setStorageSync(USER_INFO_KEY, JSON.stringify(info));
}

export function clearAuth() {
  Taro.removeStorageSync(CLIENT_ID_KEY);
  Taro.removeStorageSync(USER_INFO_KEY);
}

// ── WeChat Login ────────────────────────────────────────────

export async function wxLogin(): Promise<string> {
  const res = await Taro.login();
  return res.code; // Send to backend to exchange for openid
}

export async function getWxUserProfile(): Promise<{ nickName: string; avatarUrl: string }> {
  const res = await Taro.getUserProfile({ desc: "用于完善您的个人信息" });
  return {
    nickName: res.userInfo.nickName,
    avatarUrl: res.userInfo.avatarUrl,
  };
}

export async function getWxPhoneNumber(e: any): Promise<string | null> {
  // The phone number is encrypted, need backend to decrypt
  // For now return the event detail
  if (e.detail.errMsg === "getPhoneNumber:ok") {
    return e.detail.code; // Phone code, send to backend
  }
  return null;
}
