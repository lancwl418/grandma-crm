import { View, Text } from "@tarojs/components";
import "./index.scss";

export default function IndexPage() {
  return (
    <View className="index-page">
      <View className="search-bar">
        <Text style={{ fontSize: "36rpx", fontWeight: "bold" }}>Estate Epic 找房</Text>
        <Text style={{ fontSize: "24rpx", color: "#94a3b8", marginTop: "8rpx" }}>搜索你的理想家园</Text>
      </View>

      <View className="home-content">
        <Text className="section-title">热门地区</Text>
        <View className="hot-areas">
          {[
            { name: "Irvine", emoji: "🏘️" },
            { name: "Arcadia", emoji: "🌳" },
            { name: "San Marino", emoji: "🏛️" },
            { name: "Pasadena", emoji: "🌹" },
            { name: "Chino Hills", emoji: "⛰️" },
            { name: "Walnut", emoji: "🌰" },
          ].map((area) => (
            <View key={area.name} className="area-item">
              <Text className="area-emoji">{area.emoji}</Text>
              <Text className="area-name">{area.name}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
