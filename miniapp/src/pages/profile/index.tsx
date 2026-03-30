import { View, Text, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";

export default function ProfilePage() {
  const handleLogin = () => {
    Taro.getUserProfile({
      desc: "用于完善您的个人信息",
      success: (res) => {
        Taro.showToast({ title: `欢迎 ${res.userInfo.nickName}`, icon: "success" });
      },
      fail: () => {
        Taro.showToast({ title: "授权已取消", icon: "none" });
      },
    });
  };

  return (
    <View style={{ padding: "48rpx" }}>
      <View style={{ textAlign: "center", marginBottom: "48rpx" }}>
        <Text style={{ fontSize: "36rpx", fontWeight: "bold" }}>我的</Text>
      </View>
      <Button onClick={handleLogin} type="primary" style={{ borderRadius: "16rpx" }}>
        微信登录
      </Button>
    </View>
  );
}
