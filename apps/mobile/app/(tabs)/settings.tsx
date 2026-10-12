import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { mobileApiClient } from "../../lib/api";
import { removeAuthToken } from "../../lib/auth";
import { AppSettings, AdminUserDTO } from "@connectme/contracts";

export default function MobileSettingsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [user, setUser] = useState<AdminUserDTO | null>(null);
  const [eventName, setEventName] = useState("");
  const [privacyNotice, setPrivacyNotice] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [userRes, settingsRes] = await Promise.all([
        mobileApiClient.getMe(),
        mobileApiClient.getSettings(),
      ]);

      if (userRes.success && userRes.data) {
        setUser(userRes.data.user);
      } else if (!userRes.success && userRes.error.code === "UNAUTHORIZED") {
        await removeAuthToken();
        router.replace("/login");
        return;
      }

      if (settingsRes.success && settingsRes.data) {
        setEventName(settingsRes.data.brandName || "");
        setPrivacyNotice(settingsRes.data.privacyNotice || "");
        setExpiryDays(String(settingsRes.data.defaultExpiryDays || 30));
      }
    } catch {
      setError("Failed to load settings from server.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSettings = async () => {
    setError(null);
    setSuccess(null);

    const parsedDays = parseInt(expiryDays, 10);
    if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      setError("Expiry days must be between 1 and 365.");
      return;
    }

    setSaving(true);
    try {
      const res = await mobileApiClient.updateSettings({
        brandName: eventName.trim(),
        privacyNotice: privacyNotice.trim(),
        defaultExpiryDays: parsedDays,
      });

      if (res.success) {
        setSuccess("Settings updated successfully.");
      } else {
        setError(res.error.message || "Failed to update settings.");
      }
    } catch {
      setError("Network error while saving settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const performLogout = async () => {
      setLoggingOut(true);
      try {
        await mobileApiClient.logout();
      } catch {
        // Ignore network errors on logout
      } finally {
        await removeAuthToken();
        router.replace("/login");
      }
    };

    if (Platform.OS === "web") {
      if (confirm("Are you sure you want to log out?")) {
        await performLogout();
      }
    } else {
      Alert.alert(
        "Confirm Sign Out",
        "Are you sure you want to sign out from Connect Me Admin?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign Out", style: "destructive", onPress: performLogout },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6D3CE8" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile Card */}
        {user && (
          <View style={styles.sectionCard}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>ADMINISTRATOR</Text>
            </View>
            <Text style={styles.sectionTitle}>{user.displayName || user.username}</Text>
            <Text style={styles.usernameText}>@{user.username}</Text>
            <Text style={styles.metaText}>
              Configured on {new Date(user.createdAt).toLocaleDateString()}
            </Text>
          </View>
        )}

        {/* Global Event & Public Settings */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Event & Privacy Configuration</Text>
          <Text style={styles.sectionDesc}>
            These settings govern the public contact submission experience for attendees scanning your QR codes.
          </Text>

          {error && (
            <View style={styles.alertError}>
              <Text style={styles.alertErrorText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={styles.alertSuccess}>
              <Text style={styles.alertSuccessText}>{success}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>EVENT NAME</Text>
            <TextInput
              style={styles.input}
              value={eventName}
              onChangeText={setEventName}
              placeholder="e.g. Devcon 7"
              placeholderTextColor="#777681"
            />
            <Text style={styles.hint}>Shown on the attendee submission header</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>DEFAULT CODE EXPIRATION (DAYS)</Text>
            <TextInput
              style={styles.input}
              value={expiryDays}
              onChangeText={setExpiryDays}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor="#777681"
            />
            <Text style={styles.hint}>Days before newly generated QR codes automatically expire</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PRIVACY NOTICE COPY</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={privacyNotice}
              onChangeText={setPrivacyNotice}
              placeholder="Attendee privacy disclosure statement..."
              placeholderTextColor="#777681"
              multiline
              numberOfLines={4}
            />
            <Text style={styles.hint}>
              Displayed at the bottom of the public form before submission
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={handleSaveSettings}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Security & System Info */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Security & Privacy Architecture</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoDot}>•</Text>
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Owner Privacy Invariant: </Text>
              Public attendees can never view your phone number, email address, or identity.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoDot}>•</Text>
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Single-Use Codes: </Text>
              QR codes are invalidated atomically upon first contact submission.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoDot}>•</Text>
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Zero Hardcoded Secrets: </Text>
              Authenticated via managed Argon2id tokens and secure device storage.
            </Text>
          </View>
        </View>

        {/* Sign Out Action */}
        <TouchableOpacity
          style={[styles.logoutButton, loggingOut && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color="#EF4444" size="small" />
          ) : (
            <Text style={styles.logoutButtonText}>Sign Out from Admin</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B10",
  },
  scroll: {
    padding: 16,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    backgroundColor: "#0B0B10",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#A5A4B2",
    marginTop: 12,
    fontSize: 14,
  },
  sectionCard: {
    backgroundColor: "#13121C",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#252044",
    marginBottom: 16,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#252044",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  badgeText: {
    color: "#C8A96B",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  sectionTitle: {
    color: "#F3EFE7",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionDesc: {
    color: "#A5A4B2",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  usernameText: {
    color: "#7E4DF5",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  emailText: {
    color: "#E2DEEC",
    fontSize: 14,
    marginBottom: 8,
  },
  metaText: {
    color: "#777681",
    fontSize: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: "#A5A4B2",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0B0B10",
    borderWidth: 1,
    borderColor: "#2F2B48",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#F3EFE7",
    fontSize: 14,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  hint: {
    color: "#777681",
    fontSize: 11,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: "#6D3CE8",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  alertError: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "#EF4444",
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  alertErrorText: {
    color: "#EF4444",
    fontSize: 13,
  },
  alertSuccess: {
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    borderWidth: 1,
    borderColor: "#34D399",
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  alertSuccessText: {
    color: "#34D399",
    fontSize: 13,
  },
  infoRow: {
    flexDirection: "row",
    marginTop: 10,
    alignItems: "flex-start",
  },
  infoDot: {
    color: "#7E4DF5",
    fontSize: 16,
    marginRight: 8,
    lineHeight: 18,
  },
  infoText: {
    color: "#A5A4B2",
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  bold: {
    color: "#F3EFE7",
    fontWeight: "600",
  },
  logoutButton: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  logoutButtonText: {
    color: "#EF4444",
    fontWeight: "700",
    fontSize: 14,
  },
});
