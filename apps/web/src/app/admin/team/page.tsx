"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  UserCheck,
  Crown,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Calendar,
  User,
  Search,
  Copy,
  ExternalLink,
} from "lucide-react";
import { AdminUserDTO } from "@connectme/contracts";
import { apiClient } from "@/lib/api";

export default function AdminTeamPage() {
  const [admins, setAdmins] = useState<AdminUserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await apiClient.listAdmins();
      if (res.success) {
        setAdmins(res.data);
      } else {
        setError(res.error.message || "Failed to load administrator accounts.");
      }
    } catch {
      setError("Network error loading administrator accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/admin/register`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const filteredAdmins = admins.filter((admin) => {
    const term = search.toLowerCase();
    return (
      admin.username.toLowerCase().includes(term) ||
      (admin.displayName && admin.displayName.toLowerCase().includes(term)) ||
      (admin.createdBy && admin.createdBy.username.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-warmIvory sm:text-3xl">
              Administrator Team
            </h1>
            <span className="rounded-full border border-metallicGold/30 bg-metallicGold/10 px-2.5 py-0.5 text-[11px] font-semibold text-metallicGold">
              Platform Admin
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-light">
            Directory of registered platform administrators. New administrators register independently via the public portal.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-2 rounded-xl border border-obsidian-border bg-obsidian-surface px-3.5 py-2.5 text-xs font-semibold text-warmIvory hover:border-royalViolet hover:bg-obsidian-elevated transition"
          >
            {copiedLink ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400">Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-slate" />
                <span>Copy Registration Link</span>
              </>
            )}
          </button>

          <Link
            href="/admin/register"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-xl bg-royalViolet px-4 py-2.5 text-xs font-semibold text-white shadow-royal transition hover:bg-royalViolet-hover"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Public Signup Portal</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Overview Stats */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate" />
          <input
            type="text"
            placeholder="Search admins by name or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-obsidian-border bg-obsidian-surface py-2.5 pl-10 pr-4 text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-light">
          <div>
            Total Administrators: <span className="font-semibold text-warmIvory">{admins.length}</span>
          </div>
        </div>
      </div>

      {/* Admin Users Table / Cards */}
      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-royalViolet border-t-transparent" />
        </div>
      ) : filteredAdmins.length === 0 ? (
        <div className="rounded-2xl border border-obsidian-border bg-obsidian-surface p-12 text-center text-slate">
          <UserCheck className="mx-auto mb-3 h-8 w-8 text-slate" />
          <p className="text-sm">No administrators found matching your search.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-obsidian-border bg-obsidian-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-obsidian-border bg-obsidian-elevated/60 text-[11px] font-semibold uppercase tracking-wider text-slate">
                <tr>
                  <th className="px-5 py-3.5">Administrator</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Created By</th>
                  <th className="px-5 py-3.5">Created Date</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-border">
                {filteredAdmins.map((admin) => {
                  const isInitial = Boolean(admin.isInitialAdmin);
                  const createdDate = new Date(admin.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });

                  return (
                    <tr key={admin.id} className="transition hover:bg-obsidian-elevated/40">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs ${
                            isInitial
                              ? "bg-metallicGold/20 text-metallicGold border border-metallicGold/30"
                              : "bg-royalViolet/20 text-royalViolet-hover"
                          }`}>
                            {admin.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-warmIvory">
                              {admin.displayName || admin.username}
                            </div>
                            <div className="text-[11px] text-slate font-mono">
                              @{admin.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {isInitial ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-metallicGold/40 bg-metallicGold/10 px-2.5 py-1 text-[11px] font-semibold text-metallicGold">
                            <Crown className="h-3 w-3" />
                            <span>Initial Admin</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-royalViolet/40 bg-royalViolet/10 px-2.5 py-1 text-[11px] font-semibold text-royalViolet-hover">
                            <ShieldCheck className="h-3 w-3" />
                            <span>Administrator</span>
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {isInitial ? (
                          <div className="flex items-center gap-1.5 text-metallicGold">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span className="font-medium">System Root / Setup</span>
                          </div>
                        ) : admin.createdBy ? (
                          <div>
                            <span className="text-warmIvory font-medium">
                              @{admin.createdBy.username}
                            </span>
                            {admin.createdBy.displayName && (
                              <span className="text-slate block text-[11px]">
                                ({admin.createdBy.displayName})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate">System Administrator</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-light">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate" />
                          <span>{createdDate}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                          Active
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
