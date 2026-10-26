import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { mobileApiClient, API_BASE_URL } from "../lib/api";
import { saveAuthTokens } from "../lib/auth";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!API_BASE_URL) {
      setError("EXPO_PUBLIC_API_URL is not configured in .env");
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await mobileApiClient.login({ username: email.trim(), password });
      if (res.success && res.data.token && res.data.refreshToken) {
        await saveAuthTokens(res.data.token, res.data.refreshToken);
        router.replace("/(tabs)");
      } else {
        setError(!res.success ? res.error.message : "Login response did not include required session tokens.");
      }
    } catch (err: any) {
      console.error("[Login] Network failure:", err);
      setError(`Network error connecting to backend: ${err?.message || "Check connection"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.badge}><Text style={styles.badgeText}>DEVCON ADMIN</Text></View>
          <Text style={styles.title}>Connect Me</Text>
          <Text style={styles.subtitle}>“You share. We connect.”</Text>
          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>ADMIN USERNAME</Text>
            <TextInput style={styles.input} placeholder="e.g. harsh" placeholderTextColor="#777681"
              value={email} onChangeText={setEmail} autoCapitalize="none" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput style={styles.input} placeholder="••••••••••••" placeholderTextColor="#777681"
              value={password} onChangeText={setPassword} secureTextEntry />
          </View>
          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign In</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B10" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#13121C", borderRadius: 20, borderWidth: 1, borderColor: "#2F2B48", padding: 24,
    shadowColor: "#6D3CE8", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  badge: { alignSelf: "center", backgroundColor: "rgba(109, 60, 232, 0.15)", borderWidth: 1,
    borderColor: "rgba(109, 60, 232, 0.4)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 },
  badgeText: { color: "#C8A96B", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: "900", color: "#F3EFE7", textAlign: "center" },
  subtitle: { fontSize: 13, fontStyle: "italic", color: "#777681", textAlign: "center", marginBottom: 24 },
  errorBox: { backgroundColor: "rgba(248, 113, 113, 0.1)", borderWidth: 1, borderColor: "rgba(248, 113, 113, 0.3)",
    borderRadius: 10, padding: 10, marginBottom: 16 },
  errorText: { color: "#F87171", fontSize: 12 },
  inputGroup: { marginBottom: 16 },
  label: { color: "#A5A4B2", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 6 },
  input: { backgroundColor: "#1C1A29", borderWidth: 1, borderColor: "#2F2B48", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, color: "#F3EFE7", fontSize: 14 },
  button: { backgroundColor: "#6D3CE8", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 12,
    shadowColor: "#6D3CE8", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
