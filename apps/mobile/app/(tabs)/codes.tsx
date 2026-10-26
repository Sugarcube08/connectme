import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
  Alert,
  Share,
  Clipboard,
  Platform,
  ScrollView,
  RefreshControl,
} from "react-native";
import { mobileApiClient } from "../../lib/api";
import { AccessCodeItem, GeneratedCodeDetail, CodeStatus } from "@connectme/contracts";
import {
  QrCodeIcon,
  PlusIcon,
  SearchIcon,
  CopyIcon,
  ShareIcon,
  BanIcon,
  CloseIcon,
  CheckIcon,
  SparklesIcon,
  ClockIcon,
} from "../../components/Icons";
import { Theme } from "../../constants/theme";

export default function MobileCodesScreen() {
  const [codes, setCodes] = useState<AccessCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Generate Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [count, setCount] = useState("1");
  const [label, setLabel] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");
  const [generating, setGenerating] = useState(false);

  // Result QR Modal
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedCodeDetail[] | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchCodes = useCallback(async () => {
    try {
      const res = await mobileApiClient.listCodes({
        limit: 50,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        search: search.trim() || undefined,
      });
      if (res.success && res.data) {
        setCodes(res.data);
      }
    } catch (err) {
      console.error("[Codes] Failed to fetch access codes", err);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await fetchCodes();
      setLoading(false);
    }
    load();
  }, [fetchCodes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCodes();
    setRefreshing(false);
  };

  const handleGenerate = async () => {
    const safeCount = parseInt(count, 10) || 1;
    const safeExpiry = parseInt(expiryDays, 10);
    const expiresAt =
      !isNaN(safeExpiry) && safeExpiry > 0
        ? new Date(Date.now() + safeExpiry * 24 * 3600 * 1000).toISOString()
        : null;

    setGenerating(true);
    try {
      const res = await mobileApiClient.createCodes({
        count: safeCount,
        label: label.trim() || undefined,
        expiresAt,
      });

      if (res.success && res.data) {
        setModalVisible(false);
        const details: GeneratedCodeDetail[] = Array.isArray((res.data as any).codes)
          ? (res.data as any).codes
          : [res.data as GeneratedCodeDetail];
        setGeneratedCodes(details);
        setLabel("");
        setCount("1");
        fetchCodes();
      } else {
        Alert.alert("Generation Failed", !res.success ? res.error.message : "Failed to create access codes.");
      }
    } catch {
      Alert.alert("Network Failure", "Unable to connect to server.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = (id: string, token: string) => {
    Alert.alert(
      "Revoke Code",
      `Are you sure you want to permanently revoke code ${token.slice(0, 10)}...? It can never be redeemed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            const res = await mobileApiClient.revokeCode(id);
            if (res.success) {
              fetchCodes();
            } else {
              Alert.alert("Error", res.error.message);
            }
          },
        },
      ]
    );
  };

  const handleCopyLink = (url: string, token: string) => {
    Clipboard.setString(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleShare = async (url: string, labelText?: string | null) => {
    try {
      await Share.share({
        message: `Connect with me: ${url}`,
        title: labelText ? `Connect Me (${labelText})` : "Connect Me Access Card",
        url,
      });
    } catch {}
  };

  const getStatusBadge = (status: CodeStatus) => {
    switch (status) {
      case "ACTIVE":
        return { text: "ACTIVE", color: Theme.colors.statusReplied, bg: Theme.colors.statusRepliedBg };
      case "CONSUMED":
        return { text: "CONSUMED", color: Theme.colors.gold, bg: Theme.colors.goldMuted };
      case "REVOKED":
        return { text: "REVOKED", color: Theme.colors.error, bg: Theme.colors.errorBg };
      case "EXPIRED":
        return { text: "EXPIRED", color: Theme.colors.statusOpportunity, bg: Theme.colors.statusOpportunityBg };
      default:
        return { text: status, color: Theme.colors.textMuted, bg: Theme.colors.surfaceElevated };
    }
  };

  const filterOptions = ["ALL", "ACTIVE", "CONSUMED", "REVOKED", "EXPIRED"];

  return (
    <View style={styles.container}>
      {/* Search & Filter Header */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <SearchIcon size={16} color={Theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search code tokens or context tags..."
            placeholderTextColor={Theme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <CloseIcon size={16} color={Theme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filterOptions.map((opt) => {
            const isSelected = statusFilter === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setStatusFilter(opt)}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Code List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={codes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Theme.colors.primary}
            />
          }
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
            const tokenRef = item.token || item.id;
            const tokenDisplay = item.token ? `${item.token.slice(0, 10)}••••` : `Code #${item.id.slice(0, 8)}`;
            const isCopied = copiedToken === tokenRef;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.tokenContainer}>
                    <QrCodeIcon size={15} color={badge.color} />
                    <Text style={styles.tokenText}>{tokenDisplay}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
                  </View>
                </View>

                {item.label ? (
                  <Text style={styles.labelText}>
                    Tag: <Text style={{ color: Theme.colors.textPrimary }}>{item.label}</Text>
                  </Text>
                ) : null}

                <View style={styles.metaRow}>
                  <Text style={styles.dateText}>
                    Created {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                  {item.expiresAt ? (
                    <View style={styles.expiryBadge}>
                      <ClockIcon size={11} color={Theme.colors.textMuted} />
                      <Text style={styles.dateText}>
                        Expires {new Date(item.expiresAt).toLocaleDateString()}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.dateText}>No Expiration</Text>
                  )}
                </View>

                {/* Bottom Action Bar */}
                <View style={styles.cardActions}>
                  {item.url && item.status === "ACTIVE" ? (
                    <>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleCopyLink(item.url!, tokenRef)}
                      >
                        {isCopied ? (
                          <CheckIcon size={14} color={Theme.colors.statusReplied} />
                        ) : (
                          <CopyIcon size={14} color={Theme.colors.textPrimary} />
                        )}
                        <Text style={[styles.actionBtnText, isCopied && { color: Theme.colors.statusReplied }]}>
                          {isCopied ? "Copied" : "Copy Link"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnHighlight]}
                        onPress={() => handleShare(item.url!, item.label)}
                      >
                        <ShareIcon size={14} color={Theme.colors.gold} />
                        <Text style={[styles.actionBtnText, { color: Theme.colors.gold }]}>
                          Share Card
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : null}

                  {item.status === "ACTIVE" ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.revokeBtn]}
                      onPress={() => handleRevoke(item.id, tokenRef)}
                    >
                      <BanIcon size={13} color={Theme.colors.error} />
                      <Text style={styles.revokeText}>Revoke</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.consumedNote}>
                      {item.status === "CONSUMED"
                        ? "Atomically burned upon submission"
                        : `Status: ${item.status}`}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <QrCodeIcon size={32} color={Theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No access codes found</Text>
              <Text style={styles.emptySubtitle}>
                {search || statusFilter !== "ALL"
                  ? "Try clearing your search or status filters."
                  : "Generate single-use QR access codes to start collecting attendee contacts."}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button (FAB) to Generate Codes */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <PlusIcon size={20} color="#FFFFFF" />
        <Text style={styles.fabText}>New Codes</Text>
      </TouchableOpacity>

      {/* Generation Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Generate Access Codes</Text>
                <Text style={styles.modalSubtitle}>Single-use visiting tokens for connections</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <CloseIcon size={18} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Quick Count Presets */}
            <Text style={styles.modalLabel}>QUANTITY</Text>
            <View style={styles.countPresetRow}>
              {["1", "5", "10", "25", "50"].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.countChip, count === n && styles.countChipActive]}
                  onPress={() => setCount(n)}
                >
                  <Text style={[styles.countChipText, count === n && styles.countChipTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Context / Label Field */}
            <Text style={styles.modalLabel}>CONTEXT / EVENT TAG (OPTIONAL)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. VIP Dinner, Tech Summit Booth, Global Conclave"
              placeholderTextColor={Theme.colors.textMuted}
              value={label}
              onChangeText={setLabel}
            />

            {/* Expiry Presets */}
            <Text style={styles.modalLabel}>VALIDITY PERIOD</Text>
            <View style={styles.countPresetRow}>
              {[
                { label: "7 Days", val: "7" },
                { label: "30 Days", val: "30" },
                { label: "90 Days", val: "90" },
                { label: "Never", val: "0" },
              ].map((p) => (
                <TouchableOpacity
                  key={p.val}
                  style={[styles.countChip, expiryDays === p.val && styles.countChipActive]}
                  onPress={() => setExpiryDays(p.val)}
                >
                  <Text style={[styles.countChipText, expiryDays === p.val && styles.countChipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Invariant Info Notice */}
            <View style={styles.infoBox}>
              <SparklesIcon size={14} color={Theme.colors.gold} />
              <Text style={styles.infoBoxText}>
                Each code generates a cryptographically random, single-use token that automatically burns upon first contact submission.
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.generateSubmitBtn, generating && styles.btnDisabled]}
              onPress={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.generateSubmitText}>
                  Generate {count} {parseInt(count, 10) === 1 ? "Code" : "Codes"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Generated Result Modal (HQ QR Preview) */}
      <Modal visible={!!generatedCodes} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Codes Generated!</Text>
                <Text style={styles.modalSubtitle}>Ready for scanning and contact collection</Text>
              </View>
              <TouchableOpacity onPress={() => setGeneratedCodes(null)} style={styles.closeBtn}>
                <CloseIcon size={18} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {generatedCodes?.map((g, idx) => (
                <View key={g.id || idx} style={styles.generatedCard}>
                  {g.qrDataUrl ? (
                    <View style={styles.qrImageContainer}>
                      <Image
                        source={{ uri: g.qrDataUrl }}
                        style={styles.qrImage}
                        resizeMode="contain"
                      />
                    </View>
                  ) : null}

                  <Text style={styles.qrTokenText}>{g.token || "Active Token"}</Text>

                  {g.url ? (
                    <View style={styles.qrActionRow}>
                      <TouchableOpacity
                        style={styles.qrCopyBtn}
                        onPress={() => handleCopyLink(g.url!, g.token)}
                      >
                        <CopyIcon size={14} color={Theme.colors.textPrimary} />
                        <Text style={styles.qrActionText}>Copy Link</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.qrCopyBtn, { backgroundColor: Theme.colors.primary }]}
                        onPress={() => handleShare(g.url!, g.label)}
                      >
                        <ShareIcon size={14} color="#FFFFFF" />
                        <Text style={[styles.qrActionText, { color: "#FFFFFF" }]}>Share</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => setGeneratedCodes(null)}
            >
              <Text style={styles.doneBtnText}>Close Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Theme.colors.background,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Theme.colors.textPrimary,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 10,
    paddingBottom: 4,
  },
  filterChip: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Theme.radius.full,
  },
  filterChipActive: {
    backgroundColor: Theme.colors.primaryMuted,
    borderColor: Theme.colors.primary,
  },
  filterChipText: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: Theme.colors.textPrimary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 120, // Safe clearance for floating pill navbar & FAB
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  tokenContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tokenText: {
    color: Theme.colors.textPrimary,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 15,
    fontWeight: "800",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.radius.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  labelText: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dateText: {
    color: Theme.colors.textMuted,
    fontSize: 11,
  },
  expiryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceElevated,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Theme.radius.sm,
  },
  actionBtnHighlight: {
    backgroundColor: Theme.colors.goldMuted,
    borderColor: "rgba(200, 169, 107, 0.4)",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.colors.textPrimary,
  },
  revokeBtn: {
    marginLeft: "auto",
    borderColor: "rgba(239, 68, 68, 0.3)",
    backgroundColor: Theme.colors.errorBg,
  },
  revokeText: {
    color: Theme.colors.error,
    fontSize: 11,
    fontWeight: "700",
  },
  consumedNote: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontStyle: "italic",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 20,
  },
  emptyTitle: {
    color: Theme.colors.textPrimary,
    fontSize: 16,
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
  fab: {
    position: "absolute",
    bottom: 96,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Theme.radius.full,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: Theme.radius.xl,
    borderTopRightRadius: Theme.radius.xl,
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Theme.colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: Theme.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 10,
  },
  countPresetRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  countChip: {
    flex: 1,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 10,
    borderRadius: Theme.radius.md,
    alignItems: "center",
  },
  countChipActive: {
    backgroundColor: Theme.colors.primaryMuted,
    borderColor: Theme.colors.primary,
  },
  countChipText: {
    color: Theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  countChipTextActive: {
    color: Theme.colors.textPrimary,
  },
  modalInput: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: Theme.colors.textPrimary,
    fontSize: 14,
    marginBottom: 10,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Theme.colors.goldMuted,
    borderColor: "rgba(200, 169, 107, 0.3)",
    borderWidth: 1,
    padding: 12,
    borderRadius: Theme.radius.md,
    marginVertical: 14,
  },
  infoBoxText: {
    color: Theme.colors.textPrimary,
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  generateSubmitBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  generateSubmitText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  generatedCard: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: Theme.radius.lg,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  qrImageContainer: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: Theme.radius.md,
    marginBottom: 12,
  },
  qrImage: {
    width: 160,
    height: 160,
  },
  qrTokenText: {
    color: Theme.colors.gold,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 12,
  },
  qrActionRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  qrCopyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 10,
    borderRadius: Theme.radius.md,
  },
  qrActionText: {
    color: Theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  doneBtn: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  doneBtnText: {
    color: Theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
});
