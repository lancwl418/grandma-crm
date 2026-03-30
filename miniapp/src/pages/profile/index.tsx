import { useState, useEffect } from "react";
import { View, Text, Image, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { getClientId, setClientId, getUserInfo, setUserInfo, type UserInfo } from "@/utils/auth";
import { clientLoginByPhone, getAgentInfo, getBrowseHistory } from "@/utils/api";
import "./index.scss";

export default function ProfilePage() {
  const [user, setUser] = useState<UserInfo | null>(getUserInfo());
  const [agentName, setAgentName] = useState("");
  const [agentAvatar, setAgentAvatar] = useState("");
  const [viewCount, setViewCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);

  const clientId = getClientId();

  useEffect(() => {
    if (!clientId) return;

    getAgentInfo(clientId).then((data) => {
      setAgentName(data.agentName || "");
      setAgentAvatar(data.agentAvatar || "");
    });

    getBrowseHistory(clientId).then((data) => {
      const views = data.views || [];
      setViewCount(views.length);
      setFavoriteCount(views.filter((v: any) => v.action === "favorite").length);
    });
  }, [clientId]);

  // WeChat login
  const handleLogin = async () => {
    try {
      // Get user profile
      const profileRes = await Taro.getUserProfile({ desc: "用于完善您的个人信息" });
      const { nickName, avatarUrl } = profileRes.userInfo;

      // If already has clientId, just save user info
      if (clientId) {
        const info: UserInfo = { clientId, nickName, avatarUrl };
        setUserInfo(info);
        setUser(info);
        Taro.showToast({ title: "登录成功", icon: "success" });
        return;
      }

      // No clientId — show phone login
      Taro.showModal({
        title: "输入手机号",
        placeholderText: "请输入您的手机号",
        editable: true,
        success: async (res) => {
          if (res.confirm && res.content) {
            const loginRes = await clientLoginByPhone(res.content);
            if (loginRes.clientId) {
              setClientId(loginRes.clientId);
              const info: UserInfo = { clientId: loginRes.clientId, nickName, avatarUrl, phone: res.content };
              setUserInfo(info);
              setUser(info);
              Taro.showToast({ title: "登录成功", icon: "success" });
            } else {
              Taro.showToast({ title: "未找到账户，请联系经纪人", icon: "none" });
            }
          }
        },
      });
    } catch {
      Taro.showToast({ title: "授权已取消", icon: "none" });
    }
  };

  return (
    <View className="profile-page">
      {/* User card */}
      <View className="user-card">
        {user ? (
          <View className="user-info">
            <Image className="avatar" src={user.avatarUrl || ""} />
            <View>
              <Text className="nickname">{user.nickName}</Text>
              <Text className="subtitle">欢迎回来</Text>
            </View>
          </View>
        ) : (
          <View className="login-prompt">
            <View className="default-avatar">
              <Text className="default-avatar-text">?</Text>
            </View>
            <View>
              <Text className="nickname">未登录</Text>
              <Button className="login-btn" onClick={handleLogin}>微信登录</Button>
            </View>
          </View>
        )}
      </View>

      {/* Stats */}
      {clientId && (
        <View className="stats">
          <View className="stat-item">
            <Text className="stat-num">{viewCount}</Text>
            <Text className="stat-label">浏览记录</Text>
          </View>
          <View className="stat-item">
            <Text className="stat-num">{favoriteCount}</Text>
            <Text className="stat-label">我的收藏</Text>
          </View>
        </View>
      )}

      {/* Agent info */}
      {agentName && (
        <View className="agent-card">
          <Text className="agent-title">我的专属经纪人</Text>
          <View className="agent-info">
            {agentAvatar ? (
              <Image className="agent-avatar" src={agentAvatar} />
            ) : (
              <View className="agent-avatar-placeholder">
                <Text>{agentName[0]}</Text>
              </View>
            )}
            <Text className="agent-name">{agentName}</Text>
          </View>
        </View>
      )}

      {/* Menu */}
      <View className="menu">
        <View className="menu-item" onClick={() => Taro.switchTab({ url: "/pages/index/index" })}>
          <Text>🏠 搜索房源</Text>
        </View>
        <View className="menu-item" onClick={handleLogin}>
          <Text>📱 微信登录</Text>
        </View>
      </View>
    </View>
  );
}
