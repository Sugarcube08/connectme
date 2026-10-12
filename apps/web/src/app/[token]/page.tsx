"use client";

import React, { useState, useEffect, use } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Camera,
  X,
  UploadCloud,
  Send,
  Lock,
  Sparkles,
} from "lucide-react";
import { apiClient } from "@/lib/api";

interface PublicPageProps {
  params: Promise<{ token: string }>;
}

export default function PublicContactPage({ params }: PublicPageProps) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<{
    eligible: boolean;
    status: string;
    brandName?: string;
  } | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [discussionNotes, setDiscussionNotes] = useState("");

  // Image states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    async function checkToken() {
      try {
        setLoading(true);
        const res = await apiClient.verifyCode(token);
        if (res.success && res.data) {
          setEligibility({
            eligible: res.data.eligible,
            status: res.data.codeStatus,
            brandName: res.data.brandName,
          });
        } else {
          setEligibility({
            eligible: false,
            status: "INVALID",
          });
        }
      } catch {
        setEligibility({
          eligible: false,
          status: "NETWORK_ERROR",
        });
      } finally {
        setLoading(false);
      }
    }

    checkToken();
  }, [token]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageError("Please upload a JPEG, PNG, or WebP picture.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setImageError("Image must be smaller than 2 MB.");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setImageError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim()) {
      setFormError("Please enter your full name.");
      return;
    }

    if (!phoneNumber.trim()) {
      setFormError("Please enter your phone number.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiClient.redeemCode(
        token,
        {
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          email: email.trim() || undefined,
          organization: organization.trim() || undefined,
          role: role.trim() || undefined,
          profileUrl: profileUrl.trim() || undefined,
          discussionNotes: discussionNotes.trim() || undefined,
        },
        selectedFile || undefined
      );

      if (!res.success) {
        setFormError(res.error?.message || "Submission failed. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setFormError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-royalViolet border-t-transparent" />
          <p className="text-sm font-medium text-slate-light">Verifying access link...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-obsidian-border bg-obsidian-surface/90 p-8 text-center shadow-royal backdrop-blur-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-royalViolet/20 text-royalViolet-hover">
            <CheckCircle2 className="h-9 w-9" />
          </div>

          <h2 className="mb-3 text-2xl font-bold tracking-tight text-warmIvory sm:text-3xl">
            You&apos;re on my radar.
          </h2>

          <p className="mb-6 text-sm leading-relaxed text-warmIvory/85 sm:text-base">
            Thanks for sharing your details. I&apos;ll reach out if there&apos;s an opportunity for us to connect.
          </p>

          <div className="rounded-xl border border-obsidian-border/80 bg-obsidian-elevated/50 p-4">
            <p className="text-xs font-medium text-metallicGold tracking-wide italic">
              &ldquo;Good people. Interesting conversations. Unexpected opportunities.&rdquo;
            </p>
          </div>

          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate">
            <Lock className="h-3.5 w-3.5" />
            <span>Connection secured &bull; Connect Me</span>
          </div>
        </div>
      </div>
    );
  }

  if (eligibility?.status === "CONSUMED") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-obsidian-border bg-obsidian-surface/90 p-8 text-center shadow-lg backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-dark/30 text-metallicGold">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-warmIvory">Code Already Used</h2>
          <p className="mb-6 text-sm text-slate-light leading-relaxed">
            This single-use access code has already been redeemed. If you&apos;ve already shared your details, you&apos;re on my radar.
          </p>
          <div className="text-xs text-slate">Connect Me &bull; Devcon</div>
        </div>
      </div>
    );
  }

  if (!eligibility?.eligible) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-obsidian-border bg-obsidian-surface/90 p-8 text-center shadow-lg backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-dark/40 text-slate-light">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-warmIvory">Link Unavailable</h2>
          <p className="mb-6 text-sm text-slate-light leading-relaxed">
            This invitation link is expired or no longer available.
          </p>
          <div className="text-xs text-slate">Connect Me &bull; Devcon</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-royalViolet/40 bg-royalViolet/10 px-3.5 py-1 text-xs font-semibold text-warmIvory backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-metallicGold" />
            <span>DEVCON PROFESSIONAL CONNECTION</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-warmIvory sm:text-3xl">
            CONNECT <span className="text-royalViolet">ME</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-light italic">
            &ldquo;You share. We connect.&rdquo;
          </p>
        </div>

        {/* Card Form */}
        <div className="rounded-2xl border border-obsidian-border bg-obsidian-surface/95 p-6 shadow-royal sm:p-8 backdrop-blur-xl">
          {formError && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-medium text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warmIvory">
                Full Name <span className="text-royalViolet">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Satoshi Nakamoto"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-3 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-warmIvory">
                Phone Number <span className="text-royalViolet">*</span>
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +1 555-0199 or Telegram/Signal"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-3 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
                Email Address <span className="text-slate font-normal">(optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. satoshi@example.org"
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-3 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
                  Organization <span className="text-slate font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Ethereum Protocol"
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-3 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
                  Role <span className="text-slate font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Core Dev, Founder"
                  className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-3 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
                LinkedIn / GitHub / X Profile <span className="text-slate font-normal">(optional)</span>
              </label>
              <input
                type="url"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-3 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-light">
                What would you like to discuss? <span className="text-slate font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={discussionNotes}
                onChange={(e) => setDiscussionNotes(e.target.value)}
                placeholder="Mention what we chatted about at Devcon or shared ideas..."
                className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-3 text-sm text-warmIvory placeholder-slate transition focus:border-royalViolet focus:outline-none focus:ring-1 focus:ring-royalViolet"
              />
            </div>

            {/* Profile Picture Upload */}
            <div className="rounded-xl border border-deepIndigo/80 bg-deepIndigo/20 p-4">
              <div className="mb-3 flex items-start gap-3">
                <div className="rounded-lg bg-royalViolet/20 p-2 text-royalViolet-hover">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-metallicGold">
                    Profile Picture
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-warmIvory/90">
                    &ldquo;I&apos;m bad at remembering names. Mind sharing a picture? It helps me put a face to the name when we connect later.&rdquo;
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-slate-light italic">
                    Totally optional, of course.
                  </p>
                </div>
              </div>

              {previewUrl ? (
                <div className="mt-3 flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-royalViolet">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Remove Picture</span>
                    </button>
                    <p className="mt-1 text-[11px] text-slate-light">
                      Picture selected ({selectedFile?.name})
                    </p>
                  </div>
                </div>
              ) : (
                <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-obsidian-border bg-obsidian-elevated/40 p-4 transition hover:border-royalViolet/60">
                  <UploadCloud className="mb-1 h-6 w-6 text-slate" />
                  <span className="text-xs font-medium text-warmIvory">Choose photo</span>
                  <span className="text-[10px] text-slate">JPEG, PNG, WebP (up to 2MB)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
              )}

              {imageError && <p className="mt-2 text-xs text-red-400">{imageError}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-royalViolet py-3.5 text-sm font-semibold text-white shadow-royal transition-all duration-200 hover:bg-royalViolet-hover disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Submit Contact Information</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-obsidian-border pt-4 text-center">
            <p className="text-[11px] text-slate leading-relaxed">
              Your details are submitted directly and privately so the owner can follow up with you.
              Never disclosed to third parties or published in any public directory.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
