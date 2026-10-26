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
  Linking,
  ScrollView,
  Share,
  Platform,
  RefreshControl,
} from "react-native";
import { mobileApiClient, API_BASE_URL } from "../../lib/api";
import { ContactItem, FollowUpStatus } from "@connectme/contracts";
import {
  UsersIcon,
  SearchIcon,
  PhoneIcon,
  MailIcon,
  MessageSquareIcon,
  CloseIcon,
  TrashIcon,
  CheckIcon,
  ShareIcon,
  SparklesIcon,
} from "../../components/Icons";
import { Theme } from "../../constants/theme";

export default function MobileContactsScreen() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Detail Modal
  const [selectedContact, setSelectedContact] = useState<ContactItem | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await mobileApiClient.listContacts({
        search: search.trim() || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        limit: 50,
      });
      if (res.success && res.data) {
        setContacts(res.data);
      }
    } catch (err) {
      console.error("[Contacts] Failed to fetch contacts", err);
    }
  }, [search, statusFilter]);

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
    try {
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
        Alert.alert("Update Failed", res.error.message);
      }
    } catch {
      Alert.alert("Network Failure", "Failed to update status.");
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedContact) return;
    setSavingNotes(true);
    try {
      const res = await mobileApiClient.updateContact(selectedContact.id, {
        discussionNotes: editNotes.trim(),
      });
      if (res.success) {
        setSelectedContact({ ...selectedContact, discussionNotes: editNotes.trim() });
        setContacts((prev) =>
          prev.map((c) =>
            c.id === selectedContact.id ? { ...c, discussionNotes: editNotes.trim() } : c
          )
        );
        Alert.alert("Notes Saved", "Meeting discussion notes updated successfully.");
      } else {
        Alert.alert("Error", res.error.message);
      }
    } catch {
      Alert.alert("Error", "Network failure saving notes.");
    } finally {
      setSavingNotes(false);
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

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber.replace(/\s+/g, "")}`).catch(() => {});
  };

  const handleSms = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`sms:${phoneNumber.replace(/\s+/g, "")}`).catch(() => {});
  };

  const handleEmail = (email?: string | null) => {
    if (!email) return;
    Linking.openURL(`mailto:${email.trim()}`).catch(() => {});
  };

  const handleShareContact = async (contact: ContactItem) => {
    try {
      const details = [
        `Name: ${contact.fullName}`,
        contact.organization ? `Organization: ${contact.organization}` : null,
        contact.role ? `Role: ${contact.role}` : null,
        `Phone: ${contact.phoneNumber}`,
        contact.email ? `Email: ${contact.email}` : null,
        contact.discussionNotes ? `Notes: ${contact.discussionNotes}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      await Share.share({
        title: `${contact.fullName} Contact Card`,
        message: details,
      });
    } catch {}
  };

  const openContactDetail = (contact: ContactItem) => {
    setSelectedContact(contact);
    setEditNotes(contact.discussionNotes || "");
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const statusColors: Record<FollowUpStatus, { text: string; bg: string }> = {
    NEW: { text: Theme.colors.statusNew, bg: Theme.colors.statusNewBg },
    CONTACTED: { text: Theme.colors.statusContacted, bg: Theme.colors.statusContactedBg },
    REPLIED: { text: Theme.colors.statusReplied, bg: Theme.colors.statusRepliedBg },
    OPPORTUNITY: { text: Theme.colors.statusOpportunity, bg: Theme.colors.statusOpportunityBg },
    ARCHIVED: { text: Theme.colors.statusArchived, bg: Theme.colors.statusArchivedBg },
  };

  const filterOptions = ["ALL", "NEW", "CONTACTED", "REPLIED", "OPPORTUNITY", "ARCHIVED"];

  return (
    <View style={styles.container}>
      {/* Search & Filter Header */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <SearchIcon size={16} color={Theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, company, phone, email..."
            placeholderTextColor={Theme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <CloseIcon size={16} color={Theme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Chips */}
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

      {/* Contacts List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={contacts}
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
            const statusConfig = statusColors[item.followUpStatus] || statusColors.NEW;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => openContactDetail(item)}
                activeOpacity={0.8}
              >
                <View style={styles.cardMain}>
                  {/* Avatar */}
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(item.fullName)}</Text>
                  </View>

                  {/* Info */}
                  <View style={styles.cardInfo}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.nameText} numberOfLines={1}>
                        {item.fullName}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                        <Text style={[styles.statusText, { color: statusConfig.text }]}>
                          {item.followUpStatus}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.roleText} numberOfLines={1}>
                      {[item.role, item.organization].filter(Boolean).join(" • ") || "Executive Contact"}
                    </Text>

                    <Text style={styles.phoneText}>{item.phoneNumber}</Text>
                    {item.email ? <Text style={styles.emailText}>{item.email}</Text> : null}
                  </View>
                </View>

                {/* Quick Communication Actions Bar */}
                <View style={styles.actionRow}>
                  <Text style={styles.dateText}>
                    {new Date(item.submittedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => handleCall(item.phoneNumber)}
                    >
                      <PhoneIcon size={14} color={Theme.colors.textPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => handleSms(item.phoneNumber)}
                    >
                      <MessageSquareIcon size={14} color={Theme.colors.gold} />
                    </TouchableOpacity>

                    {item.email ? (
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => handleEmail(item.email)}
                      >
                        <MailIcon size={14} color={Theme.colors.primaryHover} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <UsersIcon size={32} color={Theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No contacts found</Text>
              <Text style={styles.emptySubtitle}>
                {search || statusFilter !== "ALL"
                  ? "Try clearing your search query or filter tags."
                  : "Attendee submissions will appear here automatically when guests scan your single-use codes."}
              </Text>
            </View>
          }
        />
      )}

      {/* Contact Detail Modal */}
      <Modal visible={!!selectedContact} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedContact && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalAvatarRow}>
                    <View style={styles.modalAvatar}>
                      <Text style={styles.modalAvatarText}>
                        {getInitials(selectedContact.fullName)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalName}>{selectedContact.fullName}</Text>
                      <Text style={styles.modalRole}>
                        {[selectedContact.role, selectedContact.organization]
                          .filter(Boolean)
                          .join(" • ") || "Executive Lead"}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedContact(null)}
                    style={styles.modalCloseBtn}
                  >
                    <CloseIcon size={18} color={Theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Follow-up Status Pill Selector */}
                <Text style={styles.sectionHeader}>FOLLOW-UP STATUS</Text>
                <View style={styles.statusSelectorRow}>
                  {(["NEW", "CONTACTED", "REPLIED", "OPPORTUNITY", "ARCHIVED"] as FollowUpStatus[]).map(
                    (st) => {
                      const isSelected = selectedContact.followUpStatus === st;
                      const conf = statusColors[st];
                      return (
                        <TouchableOpacity
                          key={st}
                          style={[
                            styles.statusSelectChip,
                            isSelected && { backgroundColor: conf.bg, borderColor: conf.text },
                          ]}
                          onPress={() => handleStatusChange(selectedContact.id, st)}
                        >
                          <Text
                            style={[
                              styles.statusSelectText,
                              isSelected && { color: conf.text, fontWeight: "800" },
                            ]}
                          >
                            {st}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
                </View>

                {/* Quick Contact Buttons Row */}
                <View style={styles.modalQuickRow}>
                  <TouchableOpacity
                    style={styles.modalActionBtn}
                    onPress={() => handleCall(selectedContact.phoneNumber)}
                  >
                    <PhoneIcon size={16} color={Theme.colors.textPrimary} />
                    <Text style={styles.modalActionText}>Call</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalActionBtn}
                    onPress={() => handleSms(selectedContact.phoneNumber)}
                  >
                    <MessageSquareIcon size={16} color={Theme.colors.gold} />
                    <Text style={[styles.modalActionText, { color: Theme.colors.gold }]}>SMS</Text>
                  </TouchableOpacity>

                  {selectedContact.email ? (
                    <TouchableOpacity
                      style={styles.modalActionBtn}
                      onPress={() => handleEmail(selectedContact.email)}
                    >
                      <MailIcon size={16} color={Theme.colors.primaryHover} />
                      <Text style={[styles.modalActionText, { color: Theme.colors.primaryHover }]}>
                        Email
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={styles.modalActionBtn}
                    onPress={() => handleShareContact(selectedContact)}
                  >
                    <ShareIcon size={16} color={Theme.colors.textSecondary} />
                    <Text style={styles.modalActionText}>Share</Text>
                  </TouchableOpacity>
                </View>

                {/* Contact Information Fields */}
                <Text style={styles.sectionHeader}>CONTACT DETAILS</Text>
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Phone</Text>
                    <Text style={styles.infoValue}>{selectedContact.phoneNumber}</Text>
                  </View>
                  {selectedContact.email ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Email</Text>
                      <Text style={styles.infoValue}>{selectedContact.email}</Text>
                    </View>
                  ) : null}
                  {selectedContact.profileUrl ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Profile Link</Text>
                      <Text style={styles.infoValue} numberOfLines={1}>
                        {selectedContact.profileUrl}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Received</Text>
                    <Text style={styles.infoValue}>
                      {new Date(selectedContact.submittedAt).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Discussion Notes Editor */}
                <Text style={styles.sectionHeader}>MEETING NOTES & SHARED IDEAS</Text>
                <TextInput
                  style={styles.notesInput}
                  multiline
                  numberOfLines={4}
                  placeholder="Record discussion highlights, shared ideas, or next steps..."
                  placeholderTextColor={Theme.colors.textMuted}
                  value={editNotes}
                  onChangeText={setEditNotes}
                />
                <TouchableOpacity
                  style={[styles.saveNotesBtn, savingNotes && styles.btnDisabled]}
                  onPress={handleSaveNotes}
                  disabled={savingNotes}
                >
                  {savingNotes ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.saveNotesText}>Save Notes</Text>
                  )}
                </TouchableOpacity>

                {/* Profile Picture Option if uploaded */}
                {selectedContact.hasImage ? (
                  <View style={styles.deleteImageRow}>
                    <TouchableOpacity
                      style={styles.deleteImageBtn}
                      onPress={() => handleDeleteImage(selectedContact.id)}
                    >
                      <TrashIcon size={14} color={Theme.colors.error} />
                      <Text style={styles.deleteImageText}>Delete Profile Picture</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </ScrollView>
            )}
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
    paddingBottom: 110, // Safe clearance for floating pill navbar
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
    padding: 14,
    marginBottom: 10,
  },
  cardMain: {
    flexDirection: "row",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
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
    fontSize: 15,
  },
  cardInfo: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nameText: {
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
  roleText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 12,
    color: Theme.colors.gold,
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  emailText: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceElevated,
  },
  dateText: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
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
    maxHeight: "88%",
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
  modalAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  modalAvatar: {
    width: 48,
    height: 48,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Theme.colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  modalAvatarText: {
    color: Theme.colors.gold,
    fontWeight: "900",
    fontSize: 16,
  },
  modalName: {
    fontSize: 18,
    fontWeight: "900",
    color: Theme.colors.textPrimary,
  },
  modalRole: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 14,
  },
  statusSelectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  statusSelectChip: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.radius.full,
  },
  statusSelectText: {
    fontSize: 10,
    fontWeight: "700",
    color: Theme.colors.textMuted,
  },
  modalQuickRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 10,
    borderRadius: Theme.radius.md,
  },
  modalActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.colors.textPrimary,
  },
  infoCard: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 12,
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoLabel: {
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  infoValue: {
    fontSize: 12,
    color: Theme.colors.textPrimary,
    fontWeight: "600",
  },
  notesInput: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Theme.colors.textPrimary,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: "top",
  },
  saveNotesBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveNotesText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  deleteImageRow: {
    marginTop: 16,
    alignItems: "center",
  },
  deleteImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deleteImageText: {
    color: Theme.colors.error,
    fontSize: 12,
    fontWeight: "600",
  },
});
