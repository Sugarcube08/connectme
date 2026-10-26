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
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { mobileApiClient } from "../../lib/api";
import { removeAuthToken } from "../../lib/auth";
import { AdminUserDTO, AdminSmsSettingsDTO } from "@connectme/contracts";
import {
  SettingsIcon,
  ShieldCheckIcon,
  SparklesIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  LogOutIcon,
  RefreshIcon,
  MessageSquareIcon,
} from "../../components/Icons";
import { Theme } from "../../constants/theme";

export default function MobileSettingsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [user, setUser] = useState<AdminUserDTO | null>(null);

  // Global Brand Settings
  const [brandName, setBrandName] = useState("");
  const [privacyNotice, setPrivacyNotice] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");
  const [savingApp, setSavingApp] = useState(false);
  const [appSuccess, setAppSuccess] = useState<string | null>(null);

  // SMS Gateway Settings
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsGatewayUrl, setSmsGatewayUrl] = useState("");
  const [smsGatewayUsername, setSmsGatewayUsername] = useState("");
  const [smsGatewayPassword, setSmsGatewayPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [smsSenderPhone, setSmsSenderPhone] = useState("");
  const [smsSenderEmail, setSmsSenderEmail] = useState("");
  const [smsTemplate, setSmsTemplate] = useState("");
  const [savingSms, setSavingSms] = useState(false);
  const [testingHeartbeat, setTestingHeartbeat] = useState(false);
  const [smsSuccess, setSmsSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [userRes, settingsRes, smsRes] = await Promise.all([
        mobileApiClient.getMe(),
        mobileApiClient.getSettings(),
        mobileApiClient.getAdminSmsSettings(),
      ]);

      if (userRes.success && userRes.data) {
        setUser(userRes.data.user);
      } else if (!userRes.success && userRes.error.code === "UNAUTHORIZED") {
        await removeAuthToken();
        router.replace("/login");
        return;
      }

      if (settingsRes.success && settingsRes.data) {
        setBrandName(settingsRes.data.brandName || "Connect Me");
        setPrivacyNotice(settingsRes.data.privacyNotice || "");
        setExpiryDays(String(settingsRes.data.defaultExpiryDays || 30));
      }

      if (smsRes.success && smsRes.data) {
        setSmsEnabled(smsRes.data.smsEnabled || false);
        setSmsGatewayUrl(smsRes.data.smsGatewayUrl || "");
        setSmsGatewayUsername(smsRes.data.smsGatewayUsername || "");
        setHasPassword(Boolean(smsRes.data.hasPassword));
        setSmsSenderPhone(smsRes.data.smsSenderPhone || "");
        setSmsSenderEmail(smsRes.data.smsSenderEmail || "");
        setSmsTemplate(smsRes.data.smsTemplate || "");
      }
    } catch {
      console.error("[Settings] Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveApp = async () => {
    setAppSuccess(null);
    const parsedDays = parseInt(expiryDays, 10);
    if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      Alert.alert("Validation Error", "Default validity days must be between 1 and 365.");
      return;
    }

    setSavingApp(true);
    try {
      const res = await mobileApiClient.updateSettings({
        brandName: brandName.trim(),
        privacyNotice: privacyNotice.trim(),
        defaultExpiryDays: parsedDays,
      });

      if (res.success) {
        setAppSuccess("Application brand configuration saved.");
        setTimeout(() => setAppSuccess(null), 3000);
      } else {
        Alert.alert("Error", res.error.message || "Failed to save settings.");
      }
    } catch {
      Alert.alert("Error", "Network failure while saving settings.");
    } finally {
      setSavingApp(false);
    }
  };

  const handleSaveSms = async () => {
    setSmsSuccess(null);
    const trimmedUrl = smsGatewayUrl.trim();
    const trimmedUsername = smsGatewayUsername.trim();
    const trimmedPassword = smsGatewayPassword.trim();

    if (smsEnabled) {
      if (!trimmedUrl) {
        Alert.alert("Validation Error", "SMS Gateway URL is required when SMS delivery is enabled.");
        return;
      }
      if (!trimmedUsername) {
        Alert.alert("Validation Error", "SMS Gateway Username is required when SMS delivery is enabled.");
        return;
      }
      if (!hasPassword && !trimmedPassword) {
        Alert.alert("Validation Error", "SMS Gateway Password is required when configuring SMS gateway.");
        return;
      }
    }

    setSavingSms(true);
    try {
      const res = await mobileApiClient.updateAdminSmsSettings({
        smsEnabled,
        smsGatewayUrl: trimmedUrl || undefined,
        smsGatewayUsername: trimmedUsername || undefined,
        smsGatewayPassword: trimmedPassword || undefined,
        smsSenderPhone: smsSenderPhone.trim() || undefined,
        smsSenderEmail: smsSenderEmail.trim() || undefined,
        smsTemplate: smsTemplate.trim() || undefined,
      });

      if (res.success) {
        setHasPassword(Boolean(res.data.hasPassword));
        setSmsGatewayPassword("");
        setSmsSuccess("SMS Gateway settings saved securely.");
        setTimeout(() => setSmsSuccess(null), 3000);
      } else {
        Alert.alert("Save Failed", res.error.message);
      }
    } catch {
      Alert.alert("Error", "Network failure while saving SMS gateway configuration.");
    } finally {
      setSavingSms(false);
    }
  };

  const handleTestHeartbeat = async () => {
    const rawUrl = smsGatewayUrl.trim();
    if (!rawUrl) {
      Alert.alert("URL Required", "Please enter your SMS Gateway URL first.");
      return;
    }

    setTestingHeartbeat(true);
    try {
      const cleanUrl = rawUrl.replace(/\/+$/, "");
      const startupUrl = cleanUrl.endsWith("/health/startup")
        ? cleanUrl
        : `${cleanUrl}/health/startup`;

      const resp = await fetch(startupUrl, {
        method: "GET",
        headers: { "X-ConnectMe-Heartbeat": "mobile-test" },
      });

      if (resp.ok || resp.status === 200 || resp.status === 204) {
        Alert.alert("Heartbeat Success", `Gateway responded HTTP ${resp.status}. Service is awake and responsive!`);
      } else {
        Alert.alert("Gateway Warning", `Gateway responded with HTTP status ${resp.status}. Check service logs.`);
      }
    } catch (err: any) {
      Alert.alert("Connection Failed", `Failed to reach gateway startup endpoint: ${err?.message || "Network unreachable"}`);
    } finally {
      setTestingHeartbeat(false);
    }
  };

  const handleInsertTemplateTag = (tag: string) => {
    setSmsTemplate((prev) => (prev ? `${prev} ${tag}` : tag));
  };

  const handleLogout = async () => {
    Alert.alert(
      "Confirm Sign Out",
      "Are you sure you want to sign out from Connect Me Administrator?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            setLoggingOut(true);
            try {
              await mobileApiClient.logout();
            } catch {}
            finally {
              await removeAuthToken();
              router.replace("/login");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
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
        {/* Administrator Profile Card */}
        {user && (
          <View style={styles.sectionCard}>
            <View style={styles.badge}>
              <SparklesIcon size={12} color={Theme.colors.gold} />
              <Text style={styles.badgeText}>AUTHENTICATED ADMINISTRATOR</Text>
            </View>
            <Text style={styles.sectionTitle}>{user.displayName || user.username}</Text>
            <Text style={styles.usernameText}>@{user.username}</Text>
            <Text style={styles.metaText}>
              Provisioned on {new Date(user.createdAt).toLocaleDateString()}
            </Text>
          </View>
        )}

        {/* SMS Gateway Configuration (Brand new & matches web!) */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Automated SMS Dispatch</Text>
              <Text style={styles.sectionDesc}>
                Deliver automated text messages to attendees immediately upon successful contact card submission.
              </Text>
            </View>
            <Switch
              value={smsEnabled}
              onValueChange={setSmsEnabled}
              trackColor={{ false: Theme.colors.surfaceElevated, true: Theme.colors.primary }}
              thumbColor={smsEnabled ? Theme.colors.gold : Theme.colors.textMuted}
            />
          </View>

          {smsSuccess ? (
            <View style={styles.alertSuccess}>
              <Text style={styles.alertSuccessText}>{smsSuccess}</Text>
            </View>
          ) : null}

          {smsEnabled ? (
            <View style={styles.smsFieldsContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>GATEWAY SERVER URL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://androgateserver.onrender.com"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={smsGatewayUrl}
                  onChangeText={setSmsGatewayUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.hint}>
                  Base URL of your Android SMS Gateway or self-hosted dispatch relay
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>GATEWAY USERNAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. gateway_user"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={smsGatewayUsername}
                  onChangeText={setSmsGatewayUsername}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  GATEWAY PASSWORD {hasPassword ? "(ENCRYPTED & CONFIGURED)" : ""}
                </Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder={hasPassword ? "Leave blank to preserve password" : "Enter gateway password"}
                    placeholderTextColor={Theme.colors.textMuted}
                    value={smsGatewayPassword}
                    onChangeText={setSmsGatewayPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOffIcon size={18} color={Theme.colors.textMuted} />
                    ) : (
                      <EyeIcon size={18} color={Theme.colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>SENDER PHONE NUMBER (OPTIONAL)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+916260329127"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={smsSenderPhone}
                  onChangeText={setSmsSenderPhone}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>SMS MESSAGE TEMPLATE</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  multiline
                  placeholder="Hi {attendee_name}! It was wonderful meeting you. Here are my contact details..."
                  placeholderTextColor={Theme.colors.textMuted}
                  value={smsTemplate}
                  onChangeText={setSmsTemplate}
                />
                <Text style={styles.hint}>Available tokens to insert:</Text>
                <View style={styles.chipsRow}>
                  {["{attendee_name}", "{owner_name}", "{owner_phone}", "{owner_email}"].map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.tokenChip}
                      onPress={() => handleInsertTemplateTag(tag)}
                    >
                      <Text style={styles.tokenChipText}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Action Buttons for SMS */}
              <View style={styles.smsButtonRow}>
                <TouchableOpacity
                  style={[styles.testHeartbeatBtn, testingHeartbeat && styles.buttonDisabled]}
                  onPress={handleTestHeartbeat}
                  disabled={testingHeartbeat}
                >
                  {testingHeartbeat ? (
                    <ActivityIndicator color={Theme.colors.gold} size="small" />
                  ) : (
                    <>
                      <RefreshIcon size={14} color={Theme.colors.gold} />
                      <Text style={styles.testHeartbeatText}>Wake & Test Gateway</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryButton, savingSms && styles.buttonDisabled]}
                  onPress={handleSaveSms}
                  disabled={savingSms}
                >
                  {savingSms ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save SMS Settings</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 12 }]}
              onPress={handleSaveSms}
              disabled={savingSms}
            >
              {savingSms ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Save Disabled Status</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Global Brand & Privacy Settings */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Event & Brand Experience</Text>
          <Text style={styles.sectionDesc}>
            Customization presented to attendees when scanning your single-use codes across conferences, networking lounges, or trade conclaves.
          </Text>

          {appSuccess ? (
            <View style={styles.alertSuccess}>
              <Text style={styles.alertSuccessText}>{appSuccess}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>BRAND OR EVENT TITLE</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Connect Me, VIP Conclave, Tech Summit"
              placeholderTextColor={Theme.colors.textMuted}
              value={brandName}
              onChangeText={setBrandName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>DEFAULT VALIDITY (DAYS)</Text>
            <TextInput
              style={styles.input}
              placeholder="30"
              placeholderTextColor={Theme.colors.textMuted}
              value={expiryDays}
              onChangeText={setExpiryDays}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PRIVACY NOTICE / STATEMENT</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              placeholder="Your contact details are encrypted and securely shared only with the verified organizer..."
              placeholderTextColor={Theme.colors.textMuted}
              value={privacyNotice}
              onChangeText={setPrivacyNotice}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, savingApp && styles.buttonDisabled]}
            onPress={handleSaveApp}
            disabled={savingApp}
          >
            {savingApp ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Save Event Configuration</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Security Architecture Invariants */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Security & Privacy Architecture</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoDot}>•</Text>
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Owner Privacy Invariant: </Text>
              Public attendees can never view your phone number, email address, or identity until you respond.
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
              <Text style={styles.bold}>Encrypted Credentials: </Text>
              SMS gateway passwords and administrative secrets are encrypted at rest with AES-256-GCM.
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
            <ActivityIndicator color={Theme.colors.error} size="small" />
          ) : (
            <View style={styles.logoutContent}>
              <LogOutIcon size={16} color={Theme.colors.error} />
              <Text style={styles.logoutButtonText}>Sign Out from Administrator</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 110, // Safe clearance for floating pill navbar
  },
  center: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: Theme.colors.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  sectionCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
    marginBottom: 10,
  },
  badgeText: {
    color: Theme.colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  sectionTitle: {
    color: Theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 4,
  },
  sectionDesc: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  usernameText: {
    color: Theme.colors.primaryHover,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  metaText: {
    color: Theme.colors.textMuted,
    fontSize: 12,
  },
  smsFieldsContainer: {
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    color: Theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: Theme.colors.textPrimary,
    fontSize: 14,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    padding: 6,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  hint: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  tokenChip: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.radius.sm,
  },
  tokenChipText: {
    color: Theme.colors.gold,
    fontSize: 11,
    fontWeight: "700",
  },
  smsButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  testHeartbeatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(200, 169, 107, 0.4)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Theme.radius.md,
  },
  testHeartbeatText: {
    color: Theme.colors.gold,
    fontSize: 12,
    fontWeight: "700",
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Theme.colors.primary,
    paddingVertical: 12,
    borderRadius: Theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 12,
    borderRadius: Theme.radius.md,
  },
  secondaryButtonText: {
    color: Theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  alertSuccess: {
    backgroundColor: Theme.colors.successBg,
    borderWidth: 1,
    borderColor: Theme.colors.successBorder,
    padding: 10,
    borderRadius: Theme.radius.md,
    marginBottom: 12,
  },
  alertSuccessText: {
    color: Theme.colors.success,
    fontSize: 12,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    marginTop: 8,
    alignItems: "flex-start",
  },
  infoDot: {
    color: Theme.colors.primaryHover,
    fontSize: 16,
    marginRight: 8,
    lineHeight: 18,
  },
  infoText: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  bold: {
    color: Theme.colors.textPrimary,
    fontWeight: "700",
  },
  logoutButton: {
    backgroundColor: Theme.colors.errorBg,
    borderWidth: 1,
    borderColor: Theme.colors.errorBorder,
    borderRadius: Theme.radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  logoutContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoutButtonText: {
    color: Theme.colors.error,
    fontWeight: "700",
    fontSize: 14,
  },
});
