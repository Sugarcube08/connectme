import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { mobileApiClient } from "../../lib/api";
import { DashboardMetrics, FollowUpStatus } from "@connectme/contracts";
import {
  QrCodeIcon,
  UsersIcon,
  SettingsIcon,
  PhoneIcon,
  MessageSquareIcon,
  SparklesIcon,
} from "../../components/Icons";
import { Theme } from "../../constants/theme";

export default function MobileDashboardScreen() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await mobileApiClient.getDashboard();
      if (res.success && res.data) {
        setMetrics(res.data);
      } else if (!res.success && res.error.code === "UNAUTHORIZED") {
        router.replace("/login");
      }
    } catch (err) {
      console.error("[Dashboard] Failed to fetch metrics", err);
    }
  }, [router]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await fetchMetrics();
      setLoading(false);
    }
    load();
  }, [fetchMetrics]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMetrics();
    setRefreshing(false);
  };

  const statusColors: Record<FollowUpStatus, { text: string; bg: string }> = {
    NEW: { text: Theme.colors.statusNew, bg: Theme.colors.statusNewBg },
    CONTACTED: { text: Theme.colors.statusContacted, bg: Theme.colors.statusContactedBg },
    REPLIED: { text: Theme.colors.statusReplied, bg: Theme.colors.statusRepliedBg },
    OPPORTUNITY: { text: Theme.colors.statusOpportunity, bg: Theme.colors.statusOpportunityBg },
    ARCHIVED: { text: Theme.colors.statusArchived, bg: Theme.colors.statusArchivedBg },
  };

  const handleCall = (phoneNumber: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber.replace(/\s+/g, "")}`).catch(() => {});
  };

  const handleSms = (phoneNumber: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`sms:${phoneNumber.replace(/\s+/g, "")}`).catch(() => {});
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const totalCodes = metrics?.totalCodes ?? 0;
  const consumedCodes = metrics?.consumedCodes ?? 0;
  const redemptionRate = totalCodes > 0 ? Math.round((consumedCodes / totalCodes) * 100) : 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Theme.colors.primary}
        />
      }
    >
      {/* Executive Welcome Banner */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={styles.tagBadge}>
            <SparklesIcon size={12} color={Theme.colors.gold} />
            <Text style={styles.tagBadgeText}>CONNECTION INTELLIGENCE</Text>
          </View>
          <View style={styles.rateBadge}>
            <Text style={styles.rateBadgeText}>{redemptionRate}% Conversion</Text>
          </View>
        </View>
        <Text style={styles.headerTitle}>Network Overview</Text>
        <Text style={styles.headerSubtitle}>
          Real-time connection intelligence & lead capture
        </Text>
      </View>

      {/* Metric Cards Grid */}
      <View style={styles.grid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>TOTAL CODES</Text>
          <Text style={styles.metricValue}>{metrics?.totalCodes ?? 0}</Text>
          <Text style={styles.metricSub}>Generated cards</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={[styles.metricLabel, { color: Theme.colors.statusReplied }]}>ACTIVE</Text>
          <Text style={[styles.metricValue, { color: Theme.colors.statusReplied }]}>
            {metrics?.activeCodes ?? 0}
          </Text>
          <Text style={styles.metricSub}>Ready to scan</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>CONSUMED</Text>
          <Text style={styles.metricValue}>{metrics?.consumedCodes ?? 0}</Text>
          <Text style={styles.metricSub}>Single-use burned</Text>
        </View>

        <View style={[styles.metricCard, styles.highlightCard]}>
          <Text style={[styles.metricLabel, { color: Theme.colors.gold }]}>LEADS COLLECTED</Text>
          <Text style={[styles.metricValue, { color: Theme.colors.textPrimary }]}>
            {metrics?.totalSubmissions ?? 0}
          </Text>
          <Text style={[styles.metricSub, { color: Theme.colors.gold }]}>Profiles captured</Text>
        </View>
      </View>

      {/* Quick Action Navigation Grid */}
      <View style={styles.actionSection}>
        <Text style={styles.sectionTitle}>Quick Operations</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/(tabs)/codes")}
          >
            <View style={[styles.actionIconWrapper, { backgroundColor: Theme.colors.primaryMuted }]}>
              <QrCodeIcon size={18} color={Theme.colors.primaryHover} />
            </View>
            <Text style={styles.actionTitle}>Generate QR</Text>
            <Text style={styles.actionSub}>Create new codes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/(tabs)/contacts")}
          >
            <View style={[styles.actionIconWrapper, { backgroundColor: Theme.colors.goldMuted }]}>
              <UsersIcon size={18} color={Theme.colors.gold} />
            </View>
            <Text style={styles.actionTitle}>Directory</Text>
            <Text style={styles.actionSub}>Browse leads</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/(tabs)/settings")}
          >
            <View style={[styles.actionIconWrapper, { backgroundColor: "rgba(52, 211, 153, 0.15)" }]}>
              <SettingsIcon size={18} color={Theme.colors.statusReplied} />
            </View>
            <Text style={styles.actionTitle}>SMS Gateway</Text>
            <Text style={styles.actionSub}>Dispatch settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Submissions Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Connections</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/contacts")}>
            <Text style={styles.viewAllText}>View All →</Text>
          </TouchableOpacity>
        </View>

        {metrics?.recentSubmissions && metrics.recentSubmissions.length > 0 ? (
          metrics.recentSubmissions.map((c) => {
            const statusConfig = statusColors[c.followUpStatus] || statusColors.NEW;
            return (
              <View key={c.id} style={styles.contactItem}>
                <View style={styles.contactMain}>
                  {/* Avatar Initials */}
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(c.fullName)}</Text>
                  </View>

                  {/* Info */}
                  <View style={styles.contactInfo}>
                    <View style={styles.contactHeader}>
                      <Text style={styles.contactName} numberOfLines={1}>
                        {c.fullName}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                        <Text style={[styles.statusText, { color: statusConfig.text }]}>
                          {c.followUpStatus}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.contactSub} numberOfLines={1}>
                      {[c.role, c.organization].filter(Boolean).join(" • ") || "Executive contact"}
                    </Text>

                    <Text style={styles.contactPhone}>{c.phoneNumber}</Text>
                  </View>
                </View>

                {/* Footer with date and quick buttons */}
                <View style={styles.contactFooter}>
                  <Text style={styles.contactDate}>
                    {new Date(c.submittedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>

                  <View style={styles.quickButtonsRow}>
                    <TouchableOpacity
                      style={styles.circleBtn}
                      onPress={() => handleCall(c.phoneNumber)}
                    >
                      <PhoneIcon size={13} color={Theme.colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.circleBtn}
                      onPress={() => handleSms(c.phoneNumber)}
                    >
                      <MessageSquareIcon size={13} color={Theme.colors.gold} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <UsersIcon size={28} color={Theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No connections recorded yet</Text>
            <Text style={styles.emptySubtitle}>
              Generate access cards and share them with conference attendees, VIPs, or partners.
            </Text>
            <TouchableOpacity
              style={styles.generateBtnSmall}
              onPress={() => router.push("/(tabs)/codes")}
            >
              <Text style={styles.generateBtnText}>Generate First Code</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 110, // Safe clearance for floating pill navbar
  },
  center: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    marginBottom: 20,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  tagBadgeText: {
    color: Theme.colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  rateBadge: {
    backgroundColor: Theme.colors.primaryMuted,
    borderWidth: 1,
    borderColor: "rgba(109, 60, 232, 0.4)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  rateBadgeText: {
    color: Theme.colors.primaryHover,
    fontSize: 11,
    fontWeight: "700",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: Theme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
  },
  highlightCard: {
    backgroundColor: "rgba(109, 60, 232, 0.12)",
    borderColor: "rgba(109, 60, 232, 0.35)",
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.colors.textMuted,
    letterSpacing: 0.8,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "900",
    color: Theme.colors.textPrimary,
    marginTop: 6,
  },
  metricSub: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  actionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Theme.colors.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  actionsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 12,
  },
  actionIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: Theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.colors.textPrimary,
  },
  actionSub: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  viewAllText: {
    color: Theme.colors.primaryHover,
    fontSize: 12,
    fontWeight: "700",
  },
  contactItem: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 14,
    marginBottom: 10,
  },
  contactMain: {
    flexDirection: "row",
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: Theme.colors.gold,
    fontWeight: "800",
    fontSize: 14,
  },
  contactInfo: {
    flex: 1,
  },
  contactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  contactName: {
    fontSize: 15,
    fontWeight: "800",
    color: Theme.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    borderRadius: Theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  contactSub: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  contactPhone: {
    fontSize: 12,
    color: Theme.colors.gold,
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  contactFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceElevated,
  },
  contactDate: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  quickButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  circleBtn: {
    width: 28,
    height: 28,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: Theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 12,
  },
  emptySubtitle: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 260,
  },
  generateBtnSmall: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 16,
  },
  generateBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
