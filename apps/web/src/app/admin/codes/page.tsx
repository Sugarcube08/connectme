"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  QrCode,
  Plus,
  Download,
  Ban,
  Search,
  CheckCircle2,
  Clock,
  X,
  ExternalLink,
  Copy,
  Check,
  Printer,
  Archive,
  Eye,
  Palette,
  RotateCcw,
} from "lucide-react";
import { AccessCodeItem, GeneratedCodeDetail, CodeStatus } from "@connectme/contracts";
import { apiClient } from "@/lib/api";
import { createZipBlob, dataUrlToUint8Array, downloadBlob } from "@/lib/zip";

type CardDesign = {
  brand: string;
  title: string;
  subtitle: string;
  instructions: string;
  footer: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
};

const DESIGN_STORAGE_KEY = "connectme-card-design-v1";
const DEFAULT_CARD_DESIGN: CardDesign = {
  brand: "CONNECT ME",
  title: "Let's connect",
  subtitle: "Scan to share your contact details",
  instructions: "Use your phone camera to scan. No app required.",
  footer: "You share. We connect.",
  accentColor: "#6D28D9",
  backgroundColor: "#FFFFFF",
  textColor: "#111827",
};

export default function AdminCodesPage() {
  const [codes, setCodes] = useState<AccessCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedNonPrintableIds, setSelectedNonPrintableIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Generation controls.
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genCount, setGenCount] = useState(1);
  const [genLabel, setGenLabel] = useState("");
  const [genExpiryDays, setGenExpiryDays] = useState(30);
  const [generating, setGenerating] = useState(false);

  // Plaintext tokens are returned only for creation and explicit owner-authorized
  // print-asset requests. These remain in page memory and are never persisted locally.
  const [generatedResults, setGeneratedResults] = useState<GeneratedCodeDetail[] | null>(null);
  const [printItems, setPrintItems] = useState<GeneratedCodeDetail[]>([]);
  const [previewAsset, setPreviewAsset] = useState<GeneratedCodeDetail | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);

  const [cardDesign, setCardDesign] = useState<CardDesign>(DEFAULT_CARD_DESIGN);
  const [designLoaded, setDesignLoaded] = useState(false);
  const initialPreviewRequested = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DESIGN_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<CardDesign>;
        setCardDesign({ ...DEFAULT_CARD_DESIGN, ...parsed });
      }
    } catch {
      // Ignore unavailable storage or an older invalid template and keep defaults.
    } finally {
      setDesignLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!designLoaded) return;
    try {
      localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(cardDesign));
    } catch {
      // A blocked localStorage should not prevent card design or printing.
    }
  }, [cardDesign, designLoaded]);

  const fetchCodes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.listCodes({
        page,
        limit: 25,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        search: search.trim() || undefined,
      });
      if (res.success && res.data) {
        setCodes(res.data);
        setTotalPages(res.meta?.totalPages || 1);

        // Load the first active, encrypted code into the card preview once. The
        // code is not auto-selected for bulk actions, so this cannot accidentally
        // enable a bulk revoke/print operation.
        if (!initialPreviewRequested.current) {
          initialPreviewRequested.current = true;
          const firstPrintable = res.data.find((code) => code.canPrint && code.status === "ACTIVE");
          if (firstPrintable) {
            void apiClient.getCodePrintAssets([firstPrintable.id]).then((assets) => {
              if (assets.success && assets.data?.codes[0]) {
                setPreviewAsset(assets.data.codes[0]);
              }
            });
          }
        }
      }
    } catch {
      console.error("Failed to fetch access codes");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    void fetchCodes();
  }, [fetchCodes]);

  // Trigger browser printing only after the print-only card sheet has rendered.
  useEffect(() => {
    if (printItems.length === 0) return;
    const timer = window.setTimeout(() => window.print(), 300);
    const handleAfterPrint = () => setPrintItems([]);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printItems]);

  const updateDesign = (key: keyof CardDesign, value: string) => {
    setCardDesign((current) => ({ ...current, [key]: value }));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGenerating(true);
      const expiresAt =
        genExpiryDays > 0
          ? new Date(Date.now() + genExpiryDays * 24 * 3600 * 1000).toISOString()
          : null;
      const res = await apiClient.createCodes({
        count: genCount,
        label: genLabel.trim() || undefined,
        expiresAt,
      });

      if (!res.success) {
        alert(res.error.message || "Failed to generate access codes.");
        return;
      }
      if (!res.data) {
        alert("The API returned no generated codes.");
        return;
      }

      const details: GeneratedCodeDetail[] =
        "codes" in res.data ? res.data.codes : [res.data];
      setShowGenerateModal(false);
      setGeneratedResults(details);
      setSelectedIds(new Set(details.filter((item) => item.canPrint).map((item) => item.id)));
      setPreviewAsset(details[0] || null);
      void fetchCodes();
    } catch {
      alert("Failed to generate access codes.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this code? It will no longer be redeemable.")) return;
    try {
      const res = await apiClient.revokeCode(id);
      if (res.success) {
        setSelectedIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        setSelectedNonPrintableIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        setPreviewAsset((current) => current?.id === id ? null : current);
        void fetchCodes();
      } else {
        alert(res.error?.message || "Failed to revoke code.");
      }
    } catch {
      alert("Network error while revoking code.");
    }
  };

  // Any active code may be selected for bulk revoke. Printing is separately
  // constrained to encrypted-token records because legacy digests are one-way. 
  const selectableCodes = codes.filter((code) => code.status === "ACTIVE");
  const allVisibleSelected =
    selectableCodes.length > 0 && selectableCodes.every((code) => selectedIds.has(code.id));

  const toggleOne = (code: AccessCodeItem, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(code.id);
      else next.delete(code.id);
      return next;
    });
    setSelectedNonPrintableIds((current) => {
      const next = new Set(current);
      if (checked && !code.canPrint) next.add(code.id);
      else next.delete(code.id);
      return next;
    });
  };

  const toggleVisiblePage = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) selectableCodes.forEach((code) => next.delete(code.id));
      else selectableCodes.forEach((code) => next.add(code.id));
      return next;
    });
    setSelectedNonPrintableIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        selectableCodes.forEach((code) => next.delete(code.id));
      } else {
        selectableCodes.forEach((code) => {
          if (code.canPrint) next.delete(code.id);
          else next.add(code.id);
        });
      }
      return next;
    });
  };

  const loadSelectedAssets = async (): Promise<GeneratedCodeDetail[] | null> => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      alert("Select at least one active QR code first.");
      return null;
    }
    if (ids.length > 100) {
      alert("A bulk operation supports up to 100 codes at a time.");
      return null;
    }
    if (selectedNonPrintableIds.size > 0) {
      alert("Your selection includes legacy active codes that cannot be reprinted. Unselect those codes before previewing, downloading, or printing. They can still be revoked in bulk.");
      return null;
    }

    const res = await apiClient.getCodePrintAssets(ids);
    if (!res.success) {
      alert(res.error.message || "Could not load QR assets for printing.");
      void fetchCodes();
      return null;
    }
    if (!res.data) {
      alert("The API returned no QR print assets.");
      void fetchCodes();
      return null;
    }
    return res.data.codes;
  };

  const handlePreviewSelected = async () => {
    try {
      setBulkBusy(true);
      const assets = await loadSelectedAssets();
      if (assets?.length) setPreviewAsset(assets[0]);
    } catch {
      alert("Failed to preview selected QR codes.");
    } finally {
      setBulkBusy(false);
    }
  };

  const handlePrintSelected = async () => {
    try {
      setBulkBusy(true);
      const assets = await loadSelectedAssets();
      if (assets?.length) {
        setPreviewAsset(assets[0]);
        setPrintItems(assets);
      }
    } catch {
      alert("Failed to prepare selected cards for printing.");
    } finally {
      setBulkBusy(false);
    }
  };

  const makeZip = (items: GeneratedCodeDetail[], filePrefix: string) => {
    if (items.length === 0) return;
    const files = items.map((item, index) => {
      const safeLabel = (item.label || "code")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      return {
        name: `${filePrefix}-${String(index + 1).padStart(2, "0")}-${safeLabel || "code"}.png`,
        data: dataUrlToUint8Array(item.qrDataUrl),
      };
    });
    downloadBlob(createZipBlob(files), `connectme-${filePrefix}-${items.length}-qrs.zip`);
  };

  const handleDownloadSelected = async () => {
    try {
      setZipping(true);
      const assets = await loadSelectedAssets();
      if (assets?.length) makeZip(assets, "selected-qr");
    } catch {
      alert("Failed to create ZIP archive.");
    } finally {
      setZipping(false);
    }
  };

  const handleBulkRevoke = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      alert("Select at least one code to revoke.");
      return;
    }
    if (!confirm(`Revoke ${ids.length} selected code(s)? This cannot be undone.`)) return;

    try {
      setBulkBusy(true);
      const res = await apiClient.revokeCodes(ids);
      if (!res.success) {
        alert(res.error?.message || "Bulk revoke failed.");
        return;
      }
      setSelectedIds(new Set());
      setSelectedNonPrintableIds(new Set());
      if (previewAsset && ids.includes(previewAsset.id)) setPreviewAsset(null);
      alert(`Revoked ${res.data?.revokedCount ?? 0} code(s).`);
      void fetchCodes();
    } catch {
      alert("Network error while revoking selected codes.");
    } finally {
      setBulkBusy(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(id);
      window.setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      alert("Clipboard access was denied by the browser.");
    }
  };

  const downloadQr = (dataUrl: string, label: string | null) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `connectme-qr-${(label || "code").toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}.png`;
    a.click();
  };

  const downloadGeneratedZip = () => {
    if (!generatedResults?.length) return;
    try {
      setZipping(true);
      makeZip(generatedResults, "generated-qr");
    } catch {
      alert("Failed to create ZIP archive.");
    } finally {
      setZipping(false);
    }
  };

  const statusBadge = (status: CodeStatus) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
            <Clock className="h-3 w-3" /> ACTIVE
          </span>
        );
      case "CONSUMED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-royalViolet/40 bg-royalViolet/15 px-2.5 py-0.5 text-[10px] font-bold text-warmIvory">
            <CheckCircle2 className="h-3 w-3 text-royalViolet-hover" /> CONSUMED
          </span>
        );
      case "REVOKED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold text-red-400">
            <Ban className="h-3 w-3" /> REVOKED
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-border bg-slate/10 px-2.5 py-0.5 text-[10px] font-bold text-slate-light">
            EXPIRED
          </span>
        );
    }
  };

  const previewCode = previewAsset || generatedResults?.[0] || null;

  return (
    <>
      <div className="no-print space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-warmIvory sm:text-3xl">
              QR Codes & Card Studio
            </h1>
            <p className="mt-1 text-xs text-slate-light">
              Select multiple active codes, export QR assets, revoke in bulk, and print cards using your own copy and colors.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-royalViolet px-4 py-2.5 text-xs font-semibold text-white shadow-royal transition hover:bg-royalViolet-hover"
            >
              <Plus className="h-4 w-4" /> Generate Codes
            </button>
            <a
              href="/api/v1/admin/codes/export"
              download
              className="inline-flex items-center gap-1.5 rounded-xl border border-obsidian-border bg-obsidian-surface px-4 py-2.5 text-xs font-semibold text-warmIvory transition hover:bg-obsidian-elevated"
            >
              <Download className="h-4 w-4 text-metallicGold" /> Export CSV
            </a>
          </div>
        </div>

        {/* Live, editable card template. The encoded token itself remains immutable. */}
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(330px,0.9fr)]">
          <div className="rounded-2xl border border-obsidian-border bg-obsidian-surface/90 p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-warmIvory">
                  <Palette className="h-4 w-4 text-metallicGold" /> Card design
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-slate">
                  Edit the printed card template. The QR token/URL is not changed by design edits.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCardDesign(DEFAULT_CARD_DESIGN)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-obsidian-border px-2.5 py-1.5 text-[10px] text-slate-light hover:bg-obsidian-elevated"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] font-semibold text-slate-light">
                Brand / organization
                <input value={cardDesign.brand} onChange={(e) => updateDesign("brand", e.target.value)} maxLength={48}
                  className="mt-1 w-full rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs text-warmIvory focus:border-royalViolet focus:outline-none" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-light">
                Card headline
                <input value={cardDesign.title} onChange={(e) => updateDesign("title", e.target.value)} maxLength={64}
                  className="mt-1 w-full rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs text-warmIvory focus:border-royalViolet focus:outline-none" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-light sm:col-span-2">
                Subtitle
                <input value={cardDesign.subtitle} onChange={(e) => updateDesign("subtitle", e.target.value)} maxLength={100}
                  className="mt-1 w-full rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs text-warmIvory focus:border-royalViolet focus:outline-none" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-light sm:col-span-2">
                Scan instructions
                <textarea value={cardDesign.instructions} onChange={(e) => updateDesign("instructions", e.target.value)} maxLength={180} rows={2}
                  className="mt-1 w-full resize-y rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs text-warmIvory focus:border-royalViolet focus:outline-none" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-light sm:col-span-2">
                Footer
                <input value={cardDesign.footer} onChange={(e) => updateDesign("footer", e.target.value)} maxLength={80}
                  className="mt-1 w-full rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs text-warmIvory focus:border-royalViolet focus:outline-none" />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-[11px] font-semibold text-slate-light">
                Accent color
                <input aria-label="Accent color" type="color" value={cardDesign.accentColor} onChange={(e) => updateDesign("accentColor", e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent" />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-[11px] font-semibold text-slate-light">
                Card background
                <input aria-label="Card background color" type="color" value={cardDesign.backgroundColor} onChange={(e) => updateDesign("backgroundColor", e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent" />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-[11px] font-semibold text-slate-light sm:col-span-2">
                Text color
                <input aria-label="Text color" type="color" value={cardDesign.textColor} onChange={(e) => updateDesign("textColor", e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent" />
              </label>
            </div>
            <p className="mt-3 text-[10px] text-slate">
              Design preferences are saved in this browser. Keep QR artwork dark on a light background for reliable scanning.
            </p>
          </div>

          <div className="rounded-2xl border border-obsidian-border bg-obsidian-surface/90 p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-warmIvory">
                  <Eye className="h-4 w-4 text-metallicGold" /> Live card preview
                </h2>
                <p className="mt-1 text-[11px] text-slate">Current template: {previewCode?.label || "Default card"}</p>
              </div>
              <button type="button" onClick={handlePreviewSelected} disabled={bulkBusy || selectedIds.size === 0}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-royalViolet/50 px-3 py-2 text-[10px] font-semibold text-warmIvory hover:bg-royalViolet/10 disabled:opacity-40">
                <Eye className="h-3.5 w-3.5" /> Preview selected
              </button>
            </div>

            <div className="mx-auto w-full max-w-[480px] rounded-xl border-2 p-4 shadow-sm" style={{ backgroundColor: cardDesign.backgroundColor, borderColor: cardDesign.accentColor, color: cardDesign.textColor }}>
              <div className="flex items-center justify-between gap-3 border-b pb-2" style={{ borderColor: `${cardDesign.accentColor}55` }}>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-extrabold tracking-[0.16em]" style={{ color: cardDesign.accentColor }}>{cardDesign.brand || "YOUR BRAND"}</p>
                  <p className="truncate text-sm font-bold">{previewCode?.label || "Your QR card"}</p>
                </div>
                <span className="shrink-0 rounded-full border px-2 py-1 text-[8px] font-bold tracking-wider" style={{ color: cardDesign.accentColor, borderColor: `${cardDesign.accentColor}66` }}>SINGLE-USE</span>
              </div>
              <div className="flex items-center gap-4 py-4">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border bg-white p-2" style={{ borderColor: `${cardDesign.accentColor}55` }}>
                  {previewCode ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewCode.qrDataUrl} alt="Preview QR code" className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center border-2 border-dashed border-slate-300 text-center text-slate-500">
                      <QrCode className="h-8 w-8" />
                      <span className="mt-1 text-[8px]">Select a code</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-lg font-extrabold leading-tight">{cardDesign.title || "Let's connect"}</p>
                  <p className="text-xs font-semibold">{cardDesign.subtitle}</p>
                  <p className="text-[10px] leading-relaxed opacity-80">{cardDesign.instructions}</p>
                  {previewCode && <p className="break-all font-mono text-[8px] opacity-70">{previewCode.url}</p>}
                </div>
              </div>
              <div className="border-t pt-2 text-[9px] font-semibold" style={{ borderColor: `${cardDesign.accentColor}55`, color: cardDesign.accentColor }}>
                {cardDesign.footer}
              </div>
            </div>
            <p className="mt-3 text-[10px] text-slate">
              {previewCode ? "Preview is showing the selected code's real QR and URL." : "Select codes in the table and choose Preview selected to show a real QR here."}
            </p>
          </div>
        </section>

        {/* Search and filter. */}
        <div className="flex flex-col gap-3 rounded-xl border border-obsidian-border bg-obsidian-surface/60 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate" />
            <input type="text" placeholder="Search by code label..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-obsidian-border bg-obsidian-elevated py-2 pl-9 pr-3 text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate">Status:</span>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs text-warmIvory focus:border-royalViolet focus:outline-none">
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="CONSUMED">Consumed</option>
              <option value="REVOKED">Revoked</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        {/* Multi-select and bulk actions. Selection carries across pages, but APIs re-check owner and status. */}
        <div className="flex flex-col gap-3 rounded-xl border border-royalViolet/30 bg-obsidian-surface/90 p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-warmIvory">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisiblePage} disabled={selectableCodes.length === 0}
                className="h-4 w-4 accent-violet-600" />
              Select active codes on this page
            </label>
            <span className="rounded-full border border-royalViolet/40 bg-royalViolet/10 px-2.5 py-1 text-[10px] font-bold text-warmIvory">
              {selectedIds.size} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handlePreviewSelected} disabled={bulkBusy || selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-obsidian-border px-3 py-2 text-xs font-semibold text-warmIvory hover:bg-obsidian-elevated disabled:opacity-40">
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
            <button onClick={handleDownloadSelected} disabled={bulkBusy || zipping || selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-obsidian-border px-3 py-2 text-xs font-semibold text-warmIvory hover:bg-obsidian-elevated disabled:opacity-40">
              <Archive className="h-3.5 w-3.5" /> {zipping ? "Building ZIP..." : "Download ZIP"}
            </button>
            <button onClick={handlePrintSelected} disabled={bulkBusy || selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-royalViolet px-3 py-2 text-xs font-semibold text-white hover:bg-royalViolet-hover disabled:opacity-40">
              <Printer className="h-3.5 w-3.5" /> Print selected
            </button>
            <button onClick={handleBulkRevoke} disabled={bulkBusy || selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-40">
              <Ban className="h-3.5 w-3.5" /> Revoke selected
            </button>
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-slate">
          Security note: legacy codes created before encrypted-token storage remain redeemable and can be bulk-revoked, but their original URLs cannot be recovered for reprinting. Unselect legacy codes before printing or downloading QR assets; generate replacements for new cards.
        </p>

        {/* Codes table. */}
        <div className="overflow-hidden rounded-2xl border border-obsidian-border bg-obsidian-surface/90 shadow-sm">
          {loading ? (
            <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-royalViolet border-t-transparent" /></div>
          ) : codes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-obsidian-border bg-obsidian-elevated/40 text-[11px] uppercase tracking-wider text-slate">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Select</th>
                    <th className="px-4 py-3 font-semibold">Label / ID</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Redemption / Contact</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-4 py-3 font-semibold">Expires</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-border/50 text-warmIvory/90">
                  {codes.map((code) => {
                    const canSelect = code.canPrint && code.status === "ACTIVE";
                    return (
                      <tr key={code.id} className="transition hover:bg-obsidian-elevated/30">
                        <td className="px-4 py-3.5">
                          <input type="checkbox" checked={selectedIds.has(code.id)} disabled={code.status !== "ACTIVE"}
                            onChange={(e) => toggleOne(code, e.target.checked)}
                            aria-label={`Select ${code.label || "access code"}`}
                            title={canSelect ? "Select for bulk operations" : "Active legacy code: can be bulk-revoked, but not reprinted"}
                            className="h-4 w-4 accent-violet-600 disabled:opacity-30" />
                        </td>
                        <td className="px-4 py-3.5 font-medium">
                          <div className="font-semibold text-warmIvory">{code.label || "Untitled Code"}</div>
                          <div className="font-mono text-[10px] text-slate">{code.id.slice(0, 8)}...</div>
                        </td>
                        <td className="px-4 py-3.5">{statusBadge(code.status)}</td>
                        <td className="px-4 py-3.5">
                          {code.hasSubmission ? <span className="font-semibold text-warmIvory">{code.contactName || "Contact submitted"}</span> : <span className="text-slate">Unredeemed</span>}
                        </td>
                        <td className="px-4 py-3.5 text-slate">{new Date(code.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3.5 text-slate">{code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : "Never"}</td>
                        <td className="px-4 py-3.5 text-right">
                          {code.status === "ACTIVE" && (
                            <button onClick={() => handleRevoke(code.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20">
                              <Ban className="h-3 w-3" /> Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center">
              <QrCode className="mx-auto mb-3 h-8 w-8 text-slate" />
              <p className="text-sm font-medium text-warmIvory">No access codes found</p>
              <p className="mt-1 text-xs text-slate">Generate a single code or a batch of QR assets to distribute.</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-obsidian-border px-4 py-3 text-xs text-slate">
              <div>Page {page} of {totalPages}</div>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                  className="rounded-lg border border-obsidian-border px-3 py-1 text-warmIvory disabled:opacity-40">Previous</button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                  className="rounded-lg border border-obsidian-border px-3 py-1 text-warmIvory disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>

        {/* Generation modal. */}
        {showGenerateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-obsidian-border bg-obsidian-surface p-6 shadow-royal">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-warmIvory">Generate access codes</h3>
                <button onClick={() => setShowGenerateModal(false)} className="rounded-lg p-1 text-slate hover:text-warmIvory"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-light">Batch count (1 to 100)</label>
                  <input type="number" min={1} max={100} value={genCount} onChange={(e) => setGenCount(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                    className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-light">Batch label (optional)</label>
                  <input type="text" maxLength={100} placeholder="e.g. Conference Day 1" value={genLabel} onChange={(e) => setGenLabel(e.target.value)}
                    className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-light">Expiry duration (days, 0 = never)</label>
                  <input type="number" min={0} max={365} value={genExpiryDays} onChange={(e) => setGenExpiryDays(Math.min(365, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                    className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none" />
                </div>
                <div className="flex justify-end gap-2.5 pt-2">
                  <button type="button" onClick={() => setShowGenerateModal(false)}
                    className="rounded-xl border border-obsidian-border px-4 py-2.5 text-xs font-semibold text-slate-light hover:bg-obsidian-elevated">Cancel</button>
                  <button type="submit" disabled={generating}
                    className="rounded-xl bg-royalViolet px-5 py-2.5 text-xs font-semibold text-white shadow-royal hover:bg-royalViolet-hover disabled:opacity-50">
                    {generating ? "Generating..." : "Generate codes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Generated QR preview modal. */}
        {generatedResults && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md">
            <div className="my-8 w-full max-w-3xl rounded-2xl border border-obsidian-border bg-obsidian-surface p-6 shadow-royal">
              <div className="mb-4 flex flex-col gap-3 border-b border-obsidian-border pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-warmIvory">Generated {generatedResults.length} code{generatedResults.length === 1 ? "" : "s"}</h3>
                  <p className="text-xs text-metallicGold">Tokens are HMAC-indexed and stored encrypted. Only active codes can be reprinted.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {generatedResults.length > 1 && <button type="button" disabled={zipping} onClick={downloadGeneratedZip}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-royalViolet bg-royalViolet px-3 py-1.5 text-xs font-semibold text-white shadow-royal hover:bg-royalViolet-hover disabled:opacity-50">
                    <Archive className="h-3.5 w-3.5" /> {zipping ? "Creating ZIP..." : "Download ZIP"}
                  </button>}
                  <button type="button" onClick={() => setPrintItems(generatedResults)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-metallicGold/40 bg-metallicGold/10 px-3 py-1.5 text-xs font-semibold text-metallicGold hover:bg-metallicGold/20">
                    <Printer className="h-3.5 w-3.5" /> Print cards
                  </button>
                  <button onClick={() => setGeneratedResults(null)} className="rounded-lg p-1 text-slate hover:text-warmIvory"><X className="h-5 w-5" /></button>
                </div>
              </div>

              <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                {generatedResults.map((item) => (
                  <div key={item.id} className="flex flex-col items-center gap-4 rounded-xl border border-obsidian-border bg-obsidian-elevated/50 p-4 sm:flex-row">
                    <div className="shrink-0 rounded-lg bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.qrDataUrl} alt="QR code" className="h-28 w-28 object-contain" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                      <div className="text-sm font-semibold text-warmIvory">{item.label || "Access code"}</div>
                      <div className="break-all font-mono text-[11px] text-slate-light">{item.url}</div>
                      <div className="flex flex-wrap justify-center gap-2 pt-1 sm:justify-start">
                        <button onClick={() => copyToClipboard(item.url, item.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-obsidian-border bg-obsidian-surface px-2.5 py-1.5 text-xs text-warmIvory hover:bg-obsidian-elevated">
                          {copiedToken === item.id ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copied</> : <><Copy className="h-3.5 w-3.5 text-slate" /> Copy URL</>}
                        </button>
                        <button onClick={() => downloadQr(item.qrDataUrl, item.label)}
                          className="inline-flex items-center gap-1 rounded-lg bg-royalViolet px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-royalViolet-hover">
                          <Download className="h-3.5 w-3.5" /> Download PNG
                        </button>
                        <a href={item.url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-obsidian-border bg-obsidian-surface px-2.5 py-1.5 text-xs text-slate-light hover:text-warmIvory">
                          <ExternalLink className="h-3.5 w-3.5" /> Open form
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-obsidian-border pt-4">
                <button onClick={() => setGeneratedResults(null)} className="rounded-xl bg-obsidian-elevated px-5 py-2 text-xs font-semibold text-warmIvory hover:bg-obsidian-border">Close</button>
                <button onClick={() => setPrintItems(generatedResults)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-royalViolet px-4 py-2 text-xs font-semibold text-white hover:bg-royalViolet-hover">
                  <Printer className="h-3.5 w-3.5" /> Print with current design
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* This independent sheet is exposed by print CSS only. */}
      {printItems.length > 0 && (
        <div className="print-cards-container">
          {printItems.map((item) => (
            <article key={item.id} className="printable-visiting-card" style={{ backgroundColor: cardDesign.backgroundColor, color: cardDesign.textColor, borderColor: cardDesign.accentColor }}>
              <header className="print-card-header" style={{ borderColor: `${cardDesign.accentColor}66` }}>
                <div className="print-card-brand">
                  <strong style={{ color: cardDesign.accentColor }}>{cardDesign.brand || "YOUR BRAND"}</strong>
                  <span>{item.label || "Access code"}</span>
                </div>
                <span className="print-card-pass" style={{ color: cardDesign.accentColor, borderColor: `${cardDesign.accentColor}66` }}>SINGLE-USE</span>
              </header>
              <div className="print-card-body">
                <div className="print-qr-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.qrDataUrl} alt="QR code" />
                </div>
                <div className="print-card-copy">
                  <strong>{cardDesign.title || "Let's connect"}</strong>
                  <span>{cardDesign.subtitle}</span>
                  <p>{cardDesign.instructions}</p>
                  <small>{item.url}</small>
                </div>
              </div>
              <footer className="print-card-footer" style={{ color: cardDesign.accentColor, borderColor: `${cardDesign.accentColor}66` }}>{cardDesign.footer}</footer>
            </article>
          ))}
        </div>
      )}

      <style>{`
        .print-cards-container { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden !important; }
          .no-print { display: none !important; }
          .print-cards-container,
          .print-cards-container * { visibility: visible !important; }
          .print-cards-container {
            display: grid !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            grid-template-columns: repeat(2, 90mm);
            gap: 4mm;
            padding: 0 !important;
            margin: 0 !important;
          }
          .printable-visiting-card {
            display: flex !important;
            flex-direction: column !important;
            box-sizing: border-box !important;
            width: 90mm !important;
            height: 55mm !important;
            padding: 3mm !important;
            overflow: hidden !important;
            border: 0.35mm solid !important;
            border-radius: 2mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-card-header { display:flex; align-items:flex-start; justify-content:space-between; gap:2mm; border-bottom:0.25mm solid; padding-bottom:1.4mm; }
          .print-card-brand { display:flex; flex-direction:column; min-width:0; gap:0.6mm; }
          .print-card-brand strong { font-size:7pt; letter-spacing:1.1pt; overflow-wrap:anywhere; }
          .print-card-brand span { font-size:6.5pt; font-weight:700; overflow-wrap:anywhere; }
          .print-card-pass { border:0.25mm solid; border-radius:2mm; padding:0.5mm 1mm; white-space:nowrap; font-size:5pt; font-weight:800; letter-spacing:0.6pt; }
          .print-card-body { display:flex; align-items:center; gap:2.5mm; flex:1; min-height:0; padding:1.5mm 0; }
          .print-qr-frame { display:flex; align-items:center; justify-content:center; width:27mm; height:27mm; flex:0 0 27mm; padding:1mm; background:#fff; border:0.25mm solid #d1d5db; border-radius:1mm; }
          .print-qr-frame img { width:100%; height:100%; object-fit:contain; }
          .print-card-copy { display:flex; flex:1; min-width:0; flex-direction:column; gap:0.7mm; }
          .print-card-copy strong { font-size:9pt; line-height:1.1; overflow-wrap:anywhere; }
          .print-card-copy span { font-size:6.5pt; font-weight:700; line-height:1.2; overflow-wrap:anywhere; }
          .print-card-copy p { margin:0; font-size:6pt; line-height:1.25; overflow-wrap:anywhere; }
          .print-card-copy small { font-family:monospace; font-size:4.3pt; line-height:1.15; overflow-wrap:anywhere; word-break:break-all; }
          .print-card-footer { border-top:0.25mm solid; padding-top:1mm; font-size:5.5pt; font-weight:700; overflow-wrap:anywhere; }
        }
      `}</style>
    </>
  );
}
