import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { mobileApiClient } from "../../lib/api";
import { DashboardMetrics, FollowUpStatus } from "@connectme/contracts";

export default function MobileDashboardScreen() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = useCallback(async () => {
    const res = await mobileApiClient.getDashboard();
    if (res.success && res.data) {
      setMetrics(res.data);
    } else if (!res.success && res.error.code === "UNAUTHORIZED") {
      router.replace("/login");
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

  const statusColors: Record<FollowUpStatus, string> = {
    NEW: "#60A5FA",
    CONTACTED: "#C084FC",
    REPLIED: "#34D399",
    OPPORTUNITY: "#FBBF24",
    ARCHIVED: "#777681",
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6D3CE8" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6D3CE8" />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Network Intelligence</Text>
        <Text style={styles.headerSubtitle}>Real-time Devcon contact collection</Text>
      </View>

      {/* Metric Cards Grid */}
      <View style={styles.grid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>TOTAL CODES</Text>
          <Text style={styles.metricValue}>{metrics?.totalCodes ?? 0}</Text>
          <Text style={styles.metricSub}>Generated</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={[styles.metricLabel, { color: "#34D399" }]}>ACTIVE</Text>
          <Text style={[styles.metricValue, { color: "#34D399" }]}>
            {metrics?.activeCodes ?? 0}
          </Text>
          <Text style={styles.metricSub}>Unused</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>CONSUMED</Text>
          <Text style={styles.metricValue}>{metrics?.consumedCodes ?? 0}</Text>
          <Text style={styles.metricSub}>Single-use burned</Text>
        </View>

        <View style={[styles.metricCard, styles.highlightCard]}>
          <Text style={[styles.metricLabel, { color: "#C8A96B" }]}>CONTACTS</Text>
          <Text style={[styles.metricValue, { color: "#F3EFE7" }]}>
            {metrics?.totalSubmissions ?? 0}
          </Text>
          <Text style={[styles.metricSub, { color: "#C8A96B" }]}>Submissions</Text>
        </View>
      </View>

      {/* Recent Submissions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Submissions</Text>

        {metrics?.recentSubmissions && metrics.recentSubmissions.length > 0 ? (
          metrics.recentSubmissions.map((c) => (
            <View key={c.id} style={styles.contactItem}>
              <View style={styles.contactHeader}>
                <Text style={styles.contactName}>{c.fullName}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { borderColor: statusColors[c.followUpStatus] + "50" },
                  ]}
                >
                  <Text
                    style={[styles.statusText, { color: statusColors[c.followUpStatus] }]}
                  >
                    {c.followUpStatus}
                  </Text>
                </View>
              </View>

              <Text style={styles.contactSub}>
                {[c.role, c.organization].filter(Boolean).join(" • ") || "No role listed"}
              </Text>

              <Text style={styles.contactPhone}>{c.phoneNumber}</Text>

              <Text style={styles.contactDate}>
                {new Date(c.submittedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No contacts submitted yet.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B10",
  },
  content: {
    padding: 16,
    paddingBottom: 30,
  },
  center: {
    flex: 1,
    backgroundColor: "#0B0B10",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F3EFE7",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#777681",
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: "#13121C",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2F2B48",
    padding: 16,
  },
  highlightCard: {
    backgroundColor: "rgba(109, 60, 232, 0.15)",
    borderColor: "rgba(109, 60, 232, 0.4)",
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#777681",
    letterSpacing: 0.8,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "900",
    color: "#F3EFE7",
    marginTop: 6,
  },
  metricSub: {
    fontSize: 10,
    color: "#777681",
    marginTop: 2,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F3EFE7",
    marginBottom: 12,
  },
  contactItem: {
    backgroundColor: "#13121C",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2F2B48",
    padding: 14,
    marginBottom: 10,
  },
  contactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  contactName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F3EFE7",
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "700",
  },
  contactSub: {
    fontSize: 12,
    color: "#A5A4B2",
    marginTop: 3,
  },
  contactPhone: {
    fontSize: 12,
    color: "#C8A96B",
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  contactDate: {
    fontSize: 10,
    color: "#777681",
    marginTop: 6,
  },
  emptyCard: {
    backgroundColor: "#13121C",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2F2B48",
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#777681",
    fontSize: 13,
  },
});
