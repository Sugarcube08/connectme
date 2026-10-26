"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, ArrowRight, AlertCircle, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { apiClient } from "@/lib/api";

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialUsername = searchParams.get("username") || searchParams.get("email") || "";

  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError("Please enter your username or email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const res = await apiClient.login({
        username: cleanUsername,
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
      <div className="w-full max-w-md rounded-2xl border border-obsidian-border bg-obsidian-surface p-8 shadow-2xl backdrop-blur-xl">
        {/* Brand Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-royalViolet/20 text-royalViolet-hover">
            <Sparkles className="h-6 w-6 text-metallicGold" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-warmIvory sm:text-3xl">
            CONNECT <span className="text-royalViolet">ME</span>
          </h1>
          <p className="mt-1 text-xs text-slate-light">
            Sign in to manage your connection cards and attendee leads
          </p>
        </div>

        {/* Tab Switcher: Sign In | Sign Up */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-obsidian-border bg-obsidian-elevated p-1">
          <button
            type="button"
            className="rounded-lg bg-royalViolet py-2 text-xs font-bold text-white shadow-royal"
          >
            Sign In
          </button>
          <Link
            href="/admin/register"
            className="rounded-lg py-2 text-center text-xs font-semibold text-slate-light transition hover:text-warmIvory"
          >
            Create Account
          </Link>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
              Username or Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate" />
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or harsh@example.com"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated py-3 pl-10 pr-4 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
              />
            </div>
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

        <div className="mt-6 border-t border-obsidian-border pt-4 text-center">
          <p className="text-xs text-slate-light">
            New to Connect Me?{" "}
            <Link
              href="/admin/register"
              className="font-bold text-metallicGold hover:underline"
            >
              Create an account now →
            </Link>
          </p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate">
          <ShieldCheck className="h-3.5 w-3.5 text-metallicGold" />
          <span>Connect Me Administration</span>
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
