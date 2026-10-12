"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  QrCode,
  Users,
  CheckCircle2,
  Clock,
  Ban,
  ArrowUpRight,
  Plus,
  Download,
  AlertCircle,
} from "lucide-react";
import { DashboardMetrics, FollowUpStatus } from "@connectme/contracts";
import { apiClient } from "@/lib/api";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      try {
        setLoading(true);
        const res = await apiClient.getDashboard();
        if (res.success) {
          setMetrics(res.data);
        } else {
          if (res.error.code === "UNAUTHORIZED") {
            router.push("/admin/login");
          } else {
            setError(res.error.message || "Failed to load dashboard metrics.");
          }
        }
      } catch {
        setError("Network error while connecting to server.");
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, [router]);

  const statusColors: Record<FollowUpStatus, string> = {
    NEW: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    CONTACTED: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    REPLIED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    OPPORTUNITY: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    ARCHIVED: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-royalViolet border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300">
        <AlertCircle className="mx-auto mb-2 h-6 w-6" />
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-warmIvory sm:text-3xl">
            Devcon Operations
          </h1>
          <p className="mt-1 text-xs text-slate-light">
            Overview of single-use visiting codes and collected professional contacts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/codes"
            className="inline-flex items-center gap-1.5 rounded-xl bg-royalViolet px-4 py-2.5 text-xs font-semibold text-white shadow-royal transition hover:bg-royalViolet-hover"
          >
            <Plus className="h-4 w-4" />
            <span>Generate Codes</span>
          </Link>

          <a
            href="/api/v1/admin/contacts/export"
            download
            className="inline-flex items-center gap-1.5 rounded-xl border border-obsidian-border bg-obsidian-surface px-4 py-2.5 text-xs font-semibold text-warmIvory transition hover:bg-obsidian-elevated"
          >
            <Download className="h-4 w-4 text-metallicGold" />
            <span>Export Contacts CSV</span>
          </a>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-obsidian-border bg-obsidian-surface/80 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-light">
            <span className="text-xs font-medium uppercase tracking-wider">Total Generated</span>
            <QrCode className="h-4 w-4 text-royalViolet" />
          </div>
          <p className="mt-3 text-2xl font-black text-warmIvory sm:text-3xl">
            {metrics?.totalCodes ?? 0}
          </p>
          <span className="text-[11px] text-slate">All time</span>
        </div>

        <div className="rounded-xl border border-obsidian-border bg-obsidian-surface/80 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-light">
            <span className="text-xs font-medium uppercase tracking-wider">Active Unused</span>
            <Clock className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-400 sm:text-3xl">
            {metrics?.activeCodes ?? 0}
          </p>
          <span className="text-[11px] text-slate">Ready to be scanned</span>
        </div>

        <div className="rounded-xl border border-obsidian-border bg-obsidian-surface/80 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-light">
            <span className="text-xs font-medium uppercase tracking-wider">Consumed</span>
            <CheckCircle2 className="h-4 w-4 text-royalViolet" />
          </div>
          <p className="mt-3 text-2xl font-black text-warmIvory sm:text-3xl">
            {metrics?.consumedCodes ?? 0}
          </p>
          <span className="text-[11px] text-slate">Single-use burned</span>
        </div>

        <div className="rounded-xl border border-obsidian-border bg-obsidian-surface/80 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-light">
            <span className="text-xs font-medium uppercase tracking-wider">Revoked/Expired</span>
            <Ban className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-3 text-2xl font-black text-slate-light sm:text-3xl">
            {(metrics?.revokedCodes ?? 0) + (metrics?.expiredCodes ?? 0)}
          </p>
          <span className="text-[11px] text-slate">Unavailable</span>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-xl border border-royalViolet/40 bg-royalViolet/10 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-warmIvory">
            <span className="text-xs font-medium uppercase tracking-wider">Contacts Collected</span>
            <Users className="h-4 w-4 text-metallicGold" />
          </div>
          <p className="mt-3 text-2xl font-black text-warmIvory sm:text-3xl">
            {metrics?.totalSubmissions ?? 0}
          </p>
          <span className="text-[11px] text-metallicGold">Network connections</span>
        </div>
      </div>

      {/* Recent Submissions Section */}
      <div className="rounded-2xl border border-obsidian-border bg-obsidian-surface/90 p-6 backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-warmIvory">
              Recent Submissions
            </h2>
            <p className="text-xs text-slate-light">
              Latest contacts received via single-use card redemptions
            </p>
          </div>
          <Link
            href="/admin/contacts"
            className="inline-flex items-center gap-1 text-xs font-semibold text-royalViolet-hover hover:underline"
          >
            <span>View All Contacts</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {metrics?.recentSubmissions && metrics.recentSubmissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-obsidian-border text-[11px] uppercase tracking-wider text-slate">
                <tr>
                  <th className="pb-3 font-semibold">Name & Role</th>
                  <th className="pb-3 font-semibold">Organization</th>
                  <th className="pb-3 font-semibold">Phone</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-border/50 text-warmIvory/90">
                {metrics.recentSubmissions.map((c) => (
                  <tr key={c.id} className="transition hover:bg-obsidian-elevated/40">
                    <td className="py-3.5 pr-4">
                      <div className="font-semibold text-warmIvory">{c.fullName}</div>
                      {c.role && <div className="text-[11px] text-slate">{c.role}</div>}
                    </td>
                    <td className="py-3.5 pr-4 text-slate-light">{c.organization || "—"}</td>
                    <td className="py-3.5 pr-4 font-mono text-warmIvory/80">{c.phoneNumber}</td>
                    <td className="py-3.5 pr-4">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                          statusColors[c.followUpStatus]
                        }`}
                      >
                        {c.followUpStatus}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate">
                      {new Date(c.submittedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-slate" />
            <p className="text-sm font-medium text-warmIvory">No contact submissions yet</p>
            <p className="mt-1 text-xs text-slate">
              Generate QR cards and distribute them to start collecting contacts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
