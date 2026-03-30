import { useState, useEffect } from "react";
import { View, Text, Image, ScrollView, Swiper, SwiperItem } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { getListingDetail, trackView, getAgentInfo, sendMessage } from "@/utils/api";
import { getClientId } from "@/utils/auth";
import "./index.scss";

export default function DetailPage() {
  const router = useRouter();
  const zpid = Number(router.params.zpid || 0);
  const passedAddress = decodeURIComponent(router.params.address || "");
  const passedPrice = Number(router.params.price || 0);
  const passedPhotos: string[] = (() => {
    try { return JSON.parse(decodeURIComponent(router.params.photos || "[]")); } catch { return []; }
  })();

  const clientId = getClientId();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");

  useEffect(() => {
    // Track view
    if (clientId && zpid) {
      trackView({ clientId, zpid, address: passedAddress, price: passedPrice, action: "view" });
    }

    // Load agent info
    if (clientId) {
      getAgentInfo(clientId).then((data) => {
        setAgentName(data.agentName || "经纪人");
        setAgentPhone(data.agentPhone || "");
      });
    }

    // Load detail
    if (zpid) {
      getListingDetail(zpid)
        .then((data) => {
          // Merge passed photos if detail has none
          if ((!data.photos || data.photos.length === 0) && passedPhotos.length > 0) {
            data.photos = passedPhotos;
          }
          setDetail(data);
        })
        .catch(() => {
          setDetail({ address: passedAddress, price: passedPrice, photos: passedPhotos });
        })
        .finally(() => setLoading(false));
    } else {
      setDetail({ address: passedAddress, price: passedPrice, photos: passedPhotos });
      setLoading(false);
    }
  }, []);

  const handleFavorite = () => {
    setIsFavorite(!isFavorite);
    if (!isFavorite && clientId) {
      trackView({ clientId, zpid, address: passedAddress, price: passedPrice, action: "favorite" });
    }
  };

  const handleContact = () => {
    Taro.showActionSheet({
      itemList: [
        agentPhone ? `拨打电话 ${agentPhone}` : "联系经纪人",
        "发送留言",
      ],
      success: (res) => {
        if (res.tapIndex === 0 && agentPhone) {
          Taro.makePhoneCall({ phoneNumber: agentPhone });
        } else if (res.tapIndex === 1) {
          Taro.showModal({
            title: `联系 ${agentName}`,
            placeholderText: `我对 ${passedAddress} 感兴趣`,
            editable: true,
            success: (modalRes) => {
              if (modalRes.confirm && modalRes.content && clientId) {
                sendMessage({
                  clientId,
                  message: modalRes.content,
                  listingAddress: passedAddress,
                  listingPrice: passedPrice,
                });
                Taro.showToast({ title: "留言已发送", icon: "success" });
              }
            },
          });
        }
      },
    });
  };

  if (loading) {
    return <View className="loading"><Text>加载中...</Text></View>;
  }

  const photos = detail?.photos || passedPhotos;
  const price = detail?.price || passedPrice;
  const address = detail?.address || passedAddress;

  return (
    <View className="detail-page">
      {/* Photo swiper */}
      <Swiper className="photo-swiper" indicatorDots indicatorColor="rgba(255,255,255,0.4)" indicatorActiveColor="#fff" circular>
        {photos.length > 0 ? photos.slice(0, 10).map((url: string, i: number) => (
          <SwiperItem key={i}>
            <Image className="photo" src={url} mode="aspectFill" />
          </SwiperItem>
        )) : (
          <SwiperItem>
            <View className="no-photo"><Text>暂无图片</Text></View>
          </SwiperItem>
        )}
      </Swiper>

      <ScrollView scrollY className="detail-content">
        {/* Price + address */}
        <View className="price-section">
          <Text className="price">${price.toLocaleString()}</Text>
          <Text className="address">{address}</Text>
        </View>

        {/* Stats */}
        {detail && (
          <View className="stats-row">
            {detail.beds > 0 && <Text className="stat">{detail.beds} 卧</Text>}
            {detail.baths > 0 && <Text className="stat">{detail.baths} 卫</Text>}
            {detail.sqft > 0 && <Text className="stat">{detail.sqft.toLocaleString()} sqft</Text>}
            {detail.yearBuilt && <Text className="stat">建于 {detail.yearBuilt}</Text>}
          </View>
        )}

        {/* Zestimate */}
        {detail?.zestimate && (
          <View className="zestimate">
            <Text>Zestimate: ${detail.zestimate.toLocaleString()}</Text>
          </View>
        )}

        {/* Description */}
        {detail?.description && (
          <View className="section">
            <Text className="section-title">房屋描述</Text>
            <Text className="desc-text">{detail.description}</Text>
          </View>
        )}

        {/* Schools */}
        {detail?.schools && detail.schools.length > 0 && (
          <View className="section">
            <Text className="section-title">学区</Text>
            {detail.schools.map((s: any, i: number) => (
              <View key={i} className="school-row">
                <View className="school-info">
                  <Text className="school-name">{s.name}</Text>
                  <Text className="school-meta">{s.type} · {s.distance}</Text>
                </View>
                <Text className={`school-rating ${s.rating >= 8 ? "high" : s.rating >= 5 ? "mid" : ""}`}>
                  {s.rating}/10
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Spacer for bottom bar */}
        <View style={{ height: "120px" }} />
      </ScrollView>

      {/* Bottom bar */}
      <View className="bottom-bar">
        <View className="fav-btn" onClick={handleFavorite}>
          <Text className={`fav-icon ${isFavorite ? "active" : ""}`}>♥</Text>
          <Text className="fav-text">收藏</Text>
        </View>
        <View className="contact-btn" onClick={handleContact}>
          <Text>联系经纪人 {agentName}</Text>
        </View>
      </View>
    </View>
  );
}
