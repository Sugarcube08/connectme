"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  QrCode,
  Plus,
  Download,
  Ban,
  Search,
  CheckCircle2,
  Clock,
  X,
  ExternalLink,
  Copy,
  Check,
  Archive,
  AlertTriangle,
} from "lucide-react";
import { AccessCodeItem, GeneratedCodeDetail, CodeStatus } from "@connectme/contracts";
import { apiClient } from "@/lib/api";
import { createZipBlob, downloadBlob } from "@/lib/zip";

function safeFilename(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "code"
  );
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const binStr = atob(base64);
  const len = binStr.length;
  const u8arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8arr[i] = binStr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const [, base64] = dataUrl.split(",");
  const binStr = atob(base64);
  const len = binStr.length;
  const u8arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8arr[i] = binStr.charCodeAt(i);
  }
  return u8arr;
}

export default function AdminCodesPage() {
  const [codes, setCodes] = useState<AccessCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Code Generation State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genCount, setGenCount] = useState(1);
  const [genLabel, setGenLabel] = useState("");
  const [genExpiryDays, setGenExpiryDays] = useState(30);
  const [generating, setGenerating] = useState(false);

  // Generation Results Modal (ONLY place to download HQ QRs)
  const [generatedResults, setGeneratedResults] = useState<GeneratedCodeDetail[] | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchCodes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.listCodes({
        page,
        limit: 25,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        search: search.trim() || undefined,
      });
      if (res.success && res.data) {
        setCodes(res.data);
        setTotalPages(res.meta?.totalPages || 1);
      } else if (!res.success) {
        console.error("Failed to fetch access codes", res.error?.message);
      }
    } catch {
      console.error("Failed to fetch access codes");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    void fetchCodes();
  }, [fetchCodes]);

  const copyToClipboard = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedToken(id);
      window.setTimeout(() => setCopiedToken(null), 1800);
    } catch {
      alert("Clipboard access was denied by the browser.");
    }
  };

  const copyLink = (code: AccessCodeItem) => {
    const link =
      code.url ||
      (typeof window !== "undefined" && code.token
        ? `${window.location.origin}/${code.token}`
        : "");
    if (!link) {
      alert("Link is not available for this code.");
      return;
    }
    void copyToClipboard(link, code.id);
  };

  const downloadOneQr = (item: GeneratedCodeDetail) => {
    const blob = dataUrlToBlob(item.qrDataUrl);
    downloadBlob(
      blob,
      `connectme-qr-${safeFilename(item.label || item.id.slice(0, 8))}.png`
    );
  };

  const downloadAllQrsZip = (items: GeneratedCodeDetail[]) => {
    if (!items.length) return;
    try {
      const files = items.map((item, index) => ({
        name: `qr-${String(index + 1).padStart(2, "0")}-${safeFilename(
          item.label || item.id.slice(0, 8)
        )}.png`,
        data: dataUrlToUint8Array(item.qrDataUrl),
      }));
      const zipBlob = createZipBlob(files);
      downloadBlob(zipBlob, `connectme-qrs-${items.length}-codes.zip`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create QR ZIP.");
    }
  };

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setGenerating(true);
      const expiresAt =
        genExpiryDays > 0
          ? new Date(Date.now() + genExpiryDays * 24 * 60 * 60 * 1000).toISOString()
          : null;
      const response = await apiClient.createCodes({
        count: genCount,
        label: genLabel.trim() || undefined,
        expiresAt,
      });
      if (!response.success) {
        alert(response.error.message || "Failed to generate access codes.");
        return;
      }
      if (!response.data) {
        alert("The API returned no generated codes.");
        return;
      }
      const details: GeneratedCodeDetail[] =
        "codes" in response.data ? response.data.codes : [response.data];
      setShowGenerateModal(false);
      setGeneratedResults(details);
      setSelectedIds(new Set());
      void fetchCodes();
    } catch {
      alert("Failed to generate access codes.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this code? It will no longer be redeemable.")) return;
    try {
      const response = await apiClient.revokeCode(id);
      if (response.success) {
        setSelectedIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        void fetchCodes();
      } else {
        alert(response.error?.message || "Failed to revoke code.");
      }
    } catch {
      alert("Network error while revoking code.");
    }
  };

  const selectableCodes = codes.filter((code) => code.status === "ACTIVE");
  const allVisibleSelected =
    selectableCodes.length > 0 &&
    selectableCodes.every((code) => selectedIds.has(code.id));

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleVisiblePage = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        selectableCodes.forEach((code) => next.delete(code.id));
      } else {
        selectableCodes.forEach((code) => next.add(code.id));
      }
      return next;
    });
  };

  const handleBulkRevoke = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      alert("Select at least one code to revoke.");
      return;
    }
    if (!confirm(`Revoke ${ids.length} selected code(s)? This cannot be undone.`)) return;
    try {
      setBulkBusy(true);
      const response = await apiClient.revokeCodes(ids);
      if (!response.success) {
        alert(response.error?.message || "Bulk revoke failed.");
        return;
      }
      setSelectedIds(new Set());
      alert(`Revoked ${response.data?.revokedCount ?? 0} code(s).`);
      void fetchCodes();
    } catch {
      alert("Network error while revoking selected codes.");
    } finally {
      setBulkBusy(false);
    }
  };

  const statusBadge = (status: CodeStatus) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
            <Clock className="h-3 w-3" /> ACTIVE
          </span>
        );
      case "CONSUMED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-royalViolet/40 bg-royalViolet/15 px-2.5 py-0.5 text-[10px] font-bold text-warmIvory">
            <CheckCircle2 className="h-3 w-3 text-royalViolet-hover" /> CONSUMED
          </span>
        );
      case "REVOKED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold text-red-400">
            <Ban className="h-3 w-3" /> REVOKED
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-border bg-slate/10 px-2.5 py-0.5 text-[10px] font-bold text-slate-light">
            EXPIRED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-warmIvory sm:text-3xl">
            QR Codes
          </h1>
          <p className="mt-1 text-xs text-slate-light">
            Generate and manage single-use QR access codes for attendee contact capture.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-royalViolet px-4 py-2.5 text-xs font-semibold text-white shadow-royal transition hover:bg-royalViolet-hover"
          >
            <Plus className="h-4 w-4" /> Generate Codes
          </button>
          <a
            href="/api/v1/admin/codes/export"
            download
            className="inline-flex items-center gap-1.5 rounded-xl border border-obsidian-border bg-obsidian-surface px-4 py-2.5 text-xs font-semibold text-warmIvory transition hover:bg-obsidian-elevated"
          >
            <Download className="h-4 w-4 text-metallicGold" /> Export CSV
          </a>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-obsidian-border bg-obsidian-surface/60 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate" />
          <input
            type="text"
            placeholder="Search by code label…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-obsidian-border bg-obsidian-elevated py-2 pl-9 pr-3 text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate">Status:</span>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="CONSUMED">Consumed</option>
            <option value="REVOKED">Revoked</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-royalViolet/30 bg-obsidian-surface/90 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-warmIvory">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleVisiblePage}
              disabled={!selectableCodes.length}
              className="h-4 w-4 accent-violet-600"
            />{" "}
            Select active codes on this page
          </label>
          <span className="rounded-full border border-royalViolet/40 bg-royalViolet/10 px-2.5 py-1 text-[10px] font-bold text-warmIvory">
            {selectedIds.size} selected
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleBulkRevoke}
            disabled={bulkBusy || selectedIds.size === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-40"
          >
            <Ban className="h-3.5 w-3.5" /> Revoke selected
          </button>
        </div>
      </div>

      {/* Codes Table */}
      <div className="overflow-hidden rounded-2xl border border-obsidian-border bg-obsidian-surface/90 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-royalViolet border-t-transparent" />
          </div>
        ) : codes.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-obsidian-border bg-obsidian-elevated/40 text-[11px] uppercase tracking-wider text-slate">
                <tr>
                  <th className="px-4 py-3 font-semibold">Select</th>
                  <th className="px-4 py-3 font-semibold">Label / Link</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Redemption / Contact</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Expires</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-border/50 text-warmIvory/90">
                {codes.map((code) => (
                  <tr key={code.id} className="transition hover:bg-obsidian-elevated/30">
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(code.id)}
                        disabled={code.status !== "ACTIVE"}
                        onChange={(event) => toggleOne(code.id, event.target.checked)}
                        aria-label={`Select ${code.label || "access code"}`}
                        className="h-4 w-4 accent-violet-600 disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-medium">
                      <div className="font-semibold text-warmIvory">
                        {code.label || "Untitled Code"}
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate">
                        <span>{code.token ? code.token : `${code.id.slice(0, 8)}…`}</span>
                        {code.url && (
                          <button
                            type="button"
                            onClick={() => copyLink(code)}
                            title="Copy link"
                            className="text-slate-light hover:text-warmIvory"
                          >
                            {copiedToken === code.id ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">{statusBadge(code.status)}</td>
                    <td className="px-4 py-3.5">
                      {code.hasSubmission ? (
                        <span className="font-semibold text-warmIvory">
                          {code.contactName || "Contact submitted"}
                        </span>
                      ) : (
                        <span className="text-slate">Unredeemed</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate">
                      {new Date(code.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-slate">
                      {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Copy Link Available Anytime */}
                        <button
                          type="button"
                          onClick={() => copyLink(code)}
                          className="inline-flex items-center gap-1 rounded-md border border-obsidian-border px-2.5 py-1 text-[11px] font-medium text-warmIvory hover:bg-obsidian-elevated"
                        >
                          {copiedToken === code.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 text-slate" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>

                        {/* Revoke for active codes */}
                        {code.status === "ACTIVE" && (
                          <button
                            onClick={() => void handleRevoke(code.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                          >
                            <Ban className="h-3 w-3" /> Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <QrCode className="mx-auto mb-3 h-8 w-8 text-slate" />
            <p className="text-sm font-medium text-warmIvory">No access codes found</p>
            <p className="mt-1 text-xs text-slate">
              Generate a single code or a batch of QR codes to distribute.
            </p>
          </div>
        )}
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

      {/* Generate Codes Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-obsidian-border bg-obsidian-surface p-6 shadow-royal">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-warmIvory">Generate access codes</h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="rounded-lg p-1 text-slate hover:text-warmIvory"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-light">
                  Batch count (1 to 100)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={genCount}
                  onChange={(event) =>
                    setGenCount(
                      Math.min(100, Math.max(1, parseInt(event.target.value, 10) || 1))
                    )
                  }
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-light">
                  Batch label (optional)
                </label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="e.g. VIP Reception"
                  value={genLabel}
                  onChange={(event) => setGenLabel(event.target.value)}
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-light">
                  Expiry duration (days, 0 = never)
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={genExpiryDays}
                  onChange={(event) =>
                    setGenExpiryDays(
                      Math.min(365, Math.max(0, parseInt(event.target.value, 10) || 0))
                    )
                  }
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="rounded-xl border border-obsidian-border px-4 py-2.5 text-xs font-semibold text-slate-light hover:bg-obsidian-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="rounded-xl bg-royalViolet px-5 py-2.5 text-xs font-semibold text-white shadow-royal hover:bg-royalViolet-hover disabled:opacity-50"
                >
                  {generating ? "Generating…" : "Generate codes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated Results Modal — ONLY opportunity to download High-Quality QR codes */}
      {generatedResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md">
          <div className="my-8 w-full max-w-3xl rounded-2xl border border-obsidian-border bg-obsidian-surface p-6 shadow-royal">
            <div className="mb-4 flex flex-col gap-3 border-b border-obsidian-border pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-warmIvory">
                  Generated {generatedResults.length} QR Code
                  {generatedResults.length === 1 ? "" : "s"}
                </h3>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    High-quality QR codes can <strong>only be downloaded now</strong> at generation time.
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {generatedResults.length > 1 && (
                  <button
                    type="button"
                    onClick={() => downloadAllQrsZip(generatedResults)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-royalViolet bg-royalViolet px-3 py-1.5 text-xs font-semibold text-white shadow-royal hover:bg-royalViolet-hover"
                  >
                    <Archive className="h-3.5 w-3.5" /> Download All QRs (ZIP)
                  </button>
                )}
                <button
                  onClick={() => setGeneratedResults(null)}
                  className="rounded-lg p-1 text-slate hover:text-warmIvory"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              {generatedResults.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 rounded-xl border border-obsidian-border bg-obsidian-elevated/50 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex shrink-0 justify-center">
                    <img
                      src={item.qrDataUrl}
                      alt={item.label || "QR code"}
                      className="h-36 w-36 rounded-xl border border-obsidian-border bg-white p-2 shadow-md"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <div className="text-sm font-bold text-warmIvory">
                        {item.label || "Access Code"}
                      </div>
                      <div className="mt-1 break-all font-mono text-[11px] text-slate-light">
                        {item.url}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => downloadOneQr(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-royalViolet px-3 py-1.5 text-xs font-semibold text-white shadow-royal hover:bg-royalViolet-hover"
                      >
                        <Download className="h-3.5 w-3.5" /> Download HQ QR (PNG)
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyToClipboard(item.url, item.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-obsidian-border bg-obsidian-surface px-2.5 py-1.5 text-xs text-warmIvory hover:bg-obsidian-elevated"
                      >
                        {copiedToken === item.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-slate" /> Copy Link
                          </>
                        )}
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-obsidian-border bg-obsidian-surface px-2.5 py-1.5 text-xs text-slate-light hover:text-warmIvory"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open Form
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-obsidian-border pt-4">
              <span className="text-[11px] text-slate">
                You can copy the link for any code at any time from the dashboard.
              </span>
              <button
                onClick={() => setGeneratedResults(null)}
                className="rounded-xl bg-obsidian-elevated px-5 py-2 text-xs font-semibold text-warmIvory hover:bg-obsidian-border"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
