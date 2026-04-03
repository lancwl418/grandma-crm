import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://grandma-crm.onrender.com";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!supabase) {
      setError("Supabase 未配置");
      return;
    }
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        let email = identifier.trim();

        if (!email.includes("@")) {
          const res = await fetch(
            `${API_BASE}/api/browse/lookup-username?username=${encodeURIComponent(email)}`
          );
          const data = await res.json();
          if (data.email) {
            email = data.email;
          } else {
            throw new Error("用户名不存在");
          }
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        if (!identifier.includes("@")) {
          throw new Error("请输入有效的邮箱地址");
        }
        if (!username.trim()) {
          throw new Error("请输入用户名");
        }

        const { data, error } = await supabase.auth.signUp({
          email: identifier.trim(),
          password,
          options: { data: { username: username.trim() } },
        });
        if (error) throw error;

        if (data.user) {
          await supabase.from("agent_profiles").upsert({
            user_id: data.user.id,
            username: username.trim().toLowerCase(),
            display_name: username.trim(),
          });
        }
      }
    } catch (err: any) {
      setError(err.message || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={s.form}>
          {/* Logo */}
          <View style={s.logoSection}>
            <View style={s.logoBox}>
              <Text style={s.logoText}>EE</Text>
            </View>
            <Text style={s.appName}>Estate Epic</Text>
            <Text style={s.subtitle}>
              {mode === "login" ? "欢迎回来" : "创建新账号"}
            </Text>
          </View>

          {/* Username (signup only) */}
          {mode === "signup" && (
            <TextInput
              style={s.input}
              placeholder="用户名 / Username"
              placeholderTextColor="#9ca3af"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          )}

          <TextInput
            style={s.input}
            placeholder={
              mode === "login" ? "邮箱或用户名" : "邮箱 / Email"
            }
            placeholderTextColor="#9ca3af"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={s.input}
            placeholder="密码 / Password"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.submitBtn, loading && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={s.submitBtnText}>
              {loading
                ? "请稍候..."
                : mode === "login"
                ? "登录"
                : "注册"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
            style={s.switchBtn}
          >
            <Text style={s.switchText}>
              {mode === "login" ? "没有账号？注册" : "已有账号？登录"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eff6ff" },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  form: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  logoSection: { alignItems: "center", marginBottom: 24 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoText: { fontSize: 24, fontWeight: "800", color: "#fff" },
  appName: { fontSize: 20, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 13, color: "#9ca3af", marginTop: 4 },
  input: {
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
    marginBottom: 12,
  },
  error: {
    fontSize: 12,
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnDisabled: { backgroundColor: "#d1d5db" },
  submitBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  switchBtn: { marginTop: 16, alignItems: "center" },
  switchText: { fontSize: 13, color: "#2563eb" },
});
