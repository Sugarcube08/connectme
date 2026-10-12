import Link from "next/link";
import { Sparkles, ShieldCheck, QrCode, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mx-auto max-w-2xl">
        {/* Subtle royal badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-royalViolet/40 bg-royalViolet/10 px-4 py-1.5 text-xs font-medium text-warmIvory tracking-wide backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-metallicGold" />
          <span>DEVCON PROFESSIONAL NETWORKING</span>
        </div>

        {/* Title & Tagline */}
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-warmIvory">
          CONNECT <span className="text-royalViolet">ME</span>
        </h1>
        <p className="mb-8 text-xl font-medium text-warmIvory/80 italic sm:text-2xl">
          &ldquo;You share. We connect.&rdquo;
        </p>

        <p className="mb-10 text-base leading-relaxed text-slate-light sm:text-lg">
          A lightweight, private, single-use QR-based networking platform.
          Scan a card, share your details securely, and keep meaningful conference
          conversations alive.
        </p>

        {/* Feature Highlights */}
        <div className="mb-12 grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
          <div className="rounded-xl border border-obsidian-border bg-obsidian-surface/60 p-5 backdrop-blur-sm">
            <div className="mb-3 inline-flex rounded-lg bg-royalViolet/20 p-2 text-royalViolet-hover">
              <QrCode className="h-5 w-5" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-warmIvory">Single-Use QR Cards</h3>
            <p className="text-xs text-slate-light leading-relaxed">
              Every card has a unique 128-bit cryptographic token that burns upon submission.
            </p>
          </div>

          <div className="rounded-xl border border-obsidian-border bg-obsidian-surface/60 p-5 backdrop-blur-sm">
            <div className="mb-3 inline-flex rounded-lg bg-metallicGold/20 p-2 text-metallicGold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-warmIvory">Privacy First</h3>
            <p className="text-xs text-slate-light leading-relaxed">
              No tracking, no public directory, and no uninvited contact disclosure.
            </p>
          </div>
        </div>

        {/* Admin Navigation */}
        <div className="flex justify-center">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-xl bg-royalViolet px-6 py-3 text-sm font-semibold text-white shadow-royal transition-all duration-200 hover:bg-royalViolet-hover hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Open Admin Dashboard</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Footer note */}
        <p className="mt-16 text-xs text-slate">
          Built for Devcon &bull; Single-use token architecture &bull; Connect Me
        </p>
      </div>
    </main>
  );
}
