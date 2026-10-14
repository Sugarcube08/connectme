"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, User, ArrowRight, AlertCircle, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api";

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialUsername = searchParams.get("username") || "";

  const [step, setStep] = useState<"username" | "password">("username");
  const [username, setUsername] = useState(initialUsername);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If a username query param was provided, check it automatically on mount
  useEffect(() => {
    if (initialUsername.trim()) {
      handleCheckUsername(initialUsername.trim());
    }
  }, [initialUsername]);

  const handleCheckUsername = async (userToTest?: string) => {
    const targetUsername = (userToTest || username).trim();
    if (!targetUsername) {
      setError("Please enter your admin username.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await apiClient.checkUsername(targetUsername);

      if (!res.success) {
        setError(res.error.message || "Failed to check username.");
        return;
      }

      // If this is the initial admin and setup is pending, don't ask for password in the frontend!
      // Directly redirect to setup account page first!
      if (res.data.exists && res.data.needsSetup) {
        router.push(`/setup?username=${encodeURIComponent(targetUsername)}`);
        return;
      }

      if (!res.data.exists) {
        setError("No administrator account found with this username.");
        return;
      }

      // User exists and account is fully set up: prompt for password
      if (res.data.displayName) {
        setDisplayName(res.data.displayName);
      }
      setStep("password");
    } catch {
      setError("Network error. Could not connect to API server.");
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCheckUsername();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiClient.login({
        username: username.trim(),
        password,
      });

      if (!res.success) {
        setError(res.error.message || "Invalid username or password.");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error. Could not connect to API server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-obsidian-border bg-obsidian-surface/95 p-8 shadow-royal backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-royalViolet/20 text-royalViolet-hover">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-warmIvory">
            Admin Portal
          </h1>
          <p className="mt-1 text-xs text-slate-light">
            Sign in to manage Connect Me codes and contacts
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {step === "username" ? (
          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
                Admin Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. harsh0802"
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated py-3 pl-10 pr-4 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-royalViolet py-3.5 text-sm font-semibold text-white shadow-royal transition hover:bg-royalViolet-hover disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="mb-2 flex items-center justify-between rounded-xl border border-obsidian-border bg-obsidian-elevated px-3.5 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-royalViolet/20 text-xs font-bold text-royalViolet-hover">
                  {username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-semibold text-warmIvory">{username}</div>
                  {displayName && <div className="text-[11px] text-slate-light">{displayName}</div>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep("username");
                  setPassword("");
                  setError(null);
                }}
                className="text-xs text-metallicGold hover:underline"
              >
                Change
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate" />
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated py-3 pl-10 pr-4 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-royalViolet py-3.5 text-sm font-semibold text-white shadow-royal transition hover:bg-royalViolet-hover disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 border-t border-obsidian-border pt-4 text-center">
          <Link
            href="/setup"
            className="inline-flex items-center gap-1.5 text-xs text-metallicGold hover:underline"
          >
            <Sparkles className="h-3 w-3" />
            <span>First time deploying? Initialize via /setup</span>
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate">
          <ShieldCheck className="h-3.5 w-3.5 text-metallicGold" />
          <span>Devcon Royal Administration</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-royalViolet border-t-transparent" />
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
