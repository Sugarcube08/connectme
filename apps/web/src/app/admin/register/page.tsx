"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Mail, Phone, Lock, ArrowRight, AlertCircle, ShieldCheck, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api";

export default function AdminRegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [number, setNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanNumber = number.trim();

    if (!cleanName) {
      setError("Please enter your full name.");
      return;
    }
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!cleanNumber || cleanNumber.length < 5) {
      setError("Please enter a valid phone number (at least 5 digits).");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must contain at least one uppercase letter and one number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await apiClient.register({
        name: cleanName,
        email: cleanEmail,
        number: cleanNumber,
        password,
      });

      if (!res.success) {
        setError(res.error.message || "Registration failed. Please check your details.");
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
            Create an administrator account to start collecting leads and generating single-use codes
          </p>
        </div>

        {/* Tab Switcher: Sign In | Sign Up */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-obsidian-border bg-obsidian-elevated p-1">
          <Link
            href="/admin/login"
            className="rounded-lg py-2 text-center text-xs font-semibold text-slate-light transition hover:text-warmIvory"
          >
            Sign In
          </Link>
          <button
            type="button"
            className="rounded-lg bg-royalViolet py-2 text-xs font-bold text-white shadow-royal"
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
              Your Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate" />
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Harsh Raikwar"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated py-3 pl-10 pr-4 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. harsh@example.com"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated py-3 pl-10 pr-4 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3.5 h-4 w-4 text-slate" />
              <input
                type="tel"
                required
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="e.g. +91 62603 29127"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated py-3 pl-10 pr-4 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
              />
            </div>
          </div>

          {/* Password */}
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
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated py-3 pl-10 pr-4 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
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
                <span>Create Administrator Account</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-obsidian-border pt-4 text-center">
          <p className="text-xs text-slate-light">
            Already have an account?{" "}
            <Link
              href="/admin/login"
              className="font-bold text-metallicGold hover:underline"
            >
              Sign in here →
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
