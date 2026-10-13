"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles, ShieldCheck, QrCode, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api";

export default function HomePage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let active = true;
    apiClient.getMe()
      .then((response) => {
        if (active) setAuthenticated(response.success);
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      })
      .finally(() => {
        if (active) setCheckingAuth(false);
      });
    return () => { active = false; };
  }, []);

  const destination = authenticated ? "/admin" : "/admin/login";
  const actionText = checkingAuth
    ? "Checking Session…"
    : authenticated
      ? "Open Admin Dashboard"
      : "Login Now";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-royalViolet/40 bg-royalViolet/10 px-4 py-1.5 text-xs font-medium tracking-wide text-warmIvory backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-metallicGold" />
          <span>DEVCON PROFESSIONAL NETWORKING</span>
        </div>

        <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-warmIvory sm:text-5xl md:text-6xl">
          CONNECT <span className="text-royalViolet">ME</span>
        </h1>
        <p className="mb-8 text-xl font-medium italic text-warmIvory/80 sm:text-2xl">
          &ldquo;You share. We connect.&rdquo;
        </p>
        <p className="mb-10 text-base leading-relaxed text-slate-light sm:text-lg">
          A lightweight, private, single-use QR-based networking platform.
          Scan a card, share your details securely, and keep meaningful conference
          conversations alive.
        </p>

        <div className="mb-12 grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
          <div className="rounded-xl border border-obsidian-border bg-obsidian-surface/60 p-5 backdrop-blur-sm">
            <div className="mb-3 inline-flex rounded-lg bg-royalViolet/20 p-2 text-royalViolet-hover">
              <QrCode className="h-5 w-5" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-warmIvory">Single-Use QR Cards</h3>
            <p className="text-xs leading-relaxed text-slate-light">
              Every card uses a unique 256-bit random token. It can be redeemed once, and only its creator can view the resulting contact.
            </p>
          </div>

          <div className="rounded-xl border border-obsidian-border bg-obsidian-surface/60 p-5 backdrop-blur-sm">
            <div className="mb-3 inline-flex rounded-lg bg-metallicGold/20 p-2 text-metallicGold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-warmIvory">Privacy First</h3>
            <p className="text-xs leading-relaxed text-slate-light">
              One-way keyed token digests, private owner-scoped contact records, and no public contact directory.
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <Link
            href={destination}
            aria-busy={checkingAuth}
            className="inline-flex items-center gap-2 rounded-xl bg-royalViolet px-6 py-3 text-sm font-semibold text-white shadow-royal transition-all duration-200 hover:scale-[1.02] hover:bg-royalViolet-hover active:scale-[0.98]"
          >
            <span>{actionText}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="mt-16 text-xs text-slate">
          Built for Devcon &bull; Single-use token architecture &bull; Connect Me
        </p>
      </div>
    </main>
  );
}
