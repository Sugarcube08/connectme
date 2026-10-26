"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  QrCode,
  Users,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";
import { apiClient } from "@/lib/api";

export default function AdminLayout({
  children,
}: {
  children: any;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // If on login or register page, render without admin navigation frame
  if (pathname === "/admin/login" || pathname === "/admin/register") {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  };

  const navItems = [
    { label: "Overview", href: "/admin", icon: LayoutDashboard },
    { label: "Codes & QR", href: "/admin/codes", icon: QrCode },
    { label: "Contacts", href: "/admin/contacts", icon: Users },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-obsidian">
      {/* Top Navbar */}
      <header className="no-print sticky top-0 z-40 border-b border-obsidian-border bg-obsidian-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-royalViolet/20 text-royalViolet-hover">
                <Sparkles className="h-4 w-4 text-metallicGold" />
              </div>
              <span className="font-extrabold tracking-tight text-warmIvory text-base">
                CONNECT <span className="text-royalViolet">ME</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                      isActive
                        ? "bg-royalViolet text-white shadow-royal"
                        : "text-slate-light hover:bg-obsidian-elevated hover:text-warmIvory"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-obsidian-border px-3 py-1.5 text-xs font-medium text-slate-light transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden border-t border-obsidian-border/50 px-2 py-1.5 overflow-x-auto justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                  isActive
                    ? "bg-royalViolet text-white"
                    : "text-slate-light hover:text-warmIvory"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
