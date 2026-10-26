"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  KeyRound,
  RotateCw,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
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

  // OTP Verification state (driven purely by backend response)
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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

    if (otpStep && (!otp.trim() || otp.trim().length < 4)) {
      setError("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    setLoading(true);

    try {
      const res = await apiClient.register({
        name: cleanName,
        email: cleanEmail,
        number: cleanNumber,
        password,
        ...(otpStep ? { otp: otp.trim() } : {}),
      });

      if (!res.success) {
        setError(res.error.message || "Registration failed. Please check your details.");
        return;
      }

      // If backend indicates OTP verification is active and required
      if (res.data.requiresOtp) {
        setOtpStep(true);
        setOtpNotice(res.data.message || `A verification code has been dispatched to ${cleanEmail}.`);
        setResendCooldown(30);
        return;
      }

      // Registration completed successfully
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error. Could not connect to API server.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return;
    setError(null);
    setResending(true);
    try {
      const res = await apiClient.resendOtp(email.trim().toLowerCase());
      if (res.success) {
        setOtpNotice(res.data.message || "A fresh verification code has been sent.");
        setResendCooldown(30);
      } else {
        setError(res.error.message || "Failed to resend code.");
      }
    } catch {
      setError("Network error while requesting verification code.");
    } finally {
      setResending(false);
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
            {otpStep
              ? "Verify your email to activate your account"
              : "Create an administrator account to start collecting leads and generating single-use codes"}
          </p>
        </div>

        {!otpStep && (
          /* Tab Switcher: Sign In | Sign Up */
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
        )}

        {otpNotice && otpStep && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-royalViolet/30 bg-royalViolet/10 p-3.5 text-xs text-purple-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-metallicGold" />
            <p className="leading-relaxed">{otpNotice}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {otpStep ? (
          /* OTP Verification View */
          <form onSubmit={handleRegisterSubmit} className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-light">
                  6-Digit Verification Code
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setOtpStep(false);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-light hover:text-warmIvory"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Edit Details</span>
                </button>
              </div>

              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate" />
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated py-3 pl-10 pr-4 text-center font-mono text-2xl font-bold tracking-[8px] text-metallicGold placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
                />
              </div>
              <p className="mt-2 text-[11px] text-slate">
                Sent to <strong className="text-slate-light">{email.trim()}</strong>. Code is valid for 10 minutes.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-royalViolet py-3.5 text-sm font-semibold text-white shadow-royal transition hover:bg-royalViolet-hover disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Verify &amp; Activate Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending || resendCooldown > 0}
                className="inline-flex items-center gap-1.5 text-xs text-metallicGold hover:underline disabled:opacity-50 disabled:no-underline"
              >
                <RotateCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
                <span>
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Resend verification code"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOtpStep(false);
                  setError(null);
                }}
                className="text-xs text-slate hover:text-slate-light"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          /* Normal Registration Form */
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
        )}

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
