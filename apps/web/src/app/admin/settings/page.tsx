"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Settings, Save, AlertCircle, CheckCircle2, UserCheck, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api";

export default function AdminSettingsPage() {
  const [brandName, setBrandName] = useState("Connect Me");
  const [privacyNotice, setPrivacyNotice] = useState("");
  const [defaultExpiryDays, setDefaultExpiryDays] = useState<number | "">(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const res = await apiClient.getSettings();
        if (res.success && res.data) {
          setBrandName(res.data.brandName || "Connect Me");
          setPrivacyNotice(res.data.privacyNotice || "");
          setDefaultExpiryDays(
            res.data.defaultExpiryDays !== null ? res.data.defaultExpiryDays : ""
          );
        }
      } catch {
        setMessage({ type: "error", text: "Failed to load application settings." });
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    try {
      const res = await apiClient.updateSettings({
        brandName: brandName.trim(),
        privacyNotice: privacyNotice.trim(),
        defaultExpiryDays: defaultExpiryDays === "" ? null : Number(defaultExpiryDays),
      });

      if (res.success) {
        setMessage({ type: "success", text: "Settings saved successfully." });
      } else {
        setMessage({ type: "error", text: res.error?.message || "Failed to save settings." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error saving settings." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-royalViolet border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-warmIvory sm:text-3xl">
          Application Settings
        </h1>
        <p className="mt-1 text-xs text-slate-light">
          Configure branding, privacy disclosure, and default code expirations
        </p>
      </div>

      {message && (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 text-xs font-medium ${
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-obsidian-border bg-obsidian-surface/90 p-6 shadow-sm space-y-5"
      >
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warmIvory">
            Public Brand Name
          </label>
          <input
            type="text"
            required
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warmIvory">
            Privacy Notice
          </label>
          <textarea
            rows={4}
            value={privacyNotice}
            onChange={(e) => setPrivacyNotice(e.target.value)}
            className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
          />
          <span className="mt-1 block text-[11px] text-slate">
            Presented on public submission pages to inform visitors of direct owner follow-up.
          </span>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warmIvory">
            Default Code Expiry (Days)
          </label>
          <input
            type="number"
            min={0}
            max={365}
            value={defaultExpiryDays}
            onChange={(e) =>
              setDefaultExpiryDays(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
          />
          <span className="mt-1 block text-[11px] text-slate">
            Default number of days before generated codes automatically expire (0 or blank for no expiration).
          </span>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-royalViolet px-5 py-2.5 text-xs font-semibold text-white shadow-royal transition hover:bg-royalViolet-hover disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? "Saving..." : "Save Settings"}</span>
          </button>
        </div>
      </form>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-obsidian-border bg-obsidian-surface/90 p-6 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-warmIvory">Administrator Team</h2>
          <p className="mt-1 text-xs text-slate-light">
            Manage your administrators and provision new admin users with full creator tracking.
          </p>
        </div>
        <Link
          href="/admin/team"
          className="inline-flex items-center gap-1.5 rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs font-semibold text-warmIvory hover:border-royalViolet transition"
        >
          <UserCheck className="h-4 w-4 text-metallicGold" />
          <span>Manage Team</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
