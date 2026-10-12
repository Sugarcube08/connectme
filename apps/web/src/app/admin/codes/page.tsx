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
} from "lucide-react";
import { AccessCodeItem, GeneratedCodeDetail, CodeStatus } from "@connectme/contracts";
import { apiClient } from "@/lib/api";

export default function AdminCodesPage() {
  const [codes, setCodes] = useState<AccessCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Generation Modal States
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genCount, setGenCount] = useState(1);
  const [genLabel, setGenLabel] = useState("");
  const [genExpiryDays, setGenExpiryDays] = useState(30);
  const [generating, setGenerating] = useState(false);

  // Newly Generated Codes Display Modal
  const [generatedResults, setGeneratedResults] = useState<GeneratedCodeDetail[] | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchCodes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.listCodes({
        page,
        limit: 15,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        search: search.trim() || undefined,
      });

      if (res.success && res.data) {
        setCodes(res.data);
        if (res.meta?.totalPages) setTotalPages(res.meta.totalPages);
      }
    } catch {
      console.error("Failed to fetch codes");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGenerating(true);
      const expiresAt =
        genExpiryDays > 0
          ? new Date(Date.now() + genExpiryDays * 24 * 3600 * 1000).toISOString()
          : null;

      const res = await apiClient.createCodes({
        count: genCount,
        label: genLabel.trim() || undefined,
        expiresAt,
      });

      if (res.success && res.data) {
        setShowGenerateModal(false);
        const details: GeneratedCodeDetail[] = Array.isArray((res.data as any).codes)
          ? (res.data as any).codes
          : [res.data];
        setGeneratedResults(details);
        fetchCodes();
      }
    } catch {
      alert("Failed to generate codes");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this code? It will no longer be redeemable.")) {
      return;
    }

    try {
      const res = await apiClient.revokeCode(id);
      if (res.success) {
        fetchCodes();
      } else {
        alert(res.error?.message || "Failed to revoke code");
      }
    } catch {
      alert("Network error revoking code");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const downloadQr = (dataUrl: string, label: string | null) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `connectme-qr-${(label || "code").toLowerCase().replace(/\s+/g, "-")}.png`;
    a.click();
  };

  const statusBadge = (status: CodeStatus) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
            <Clock className="h-3 w-3" />
            ACTIVE
          </span>
        );
      case "CONSUMED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-royalViolet/40 bg-royalViolet/15 px-2.5 py-0.5 text-[10px] font-bold text-warmIvory">
            <CheckCircle2 className="h-3 w-3 text-royalViolet-hover" />
            CONSUMED
          </span>
        );
      case "REVOKED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold text-red-400">
            <Ban className="h-3 w-3" />
            REVOKED
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
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-warmIvory sm:text-3xl">
            Access Codes & QR Assets
          </h1>
          <p className="mt-1 text-xs text-slate-light">
            Generate single-use cryptographic cards and manage their redemption state
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-royalViolet px-4 py-2.5 text-xs font-semibold text-white shadow-royal transition hover:bg-royalViolet-hover"
          >
            <Plus className="h-4 w-4" />
            <span>Generate Codes</span>
          </button>

          <a
            href="/api/v1/admin/codes/export"
            download
            className="inline-flex items-center gap-1.5 rounded-xl border border-obsidian-border bg-obsidian-surface px-4 py-2.5 text-xs font-semibold text-warmIvory transition hover:bg-obsidian-elevated"
          >
            <Download className="h-4 w-4 text-metallicGold" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-obsidian-border bg-obsidian-surface/60 p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate" />
          <input
            type="text"
            placeholder="Search by code label..."
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
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="CONSUMED">Consumed</option>
            <option value="REVOKED">Revoked</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {/* Codes Table */}
      <div className="rounded-2xl border border-obsidian-border bg-obsidian-surface/90 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex py-16 justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-royalViolet border-t-transparent" />
          </div>
        ) : codes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-obsidian-border bg-obsidian-elevated/40 text-[11px] uppercase tracking-wider text-slate">
                <tr>
                  <th className="py-3 px-4 font-semibold">Label / ID</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Redemption / Contact</th>
                  <th className="py-3 px-4 font-semibold">Created</th>
                  <th className="py-3 px-4 font-semibold">Expires</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-border/50 text-warmIvory/90">
                {codes.map((c) => (
                  <tr key={c.id} className="transition hover:bg-obsidian-elevated/30">
                    <td className="py-3.5 px-4 font-medium">
                      <div className="text-warmIvory font-semibold">{c.label || "Untitled Code"}</div>
                      <div className="text-[10px] font-mono text-slate">{c.id.slice(0, 8)}...</div>
                    </td>
                    <td className="py-3.5 px-4">{statusBadge(c.status)}</td>
                    <td className="py-3.5 px-4">
                      {c.hasSubmission ? (
                        <span className="font-semibold text-warmIvory">
                          {c.contactName || "Contact Submitted"}
                        </span>
                      ) : (
                        <span className="text-slate">Unredeemed</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {c.status === "ACTIVE" && (
                        <button
                          onClick={() => handleRevoke(c.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                        >
                          <Ban className="h-3 w-3" />
                          <span>Revoke</span>
                        </button>
                      )}
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
              Generate a single or batch of QR codes to distribute.
            </p>
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

      {/* Generation Form Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-obsidian-border bg-obsidian-surface p-6 shadow-royal">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-warmIvory">Generate Access Codes</h3>
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
                  Batch Count (1 to 100)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={genCount}
                  onChange={(e) => setGenCount(parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-light">
                  Batch Label (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Devcon Day 1 Booth"
                  value={genLabel}
                  onChange={(e) => setGenLabel(e.target.value)}
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-light">
                  Expiry Duration (Days, 0 = never)
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={genExpiryDays}
                  onChange={(e) => setGenExpiryDays(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
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
                  {generating ? "Generating..." : "Generate Codes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated Results & QR Showcase Modal */}
      {generatedResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-obsidian-border bg-obsidian-surface p-6 shadow-royal my-8">
            <div className="mb-4 flex items-center justify-between border-b border-obsidian-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-warmIvory">
                  Generated {generatedResults.length} Access Code{generatedResults.length > 1 ? "s" : ""}
                </h3>
                <p className="text-xs text-metallicGold">
                  Download QR assets now. For security, raw tokens are only shown during creation.
                </p>
              </div>
              <button
                onClick={() => setGeneratedResults(null)}
                className="rounded-lg p-1 text-slate hover:text-warmIvory"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {generatedResults.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-obsidian-border bg-obsidian-elevated/50 p-4"
                >
                  <div className="shrink-0 rounded-lg bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.qrDataUrl}
                      alt="QR Code"
                      className="h-28 w-28 object-contain"
                    />
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="font-semibold text-sm text-warmIvory">
                      {item.label || "Access Code"}
                    </div>
                    <div className="break-all font-mono text-[11px] text-slate-light">
                      {item.url}
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <button
                        onClick={() => copyToClipboard(item.url, item.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-obsidian-border bg-obsidian-surface px-2.5 py-1.5 text-xs text-warmIvory hover:bg-obsidian-elevated"
                      >
                        {copiedToken === item.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-slate" />
                            <span>Copy URL</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => downloadQr(item.qrDataUrl, item.label)}
                        className="inline-flex items-center gap-1 rounded-lg bg-royalViolet px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-royalViolet-hover"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download QR (PNG)</span>
                      </button>

                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-obsidian-border bg-obsidian-surface px-2.5 py-1.5 text-xs text-slate-light hover:text-warmIvory"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Open Form</span>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-obsidian-border pt-4 text-right">
              <button
                onClick={() => setGeneratedResults(null)}
                className="rounded-xl bg-obsidian-elevated px-5 py-2 text-xs font-semibold text-warmIvory hover:bg-obsidian-border"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
