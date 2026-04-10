import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Camera,
  LogOut,
  Check,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import type { AgentProfile } from "@/types";

const DEFAULT_PROFILE: AgentProfile = {
  username: "",
  display_name: "",
  title: "房地产经纪人",
  phone: "",
  wechat: "",
  email: "",
  avatar_url: "",
};

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [profile, setProfile] = useState<AgentProfile>(DEFAULT_PROFILE);
  const [draft, setDraft] = useState<AgentProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        setAuthEmail(session.user.email || "");
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const loadProfile = async (uid: string) => {
    try {
      const { data } = await supabase!
        .from("agent_profiles")
        .select("*")
        .eq("user_id", uid)
        .single();
      if (data) {
        const p: AgentProfile = {
          username: data.username || "",
          display_name: data.display_name || "",
          title: data.title || "房地产经纪人",
          phone: data.phone || "",
          wechat: data.wechat || "",
          email: data.email || "",
          avatar_url: data.avatar_url || "",
        };
        setProfile(p);
        setDraft(p);
      }
    } catch (err) {
      console.error("loadProfile error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = useCallback(async () => {
    if (!supabase || !userId) return;
    setSaving(true);
    const { error } = await supabase.from("agent_profiles").upsert({
      user_id: userId,
      display_name: draft.display_name,
      title: draft.title,
      phone: draft.phone,
      wechat: draft.wechat,
      email: draft.email || authEmail,
      avatar_url: draft.avatar_url,
    });
    setSaving(false);
    if (!error) {
      setProfile(draft);
      setEditing(false);
      setToast("保存成功");
      setTimeout(() => setToast(""), 2000);
    } else {
      Alert.alert("保存失败", error.message);
    }
  }, [userId, draft, authEmail]);

  const handleLogout = async () => {
    Alert.alert("退出登录", "确定要退出吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "退出",
        style: "destructive",
        onPress: async () => {
          if (supabase) await supabase.auth.signOut();
        },
      },
    ]);
  };

  const displayName =
    profile.display_name || authEmail?.split("@")[0] || "Agent";
  const initial = displayName[0]?.toUpperCase() ?? "A";

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  // Edit view
  if (editing) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.editHeader}>
          <TouchableOpacity onPress={() => setEditing(false)}>
            <Text style={s.cancelText}>取消</Text>
          </TouchableOpacity>
          <Text style={s.editTitle}>编辑资料</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text
              style={[s.saveText, saving && { color: "#d1d5db" }]}
            >
              {saving ? "保存中..." : "保存"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.editContent}>
          {/* Avatar */}
          <View style={s.avatarSection}>
            <View style={s.avatarLg}>
              {draft.avatar_url ? (
                <Image source={{ uri: draft.avatar_url }} style={s.avatarLgImg} />
              ) : (
                <Text style={s.avatarLgText}>{initial}</Text>
              )}
            </View>
          </View>

          {/* Fields */}
          <View style={s.fieldCard}>
            <FieldRow label="用户名" value={draft.username || "—"} readOnly />
            <FieldRow
              label="显示名"
              value={draft.display_name}
              placeholder="显示名称"
              onChange={(v) =>
                setDraft((p) => ({ ...p, display_name: v }))
              }
            />
            <FieldRow
              label="职称"
              value={draft.title}
              placeholder="房地产经纪人"
              onChange={(v) => setDraft((p) => ({ ...p, title: v }))}
            />
            <FieldRow
              label="电话"
              value={draft.phone}
              placeholder="联系电话"
              keyboardType="phone-pad"
              onChange={(v) => setDraft((p) => ({ ...p, phone: v }))}
            />
            <FieldRow
              label="微信"
              value={draft.wechat}
              placeholder="微信号"
              onChange={(v) => setDraft((p) => ({ ...p, wechat: v }))}
            />
            <FieldRow
              label="邮箱"
              value={draft.email || authEmail}
              placeholder="电子邮箱"
              keyboardType="email-address"
              onChange={(v) => setDraft((p) => ({ ...p, email: v }))}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main profile view
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Toast */}
      {toast ? (
        <View style={s.toast}>
          <Check size={16} color="#fff" />
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.pageTitle}>个人中心</Text>

        {/* Profile Card */}
        <View style={s.profileCard}>
          <View style={s.avatarMd}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={s.avatarMdImg} />
            ) : (
              <Text style={s.avatarMdText}>{initial}</Text>
            )}
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{displayName}</Text>
            {profile.username ? (
              <Text style={s.profileUsername}>
                @{profile.username}
              </Text>
            ) : null}
            <Text style={s.profileTitle}>
              {profile.title || "房地产经纪人"}
            </Text>
          </View>
          <TouchableOpacity
            style={s.editProfileBtn}
            onPress={() => setEditing(true)}
          >
            <Text style={s.editProfileBtnText}>编辑</Text>
          </TouchableOpacity>
        </View>

        {/* Info Fields */}
        <View style={s.infoCard}>
          <InfoRow label="电话" value={profile.phone || "未设置"} />
          <InfoRow label="微信" value={profile.wechat || "未设置"} />
          <InfoRow
            label="邮箱"
            value={profile.email || authEmail || "未设置"}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <LogOut size={18} color="#ef4444" />
          <Text style={s.logoutText}>退出登录</Text>
        </TouchableOpacity>

        <Text style={s.footer}>Estate Epic v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function FieldRow({
  label,
  value,
  placeholder,
  readOnly,
  keyboardType,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  keyboardType?: "default" | "phone-pad" | "email-address";
  onChange?: (v: string) => void;
}) {
  return (
    <View style={s.fieldRow}>
      <Text style={s.fieldLabel}>{label}</Text>
      {readOnly ? (
        <Text style={s.fieldValueReadOnly}>{value}</Text>
      ) : (
        <TextInput
          style={s.fieldInput}
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#d1d5db"
          keyboardType={keyboardType}
          onChangeText={onChange}
        />
      )}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40 },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarMd: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMdText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2563eb",
  },
  avatarMdImg: { width: 56, height: 56, borderRadius: 28 },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 18, fontWeight: "700", color: "#111827" },
  profileUsername: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  profileTitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  editProfileBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
  },
  editProfileBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#2563eb",
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
  },
  infoLabel: { fontSize: 14, color: "#6b7280" },
  infoValue: { fontSize: 14, color: "#111827" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  logoutText: { fontSize: 14, fontWeight: "500", color: "#ef4444" },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#d1d5db",
    marginTop: 32,
  },
  // Toast
  toast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#16a34a",
    borderRadius: 8,
  },
  toastText: { fontSize: 14, color: "#fff" },
  // Edit
  editHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#fff",
  },
  cancelText: { fontSize: 14, color: "#6b7280" },
  editTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  saveText: { fontSize: 14, fontWeight: "600", color: "#2563eb" },
  editContent: { padding: 16, paddingBottom: 40 },
  avatarSection: { alignItems: "center", marginBottom: 20 },
  avatarLg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLgText: {
    fontSize: 30,
    fontWeight: "700",
    color: "#2563eb",
  },
  avatarLgImg: { width: 80, height: 80, borderRadius: 40 },
  fieldCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
  },
  fieldLabel: {
    width: 56,
    fontSize: 14,
    color: "#6b7280",
  },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    textAlign: "right",
  },
  fieldValueReadOnly: {
    flex: 1,
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "right",
  },
});
