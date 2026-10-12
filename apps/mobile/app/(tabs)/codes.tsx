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
} from "react-native";
import { mobileApiClient } from "../../lib/api";
import { AccessCodeItem, GeneratedCodeDetail, CodeStatus } from "@connectme/contracts";

export default function MobileCodesScreen() {
  const [codes, setCodes] = useState<AccessCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Generate Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [count, setCount] = useState("1");
  const [label, setLabel] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");
  const [generating, setGenerating] = useState(false);

  // QR Modal
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedCodeDetail[] | null>(null);

  const fetchCodes = useCallback(async () => {
    const res = await mobileApiClient.listCodes({ limit: 30 });
    if (res.success && res.data) {
      setCodes(res.data);
    }
  }, []);

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
    const safeExpiry = parseInt(expiryDays, 10) || 0;
    const expiresAt =
      safeExpiry > 0
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
          : [res.data];
        setGeneratedCodes(details);
        fetchCodes();
      } else {
        Alert.alert("Error", !res.success ? res.error.message : "Failed to generate code");
      }
    } catch {
      Alert.alert("Error", "Network failure");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = (id: string) => {
    Alert.alert(
      "Revoke Code",
      "Are you sure you want to revoke this access code? It can never be redeemed.",
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
              Alert.alert("Error", !res.success ? res.error.message : "Could not revoke");
            }
          },
        },
      ]
    );
  };

  const shareCode = async (item: GeneratedCodeDetail) => {
    try {
      await Share.share({
        message: `Connect with me at Devcon: ${item.url}`,
        url: item.url,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const renderStatus = (status: CodeStatus) => {
    const colorMap: Record<CodeStatus, string> = {
      ACTIVE: "#34D399",
      CONSUMED: "#7E4DF5",
      REVOKED: "#F87171",
      EXPIRED: "#777681",
    };
    return (
      <View style={[styles.badge, { borderColor: colorMap[status] + "60" }]}>
        <Text style={[styles.badgeText, { color: colorMap[status] }]}>{status}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Visiting Cards ({codes.length})</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.createButtonText}>+ Generate</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6D3CE8" />
        </View>
      ) : (
        <FlatList
          data={codes}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.codeLabel}>{item.label || "Untitled Card"}</Text>
                {renderStatus(item.status)}
              </View>

              <Text style={styles.codeId}>ID: {item.id.slice(0, 8)}...</Text>

              {item.hasSubmission && item.contactName && (
                <Text style={styles.redeemedBy}>
                  Redeemed by: <Text style={styles.redeemedName}>{item.contactName}</Text>
                </Text>
              )}

              <View style={styles.cardFooter}>
                <Text style={styles.dateText}>
                  Created: {new Date(item.createdAt).toLocaleDateString()}
                </Text>

                {item.status === "ACTIVE" && (
                  <TouchableOpacity
                    onPress={() => handleRevoke(item.id)}
                    style={styles.revokeButton}
                  >
                    <Text style={styles.revokeText}>Revoke</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* Generate Codes Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Generate QR Codes</Text>

            <Text style={styles.inputLabel}>BATCH COUNT (1-100)</Text>
            <TextInput
              style={styles.input}
              value={count}
              onChangeText={setCount}
              keyboardType="number-pad"
            />

            <Text style={styles.inputLabel}>LABEL (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. VIP Dinner, Devcon Day 2"
              placeholderTextColor="#777681"
              value={label}
              onChangeText={setLabel}
            />

            <Text style={styles.inputLabel}>EXPIRY (DAYS, 0 = NEVER)</Text>
            <TextInput
              style={styles.input}
              value={expiryDays}
              onChangeText={setExpiryDays}
              keyboardType="number-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>Generate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Generated Results Modal */}
      {generatedCodes && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: "80%" }]}>
              <Text style={styles.modalTitle}>
                Generated {generatedCodes.length} QR Code{generatedCodes.length > 1 ? "s" : ""}
              </Text>
              <Text style={styles.modalSub}>
                Raw tokens cannot be recovered later. Share or save now.
              </Text>

              <FlatList
                data={generatedCodes}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.qrItem}>
                    <Image
                      source={{ uri: item.qrDataUrl }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrLabel}>{item.label || "Access Card"}</Text>
                    <Text style={styles.qrUrl} numberOfLines={1}>
                      {item.url}
                    </Text>

                    <TouchableOpacity
                      style={styles.shareButton}
                      onPress={() => shareCode(item)}
                    >
                      <Text style={styles.shareText}>Share Link / QR</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setGeneratedCodes(null)}
              >
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B10",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1C1A29",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F3EFE7",
  },
  createButton: {
    backgroundColor: "#6D3CE8",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: "#13121C",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2F2B48",
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F3EFE7",
  },
  codeId: {
    fontSize: 11,
    color: "#777681",
    marginTop: 4,
    fontFamily: "monospace",
  },
  redeemedBy: {
    fontSize: 12,
    color: "#C8A96B",
    marginTop: 6,
  },
  redeemedName: {
    fontWeight: "700",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#1C1A29",
    paddingTop: 8,
  },
  dateText: {
    fontSize: 10,
    color: "#777681",
  },
  revokeButton: {
    backgroundColor: "rgba(248, 113, 113, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.4)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  revokeText: {
    color: "#F87171",
    fontSize: 10,
    fontWeight: "700",
  },
  badge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#13121C",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2F2B48",
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F3EFE7",
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 11,
    color: "#C8A96B",
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#777681",
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#1C1A29",
    borderWidth: 1,
    borderColor: "#2F2B48",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F3EFE7",
    fontSize: 13,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelText: {
    color: "#777681",
    fontSize: 13,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: "#6D3CE8",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  qrItem: {
    backgroundColor: "#1C1A29",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2F2B48",
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  qrImage: {
    width: 160,
    height: 160,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginBottom: 10,
  },
  qrLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F3EFE7",
  },
  qrUrl: {
    fontSize: 10,
    color: "#777681",
    marginTop: 2,
    fontFamily: "monospace",
  },
  shareButton: {
    marginTop: 10,
    backgroundColor: "#6D3CE8",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  closeButton: {
    backgroundColor: "#1C1A29",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  closeText: {
    color: "#F3EFE7",
    fontSize: 13,
    fontWeight: "700",
  },
});
