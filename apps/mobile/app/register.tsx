import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { mobileApiClient, API_BASE_URL } from "../lib/api";
import { saveAuthTokens } from "../lib/auth";
import { SparklesIcon, ShieldCheckIcon } from "../components/Icons";
import { Theme } from "../constants/theme";

export default function RegisterScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [number, setNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP Verification state (dynamically driven by server response)
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleRegister = async () => {
    setError(null);
    if (!API_BASE_URL) {
      setError("EXPO_PUBLIC_API_URL is not configured in .env");
      return;
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanNumber = number.trim();

    if (!cleanName) {
      setError("Please enter your full name.");
      return;
    }
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!cleanNumber || cleanNumber.length < 5) {
      setError("Please enter a valid phone number (at least 5 digits).");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must contain at least one uppercase letter and one number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (otpStep && (!otp.trim() || otp.trim().length < 6)) {
      setError("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    setLoading(true);
    try {
      const res = await mobileApiClient.register({
        name: cleanName,
        email: cleanEmail,
        number: cleanNumber,
        password,
        ...(otpStep ? { otp: otp.trim() } : {}),
      });

      if (!res.success) {
        setError(res.error.message || "Registration failed. Please check your details.");
        return;
      }

      // If backend indicates OTP verification is required
      if (res.data.requiresOtp) {
        setOtpStep(true);
        setOtpNotice(res.data.message || `A verification code was sent to ${cleanEmail}.`);
        setResendCooldown(30);
        return;
      }

      if (res.data.token && res.data.refreshToken) {
        await saveAuthTokens(res.data.token, res.data.refreshToken);
        router.replace("/(tabs)");
      } else {
        setError("Registration response did not include required session tokens.");
      }
    } catch (err: any) {
      console.error("[Register] Network failure:", err);
      setError(`Network error connecting to backend: ${err?.message || "Check connection"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return;
    setError(null);
    setResending(true);
    try {
      const res = await mobileApiClient.resendOtp(email.trim().toLowerCase());
      if (res.success) {
        setOtpNotice(res.data.message || "A fresh verification code has been sent.");
        setResendCooldown(30);
      } else {
        setError(res.error.message || "Failed to resend code.");
      }
    } catch (err: any) {
      setError(`Network error: ${err?.message || "Check connection"}`);
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          {/* Top Brand Badge */}
          <View style={styles.badge}>
            <SparklesIcon size={12} color={Theme.colors.gold} />
            <Text style={styles.badgeText}>
              {otpStep ? "SECURITY VERIFICATION" : "ADMINISTRATOR REGISTRATION"}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            CONNECT <Text style={{ color: Theme.colors.primaryHover }}>ME</Text>
          </Text>
          <Text style={styles.tagline}>“You share. We connect.”</Text>
          <Text style={styles.subtitle}>
            {otpStep
              ? `Enter the 6-digit code sent to ${email.trim()}`
              : "Create your account to start generating codes and collecting attendee leads"}
          </Text>

          {!otpStep && (
            /* Tab Switcher: Sign In | Register */
            <View style={styles.tabSwitcher}>
              <TouchableOpacity
                style={styles.tabButton}
                onPress={() => router.push("/login")}
              >
                <Text style={styles.tabButtonText}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, styles.tabButtonActive]}>
                <Text style={[styles.tabButtonText, styles.tabButtonTextActive]}>
                  Create Account
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Success / OTP Notice */}
          {otpNotice && otpStep && (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>{otpNotice}</Text>
            </View>
          )}

          {/* Error Message */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {otpStep ? (
            /* OTP Input Form */
            <View>
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>6-DIGIT VERIFICATION CODE</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setOtpStep(false);
                      setError(null);
                    }}
                  >
                    <Text style={styles.editLink}>Edit Details</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.otpInput}
                  placeholder="123456"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={otp}
                  onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.button, (loading || otp.length < 6) && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading || otp.length < 6}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonText}>Verify &amp; Activate Account</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.otpActionRow}>
                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={resending || resendCooldown > 0}
                >
                  <Text style={[styles.resendText, (resending || resendCooldown > 0) && { opacity: 0.5 }]}>
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : resending
                      ? "Sending..."
                      : "Resend Code"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setOtpStep(false);
                    setError(null);
                  }}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Standard Registration Form */
            <View>
              {/* Name Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>YOUR FULL NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Harsh Raikwar"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Email Address */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>EMAIL ADDRESS</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. harsh@example.com"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>

              {/* Phone Number */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>PHONE NUMBER</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. +91 62603 29127"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={number}
                  onChangeText={setNumber}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter password"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonText}>Create Administrator Account</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Bottom Switch Link */}
              <TouchableOpacity
                style={styles.switchLink}
                onPress={() => router.push("/login")}
              >
                <Text style={styles.switchLinkText}>
                  Already have an account? <Text style={styles.goldLink}>Sign in here →</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Footer Security Note */}
          <View style={styles.footerNote}>
            <ShieldCheckIcon size={15} color={Theme.colors.primary} />
            <Text style={styles.footerNoteText}>
              Each account has private, isolated contact storage with zero public exposure
            </Text>
          </View>
        </View>
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
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    paddingTop: 36,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Theme.radius.full,
    marginBottom: 16,
  },
  badgeText: {
    color: Theme.colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: Theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.colors.gold,
    fontStyle: "italic",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: Theme.radius.md,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: Theme.radius.sm,
  },
  tabButtonActive: {
    backgroundColor: Theme.colors.primary,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.colors.textMuted,
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
  },
  switchLink: {
    marginTop: 16,
    alignItems: "center",
  },
  switchLinkText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  goldLink: {
    color: Theme.colors.gold,
    fontWeight: "700",
  },
  noticeBox: {
    backgroundColor: "rgba(124, 58, 237, 0.12)",
    borderColor: "rgba(124, 58, 237, 0.3)",
    borderWidth: 1,
    padding: 12,
    borderRadius: Theme.radius.md,
    marginBottom: 16,
  },
  noticeText: {
    color: "#D8B4FE",
    fontSize: 12,
    lineHeight: 17,
  },
  errorBox: {
    backgroundColor: Theme.colors.errorBg,
    borderColor: Theme.colors.errorBorder,
    borderWidth: 1,
    padding: 12,
    borderRadius: Theme.radius.md,
    marginBottom: 18,
  },
  errorText: {
    color: Theme.colors.error,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.colors.textSecondary,
    letterSpacing: 0.8,
  },
  editLink: {
    fontSize: 11,
    color: Theme.colors.gold,
    fontWeight: "600",
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
  otpInput: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: Theme.colors.gold,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  otpActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  resendText: {
    color: Theme.colors.gold,
    fontSize: 12,
    fontWeight: "700",
  },
  cancelText: {
    color: Theme.colors.textMuted,
    fontSize: 12,
  },
  button: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.4,
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceElevated,
  },
  footerNoteText: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },
});
