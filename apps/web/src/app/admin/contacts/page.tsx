"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  Download,
  Phone,
  Mail,
  Building,
  Briefcase,
  ExternalLink,
  Trash2,
  X,
  MessageSquare,
  Sparkles,
  ZoomIn,
  Eye,
} from "lucide-react";
import { ContactItem, FollowUpStatus } from "@connectme/contracts";
import { apiClient } from "@/lib/api";

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Detail Modal State
  const [selectedContact, setSelectedContact] = useState<ContactItem | null>(null);
  const [notesUpdating, setNotesUpdating] = useState(false);
  const [editNotes, setEditNotes] = useState("");

  // Photo Lightbox State
  const [lightboxContact, setLightboxContact] = useState<ContactItem | null>(null);

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.listContacts({
        page,
        limit: 15,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        search: search.trim() || undefined,
      });

      if (res.success && res.data) {
        setContacts(res.data);
        if (res.meta?.totalPages) setTotalPages(res.meta.totalPages);
      }
    } catch {
      console.error("Failed to fetch contacts");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleStatusChange = async (contactId: string, newStatus: FollowUpStatus) => {
    try {
      const res = await apiClient.updateContact(contactId, {
        followUpStatus: newStatus,
      });

      if (res.success) {
        setContacts((prev) =>
          prev.map((c) => (c.id === contactId ? { ...c, followUpStatus: newStatus } : c))
        );
        if (selectedContact?.id === contactId) {
          setSelectedContact((prev) => (prev ? { ...prev, followUpStatus: newStatus } : null));
        }
      }
    } catch {
      alert("Failed to update status");
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedContact) return;
    try {
      setNotesUpdating(true);
      const res = await apiClient.updateContact(selectedContact.id, {
        discussionNotes: editNotes,
      });

      if (res.success) {
        setSelectedContact({ ...selectedContact, discussionNotes: editNotes });
        setContacts((prev) =>
          prev.map((c) => (c.id === selectedContact.id ? { ...c, discussionNotes: editNotes } : c))
        );
      }
    } catch {
      alert("Failed to update notes");
    } finally {
      setNotesUpdating(false);
    }
  };

  const handleDeleteImage = async (contactId: string) => {
    if (!confirm("Delete this stored profile picture?")) return;

    try {
      const res = await apiClient.deleteContactImage(contactId);
      if (res.success) {
        setContacts((prev) =>
          prev.map((c) => (c.id === contactId ? { ...c, hasImage: false } : c))
        );
        if (selectedContact?.id === contactId) {
          setSelectedContact({ ...selectedContact, hasImage: false });
        }
      }
    } catch {
      alert("Failed to delete image");
    }
  };

  const openDetail = (contact: ContactItem) => {
    setSelectedContact(contact);
    setEditNotes(contact.discussionNotes || "");
  };

  const statusOptions: FollowUpStatus[] = [
    "NEW",
    "CONTACTED",
    "REPLIED",
    "OPPORTUNITY",
    "ARCHIVED",
  ];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-warmIvory sm:text-3xl">
            Contact Submissions
          </h1>
          <p className="mt-1 text-xs text-slate-light">
            Review attendee submissions and manage relationship follow-ups
          </p>
        </div>

        <a
          href="/api/v1/admin/contacts/export"
          download
          className="inline-flex items-center gap-1.5 rounded-xl border border-obsidian-border bg-obsidian-surface px-4 py-2.5 text-xs font-semibold text-warmIvory transition hover:bg-obsidian-elevated"
        >
          <Download className="h-4 w-4 text-metallicGold" />
          <span>Export Contacts CSV</span>
        </a>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-obsidian-border bg-obsidian-surface/60 p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate" />
          <input
            type="text"
            placeholder="Search by name, organization, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-obsidian-border bg-obsidian-elevated py-2 pl-9 pr-3 text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
          >
            <option value="ALL">All Follow-ups</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="rounded-2xl border border-obsidian-border bg-obsidian-surface/90 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex py-16 justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-royalViolet border-t-transparent" />
          </div>
        ) : contacts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-obsidian-border bg-obsidian-elevated/40 text-[11px] uppercase tracking-wider text-slate">
                <tr>
                  <th className="py-3 px-4 font-semibold">Contact</th>
                  <th className="py-3 px-4 font-semibold">Organization & Role</th>
                  <th className="py-3 px-4 font-semibold">Phone / Email</th>
                  <th className="py-3 px-4 font-semibold">Source</th>
                  <th className="py-3 px-4 font-semibold">Follow-up Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-border/50 text-warmIvory/90">
                {contacts.map((c) => (
                  <tr key={c.id} className="transition hover:bg-obsidian-elevated/30">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {c.hasImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.imageUrl || `/api/v1/admin/contacts/${c.id}/image`}
                            alt={c.fullName}
                            onClick={() => setLightboxContact(c)}
                            title="Click to enlarge photo"
                            className="h-10 w-10 cursor-pointer rounded-full object-cover border-2 border-royalViolet transition hover:scale-110 hover:ring-2 hover:ring-royalViolet-hover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div
                          style={{ display: c.hasImage ? "none" : "flex" }}
                          className="h-10 w-10 items-center justify-center rounded-full bg-deepIndigo text-warmIvory font-bold text-xs"
                        >
                          {c.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-warmIvory">{c.fullName}</span>
                            {c.hasImage && (
                              <button
                                type="button"
                                onClick={() => setLightboxContact(c)}
                                className="inline-flex items-center gap-1 rounded bg-royalViolet/20 px-1.5 py-0.5 text-[10px] font-semibold text-royalViolet-hover hover:bg-royalViolet/35 transition"
                                title="View uploaded profile photo"
                              >
                                <Eye className="h-2.5 w-2.5" />
                                <span>Photo</span>
                              </button>
                            )}
                          </div>
                          <div className="text-[10px] text-slate">
                            {new Date(c.submittedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-warmIvory">{c.organization || "—"}</div>
                      <div className="text-[11px] text-slate">{c.role || "—"}</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <div className="text-warmIvory font-medium">{c.phoneNumber}</div>
                      {c.email && <div className="text-slate">{c.email}</div>}
                    </td>

                    <td className="py-3.5 px-4 text-slate">
                      {c.accessCodeLabel || "General"}
                    </td>

                    <td className="py-3.5 px-4">
                      <select
                        value={c.followUpStatus}
                        onChange={(e) =>
                          handleStatusChange(c.id, e.target.value as FollowUpStatus)
                        }
                        className="rounded-lg border border-obsidian-border bg-obsidian-elevated px-2 py-1 text-[11px] font-bold text-warmIvory focus:border-royalViolet focus:outline-none"
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openDetail(c)}
                        className="rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-1 text-[11px] font-semibold text-warmIvory hover:border-royalViolet"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-slate" />
            <p className="text-sm font-medium text-warmIvory">No contacts match filter</p>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-obsidian-border px-4 py-3 text-xs text-slate">
            <div>
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border border-obsidian-border px-3 py-1 text-warmIvory disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border border-obsidian-border px-3 py-1 text-warmIvory disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contact Detail Modal */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-obsidian-border bg-obsidian-surface p-6 shadow-royal my-8">
            <div className="mb-4 flex items-center justify-between border-b border-obsidian-border pb-3">
              <h3 className="text-lg font-bold text-warmIvory">Contact Dossier</h3>
              <button
                onClick={() => setSelectedContact(null)}
                className="rounded-lg p-1 text-slate hover:text-warmIvory"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Picture Header */}
              <div className="flex items-center gap-4 rounded-xl border border-obsidian-border bg-obsidian-elevated/40 p-4">
                {selectedContact.hasImage ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedContact.imageUrl || `/api/v1/admin/contacts/${selectedContact.id}/image`}
                      alt={selectedContact.fullName}
                      className="h-20 w-20 rounded-xl object-cover border-2 border-royalViolet cursor-pointer transition hover:opacity-90"
                      onClick={() => {
                        window.open(selectedContact.imageUrl || `/api/v1/admin/contacts/${selectedContact.id}/image`, "_blank");
                      }}
                      title="Click to view full photo in new tab"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                    <div
                      style={{ display: "none" }}
                      className="h-20 w-20 items-center justify-center rounded-xl bg-deepIndigo text-warmIvory font-bold text-xl"
                    >
                      {selectedContact.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <button
                      onClick={() => handleDeleteImage(selectedContact.id)}
                      title="Delete stored photo"
                      className="absolute -top-2 -right-2 rounded-full bg-red-600 p-1 text-white shadow hover:bg-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-deepIndigo text-warmIvory font-bold text-xl">
                    {selectedContact.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div>
                  <h4 className="text-base font-bold text-warmIvory">
                    {selectedContact.fullName}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-light mt-0.5">
                    {selectedContact.role && <span>{selectedContact.role}</span>}
                    {selectedContact.organization && (
                      <>
                        <span>&bull;</span>
                        <span>{selectedContact.organization}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-metallicGold">
                    Card Source: {selectedContact.accessCodeLabel || "General"}
                  </div>
                  {selectedContact.hasImage && (
                    <button
                      type="button"
                      onClick={() => setLightboxContact(selectedContact)}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] text-royalViolet-hover hover:underline"
                    >
                      <ZoomIn className="h-3 w-3" />
                      <span>Enlarge & Download Photo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Contact Details */}
              <div className="grid grid-cols-1 gap-2.5 text-xs text-slate-light">
                <div className="flex items-center gap-2.5 rounded-lg border border-obsidian-border bg-obsidian-elevated/20 p-2.5">
                  <Phone className="h-4 w-4 text-royalViolet" />
                  <span className="font-mono font-semibold text-warmIvory">
                    {selectedContact.phoneNumber}
                  </span>
                </div>

                {selectedContact.email && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-obsidian-border bg-obsidian-elevated/20 p-2.5">
                    <Mail className="h-4 w-4 text-royalViolet" />
                    <span className="text-warmIvory">{selectedContact.email}</span>
                  </div>
                )}

                {selectedContact.profileUrl ? (
                  <a
                    href={selectedContact.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 rounded-lg border border-obsidian-border bg-obsidian-elevated/20 p-2.5 text-royalViolet-hover hover:underline"
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    <span className="truncate">Social / Portfolio: {selectedContact.profileUrl}</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-lg border border-obsidian-border bg-obsidian-elevated/20 p-2.5 text-slate">
                    <ExternalLink className="h-4 w-4 shrink-0 text-slate" />
                    <span className="italic text-[11px]">No social / portfolio link provided</span>
                  </div>
                )}
              </div>

              {/* Discussion Notes Editor */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-light">
                  Discussion Notes & Next Steps
                </label>
                <textarea
                  rows={4}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes from meeting discussion, event chat, or follow-up plans..."
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated p-3 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={handleSaveNotes}
                    disabled={notesUpdating}
                    className="rounded-lg bg-royalViolet px-3 py-1.5 text-xs font-semibold text-white hover:bg-royalViolet-hover disabled:opacity-50"
                  >
                    {notesUpdating ? "Saving..." : "Save Notes"}
                  </button>
                </div>
              </div>

              {/* Follow-up status selector */}
              <div className="flex items-center justify-between border-t border-obsidian-border pt-3">
                <span className="text-xs text-slate font-medium">Follow-up Status:</span>
                <select
                  value={selectedContact.followUpStatus}
                  onChange={(e) =>
                    handleStatusChange(selectedContact.id, e.target.value as FollowUpStatus)
                  }
                  className="rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-1.5 text-xs font-bold text-warmIvory focus:border-royalViolet focus:outline-none"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 border-t border-obsidian-border pt-4 text-right">
              <button
                onClick={() => setSelectedContact(null)}
                className="rounded-xl bg-obsidian-elevated px-5 py-2 text-xs font-semibold text-warmIvory hover:bg-obsidian-border"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Photo Lightbox Modal */}
      {lightboxContact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setLightboxContact(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-obsidian-border bg-obsidian-surface p-6 shadow-royal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-obsidian-border pb-3">
              <div>
                <h3 className="text-base font-bold text-warmIvory">
                  {lightboxContact.fullName}
                </h3>
                <p className="text-xs text-slate-light">
                  {lightboxContact.organization || lightboxContact.role || "Contact Photo"} &bull; {new Date(lightboxContact.submittedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setLightboxContact(null)}
                className="rounded-lg p-1.5 text-slate hover:bg-obsidian-elevated hover:text-warmIvory"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex justify-center bg-black/40 rounded-xl p-3 border border-obsidian-border overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxContact.imageUrl || `/api/v1/admin/contacts/${lightboxContact.id}/image`}
                alt={lightboxContact.fullName}
                className="max-h-[60vh] w-auto max-w-full rounded-lg object-contain shadow-royal"
              />
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate">
              <span>
                {lightboxContact.imageMime || "image/webp"}
                {lightboxContact.imageSize ? ` • ${(lightboxContact.imageSize / 1024).toFixed(1)} KB` : ""}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxContact.imageUrl || `/api/v1/admin/contacts/${lightboxContact.id}/image`}
                  download={`${lightboxContact.fullName.toLowerCase().replace(/\s+/g, "-")}-photo.webp`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-royalViolet bg-royalViolet/20 px-3 py-1.5 font-semibold text-royalViolet-hover hover:bg-royalViolet/30 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Photo</span>
                </a>
                <button
                  onClick={() => setLightboxContact(null)}
                  className="rounded-lg bg-obsidian-elevated px-4 py-1.5 font-semibold text-warmIvory hover:bg-obsidian-border"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
