import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Image,
} from "react-native";
import { mobileApiClient } from "../../lib/api";
import { ContactItem, FollowUpStatus } from "@connectme/contracts";

export default function MobileContactsScreen() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  // Detail Modal
  const [selectedContact, setSelectedContact] = useState<ContactItem | null>(null);

  const fetchContacts = useCallback(async () => {
    const res = await mobileApiClient.listContacts({
      search: search.trim() || undefined,
      limit: 30,
    });
    if (res.success && res.data) {
      setContacts(res.data);
    }
  }, [search]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await fetchContacts();
      setLoading(false);
    }
    load();
  }, [fetchContacts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchContacts();
    setRefreshing(false);
  };

  const handleStatusChange = async (contactId: string, newStatus: FollowUpStatus) => {
    const res = await mobileApiClient.updateContact(contactId, {
      followUpStatus: newStatus,
    });
    if (res.success) {
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, followUpStatus: newStatus } : c))
      );
      if (selectedContact?.id === contactId) {
        setSelectedContact((prev) => (prev ? { ...prev, followUpStatus: newStatus } : null));
      }
    } else {
      Alert.alert("Error", !res.success ? res.error.message : "Failed to update status");
    }
  };

  const handleDeleteImage = (contactId: string) => {
    Alert.alert("Delete Picture", "Remove stored profile image from database?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await mobileApiClient.deleteContactImage(contactId);
          if (res.success) {
            setContacts((prev) =>
              prev.map((c) => (c.id === contactId ? { ...c, hasImage: false } : c))
            );
            if (selectedContact?.id === contactId) {
              setSelectedContact((prev) => (prev ? { ...prev, hasImage: false } : null));
            }
          }
        },
      },
    ]);
  };

  const statusOptions: FollowUpStatus[] = [
    "NEW",
    "CONTACTED",
    "REPLIED",
    "OPPORTUNITY",
    "ARCHIVED",
  ];

  const statusColors: Record<FollowUpStatus, string> = {
    NEW: "#60A5FA",
    CONTACTED: "#C084FC",
    REPLIED: "#34D399",
    OPPORTUNITY: "#FBBF24",
    ARCHIVED: "#777681",
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or company..."
          placeholderTextColor="#777681"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6D3CE8" />
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelectedContact(item)}
            >
              <View style={styles.cardRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.fullName.slice(0, 2).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={styles.fullName}>{item.fullName}</Text>
                    <View
                      style={[
                        styles.badge,
                        { borderColor: statusColors[item.followUpStatus] + "60" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: statusColors[item.followUpStatus] },
                        ]}
                      >
                        {item.followUpStatus}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.roleText}>
                    {[item.role, item.organization].filter(Boolean).join(" • ") || "—"}
                  </Text>
                  <Text style={styles.phoneText}>{item.phoneNumber}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Detail Modal */}
      {selectedContact && (
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{selectedContact.fullName}</Text>
              <Text style={styles.modalSub}>
                {[selectedContact.role, selectedContact.organization]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>PHONE</Text>
                <Text style={styles.detailValue}>{selectedContact.phoneNumber}</Text>
              </View>

              {selectedContact.email && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>EMAIL</Text>
                  <Text style={styles.detailValue}>{selectedContact.email}</Text>
                </View>
              )}

              {selectedContact.profileUrl && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>PROFILE</Text>
                  <Text style={styles.detailValue}>{selectedContact.profileUrl}</Text>
                </View>
              )}

              {selectedContact.discussionNotes && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>NOTES</Text>
                  <Text style={styles.notesText}>{selectedContact.discussionNotes}</Text>
                </View>
              )}

              {/* Status Selector */}
              <Text style={styles.statusSectionLabel}>FOLLOW-UP STATUS</Text>
              <View style={styles.statusButtons}>
                {statusOptions.map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.statusBtn,
                      selectedContact.followUpStatus === st && {
                        backgroundColor: statusColors[st],
                      },
                    ]}
                    onPress={() => handleStatusChange(selectedContact.id, st)}
                  >
                    <Text
                      style={[
                        styles.statusBtnText,
                        selectedContact.followUpStatus === st && { color: "#0B0B10" },
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {selectedContact.hasImage && (
                <TouchableOpacity
                  style={styles.deleteImgBtn}
                  onPress={() => handleDeleteImage(selectedContact.id)}
                >
                  <Text style={styles.deleteImgText}>Delete Stored Picture</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedContact(null)}
              >
                <Text style={styles.closeBtnText}>Done</Text>
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
  searchBar: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1C1A29",
  },
  searchInput: {
    backgroundColor: "#13121C",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2F2B48",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F3EFE7",
    fontSize: 13,
  },
  list: {
    padding: 12,
  },
  card: {
    backgroundColor: "#13121C",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2F2B48",
    padding: 14,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#252044",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#F3EFE7",
    fontWeight: "700",
    fontSize: 14,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fullName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F3EFE7",
  },
  roleText: {
    fontSize: 11,
    color: "#777681",
    marginTop: 2,
  },
  phoneText: {
    fontSize: 12,
    color: "#C8A96B",
    marginTop: 4,
    fontFamily: "monospace",
  },
  badge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 8,
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
    fontSize: 20,
    fontWeight: "800",
    color: "#F3EFE7",
  },
  modalSub: {
    fontSize: 12,
    color: "#777681",
    marginTop: 2,
    marginBottom: 16,
  },
  detailRow: {
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#777681",
    letterSpacing: 0.8,
  },
  detailValue: {
    fontSize: 13,
    color: "#F3EFE7",
    marginTop: 2,
  },
  notesText: {
    fontSize: 12,
    color: "#A5A4B2",
    marginTop: 2,
    fontStyle: "italic",
  },
  statusSectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#777681",
    marginTop: 14,
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  statusButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  statusBtn: {
    borderWidth: 1,
    borderColor: "#2F2B48",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#1C1A29",
  },
  statusBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#F3EFE7",
  },
  deleteImgBtn: {
    backgroundColor: "rgba(248, 113, 113, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.4)",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  deleteImgText: {
    color: "#F87171",
    fontSize: 11,
    fontWeight: "700",
  },
  closeBtn: {
    backgroundColor: "#6D3CE8",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  closeBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
