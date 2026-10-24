"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Save,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  ArrowRight,
  MessageSquare,
  ShieldCheck,
  Eye,
  EyeOff,
  Info,
  Server,
  Lock,
} from "lucide-react";
import { apiClient } from "@/lib/api";

export default function AdminSettingsPage() {
  // Global App Settings
  const [brandName, setBrandName] = useState("Connect Me");
  const [privacyNotice, setPrivacyNotice] = useState("");
  const [defaultExpiryDays, setDefaultExpiryDays] = useState<number | "">(30);
  const [appSaving, setAppSaving] = useState(false);
  const [appMessage, setAppMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // SMS Gateway Settings (Admin-specific)
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsGatewayUrl, setSmsGatewayUrl] = useState("");
  const [smsGatewayUsername, setSmsGatewayUsername] = useState("");
  const [smsGatewayPassword, setSmsGatewayPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [smsTemplate, setSmsTemplate] = useState("");
  const [smsSenderPhone, setSmsSenderPhone] = useState("");
  const [smsSenderEmail, setSmsSenderEmail] = useState("");
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsMessage, setSmsMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const [appRes, smsRes] = await Promise.all([
          apiClient.getSettings(),
          apiClient.getAdminSmsSettings(),
        ]);

        if (appRes.success && appRes.data) {
          setBrandName(appRes.data.brandName || "Connect Me");
          setPrivacyNotice(appRes.data.privacyNotice || "");
          setDefaultExpiryDays(
            appRes.data.defaultExpiryDays !== null ? appRes.data.defaultExpiryDays : ""
          );
        }

        if (smsRes.success && smsRes.data) {
          setSmsEnabled(smsRes.data.smsEnabled || false);
          setSmsGatewayUrl(smsRes.data.smsGatewayUrl || "");
          setSmsGatewayUsername(smsRes.data.smsGatewayUsername || "");
          setHasPassword(Boolean(smsRes.data.hasPassword));
          setSmsTemplate(smsRes.data.smsTemplate || "");
          setSmsSenderPhone(smsRes.data.smsSenderPhone || "");
          setSmsSenderEmail(smsRes.data.smsSenderEmail || "");
        }
      } catch {
        setAppMessage({ type: "error", text: "Failed to load application settings." });
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const handleSaveApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppMessage(null);
    setAppSaving(true);

    try {
      const res = await apiClient.updateSettings({
        brandName: brandName.trim(),
        privacyNotice: privacyNotice.trim(),
        defaultExpiryDays: defaultExpiryDays === "" ? null : Number(defaultExpiryDays),
      });

      if (res.success) {
        setAppMessage({ type: "success", text: "Application settings saved successfully." });
      } else {
        setAppMessage({ type: "error", text: res.error.message || "Failed to save settings." });
      }
    } catch {
      setAppMessage({ type: "error", text: "Network error saving application settings." });
    } finally {
      setAppSaving(false);
    }
  };

  const handleSaveSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsMessage(null);

    const trimmedUrl = smsGatewayUrl.trim();
    const trimmedUsername = smsGatewayUsername.trim();
    const trimmedPassword = smsGatewayPassword.trim();

    if (smsEnabled) {
      if (!trimmedUrl) {
        setSmsMessage({ type: "error", text: "SMS Gateway URL is required when SMS delivery is enabled." });
        return;
      }
      if (!trimmedUsername) {
        setSmsMessage({ type: "error", text: "SMS Gateway Username is required when SMS delivery is enabled." });
        return;
      }
      if (!hasPassword && !trimmedPassword) {
        setSmsMessage({ type: "error", text: "SMS Gateway Password is required when SMS delivery is enabled." });
        return;
      }
    } else if (trimmedUrl) {
      if (!trimmedUsername) {
        setSmsMessage({ type: "error", text: "SMS Gateway Username is required when Gateway URL is provided." });
        return;
      }
      if (!hasPassword && !trimmedPassword) {
        setSmsMessage({ type: "error", text: "SMS Gateway Password is required when Gateway URL is provided." });
        return;
      }
    }

    setSmsSaving(true);
    try {
      const res = await apiClient.updateAdminSmsSettings({
        smsEnabled,
        smsGatewayUrl: trimmedUrl || "",
        smsGatewayUsername: trimmedUsername || "",
        smsGatewayPassword: trimmedPassword || undefined,
        smsTemplate: smsTemplate.trim() || "",
        smsSenderPhone: smsSenderPhone.trim() || "",
        smsSenderEmail: smsSenderEmail.trim() || "",
      });

      if (res.success) {
        setHasPassword(Boolean(res.data.hasPassword));
        setSmsGatewayPassword("");
        setSmsMessage({ type: "success", text: "SMS Gateway settings saved securely." });
      } else {
        setSmsMessage({ type: "error", text: res.error.message || "Failed to save SMS settings." });
      }
    } catch {
      setSmsMessage({ type: "error", text: "Network error saving SMS settings." });
    } finally {
      setSmsSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    setSmsTemplate((prev) => `${prev} {{${variable}}}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-royalViolet border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-warmIvory sm:text-3xl">
          Settings & Integrations
        </h1>
        <p className="mt-1 text-xs text-slate-light">
          Configure system branding, code expirations, and your personal SMS Gateway integration
        </p>
      </div>

      {/* Global Application Settings */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-warmIvory">
            System Branding & Expiry
          </h2>
          <p className="text-xs text-slate">
            Shared settings applied across the platform
          </p>
        </div>

        {appMessage && (
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 text-xs font-medium ${
              appMessage.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/30 bg-red-500/10 text-red-200"
            }`}
          >
            {appMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            )}
            <span>{appMessage.text}</span>
          </div>
        )}

        <form
          onSubmit={handleSaveApp}
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
              disabled={appSaving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-royalViolet px-5 py-2.5 text-xs font-semibold text-white shadow-royal transition hover:bg-royalViolet-hover disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{appSaving ? "Saving..." : "Save System Settings"}</span>
            </button>
          </div>
        </form>
      </section>

      {/* SMS Gateway & Auto-Contact Dispatch */}
      <section className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-royalViolet" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-warmIvory">
              SMS Gateway & Auto-Contact Dispatch
            </h2>
          </div>
          <p className="text-xs text-slate">
            Configure your personal SMS Gateway connection to automatically text your contact card to visitors when they submit your form.
          </p>
        </div>

        {smsMessage && (
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 text-xs font-medium ${
              smsMessage.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/30 bg-red-500/10 text-red-200"
            }`}
          >
            {smsMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            )}
            <span>{smsMessage.text}</span>
          </div>
        )}

        <form
          onSubmit={handleSaveSms}
          className="rounded-2xl border border-obsidian-border bg-obsidian-surface/90 p-6 shadow-sm space-y-6"
        >
          {/* Enable Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-obsidian-border bg-obsidian-elevated/40 p-4">
            <div>
              <span className="block text-xs font-semibold text-warmIvory">
                Enable SMS Auto-Dispatch
              </span>
              <span className="block text-[11px] text-slate-light">
                Automatically send your contact information via SMS immediately upon visitor submission
              </span>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={smsEnabled}
                onChange={(e) => setSmsEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-obsidian-border after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-slate-light after:transition-all after:content-[''] peer-checked:bg-royalViolet peer-checked:after:translate-x-full peer-checked:after:bg-white peer-focus:outline-none"></div>
            </label>
          </div>

          {/* Form Notice Alert */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Info className="h-4 w-4 shrink-0" />
              <span>Visitor Notice Banner</span>
            </div>
            <p className="text-amber-200/90 leading-relaxed text-[11px]">
              When SMS delivery is enabled, your public form will display this exact advisory to visitors:
            </p>
            <div className="rounded-lg border-l-2 border-amber-400 bg-amber-500/10 px-3 py-2 italic font-mono text-[11px] text-amber-100">
              &ldquo;be sure to enter correct number, because it&apos;s not editable and you&apos;ll receive my contact on the given number via sms only&rdquo;
            </div>
          </div>

          {/* Gateway Credentials */}
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-warmIvory">
                <span className="flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-royalViolet" />
                  SMS Gateway API URL
                </span>
                <span className="text-[10px] lowercase text-slate">(no default url)</span>
              </label>
              <input
                type="url"
                value={smsGatewayUrl}
                onChange={(e) => setSmsGatewayUrl(e.target.value)}
                placeholder="https://androgateserver.onrender.com"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
              />
              <span className="mt-1 block text-[11px] text-slate">
                The HTTPS base URL of your Android SMS Gateway or AndroGate Server instance.
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warmIvory">
                  Gateway Username
                </label>
                <input
                  type="text"
                  value={smsGatewayUsername}
                  onChange={(e) => setSmsGatewayUsername(e.target.value)}
                  placeholder="e.g. admin or username"
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-warmIvory">
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-emerald-400" />
                    Gateway Password
                  </span>
                  {hasPassword && (
                    <span className="text-[10px] text-emerald-400 font-normal">
                      ✓ Configured
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={smsGatewayPassword}
                    onChange={(e) => setSmsGatewayPassword(e.target.value)}
                    placeholder={hasPassword ? "•••••••• (leave blank to keep current)" : "Enter gateway password"}
                    className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated pl-4 pr-10 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate hover:text-warmIvory"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/90">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Credentials are encrypted with authenticated AES-256-GCM at rest and never exposed in plaintext.</span>
            </div>
          </div>

          {/* Admin Sender Info (Included in SMS) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-obsidian-border/50">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warmIvory">
                Your Contact Phone
              </label>
              <input
                type="tel"
                value={smsSenderPhone}
                onChange={(e) => setSmsSenderPhone(e.target.value)}
                placeholder="+1 555-0199"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
              />
              <span className="mt-1 block text-[11px] text-slate">
                Shared in the SMS via &#123;&#123;adminPhone&#125;&#125;
              </span>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warmIvory">
                Your Contact Email
              </label>
              <input
                type="email"
                value={smsSenderEmail}
                onChange={(e) => setSmsSenderEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none"
              />
              <span className="mt-1 block text-[11px] text-slate">
                Shared in the SMS via &#123;&#123;adminEmail&#125;&#125;
              </span>
            </div>
          </div>

          {/* SMS Template */}
          <div className="space-y-2 pt-2 border-t border-obsidian-border/50">
            <label className="block text-xs font-semibold uppercase tracking-wider text-warmIvory">
              SMS Message Template
            </label>
            <textarea
              rows={4}
              value={smsTemplate}
              onChange={(e) => setSmsTemplate(e.target.value)}
              placeholder="Hi {{fullName}}, thanks for connecting! Here are my contact details: {{adminName}} | Phone: {{adminPhone}} | Email: {{adminEmail}}. Looking forward to staying in touch!"
              className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory font-mono focus:border-royalViolet focus:outline-none"
            />
            <div className="space-y-1.5">
              <span className="block text-[11px] text-slate">
                Click any tag below to append it to your SMS template:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "fullName",
                  "phoneNumber",
                  "email",
                  "organization",
                  "role",
                  "adminName",
                  "adminPhone",
                  "adminEmail",
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertVariable(tag)}
                    className="rounded-md border border-obsidian-border bg-obsidian-elevated px-2 py-0.5 text-[10px] font-mono text-royalViolet hover:border-royalViolet transition"
                  >
                    &#123;&#123;{tag}&#125;&#125;
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={smsSaving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-royalViolet px-5 py-2.5 text-xs font-semibold text-white shadow-royal transition hover:bg-royalViolet-hover disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{smsSaving ? "Saving..." : "Save SMS Gateway Settings"}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Administrator Team Card */}
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