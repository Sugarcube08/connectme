"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import {
  ShieldCheck,
  KeyRound,
  User,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [bootstrapPending, setBootstrapPending] = useState<boolean | null>(null);
  const [configuredUsername, setConfiguredUsername] = useState("harsh");

  // Form Fields
  const [token, setToken] = useState(tokenParam);
  const [username, setUsername] = useState("harsh");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        setLoading(true);
        const res = await apiClient.getBootstrapStatus();
        if (res.success && res.data) {
          setBootstrapPending(res.data.isBootstrapPending);
          if (res.data.username) {
            setConfiguredUsername(res.data.username);
            setUsername(res.data.username);
          }
        }
      } catch {
        setError("Could not communicate with the API server.");
      } finally {
        setLoading(false);
      }
    }

    if (tokenParam) {
      setToken(tokenParam);
    }
    checkStatus();
  }, [tokenParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError("Please provide the one-time setup token delivered during provisioning.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiClient.setupBootstrap({
        token: token.trim(),
        username: username.trim(),
        displayName: displayName.trim() || undefined,
        password,
      });

      if (res.success) {
        router.push("/admin");
      } else {
        setError(res.error?.message || "Setup failed. Please check your token.");
      }
    } catch {
      setError("Network error during setup.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-royalViolet border-t-transparent" />
      </div>
    );
  }

  // If bootstrap already completed
  if (bootstrapPending === false) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-obsidian-border bg-obsidian-surface/95 p-8 text-center shadow-royal backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-warmIvory">Setup Already Complete</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-light">
            The administrator account for Connect Me has already been provisioned and permanently locked.
          </p>
          <div className="mt-6">
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 rounded-xl bg-royalViolet px-5 py-2.5 text-xs font-semibold text-white shadow-royal hover:bg-royalViolet-hover"
            >
              <span>Go to Admin Login</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-obsidian-border bg-obsidian-surface/95 p-8 shadow-royal backdrop-blur-xl">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-metallicGold/40 bg-metallicGold/10 px-3.5 py-1 text-xs font-semibold text-metallicGold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>FIRST-ADMIN PROVISIONING</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-warmIvory">
            Initialize Administrator
          </h1>
          <p className="mt-1 text-xs text-slate-light">
            Enter your deployment setup token to set up your profile and password.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Setup Token */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-metallicGold">
              One-Time Setup Token <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate" />
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="22-char token from provisioning log"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated py-2.5 pl-10 pr-4 font-mono text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate">
              Generated by <code className="text-warmIvory font-mono">pnpm db:bootstrap</code>.
            </p>
          </div>

          {/* Username */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-light">
              Admin Username
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={configuredUsername}
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated py-2.5 pl-10 pr-4 text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none"
              />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-light">
              Display Name <span className="text-slate font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Harsh"
              className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none"
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-light">
              Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters (1 uppercase, 1 number)"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated py-2.5 pl-10 pr-4 text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none"
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-light">
              Confirm Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated py-2.5 pl-10 pr-4 text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-royalViolet py-3 text-xs font-semibold text-white shadow-royal transition hover:bg-royalViolet-hover disabled:opacity-50"
          >
            {submitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>Complete Setup & Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate">
          <ShieldCheck className="h-3.5 w-3.5 text-metallicGold" />
          <span>No hardcoded credentials &bull; One-time bootstrap</span>
        </div>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-obsidian" />}>
      <SetupContent />
    </Suspense>
  );
}
