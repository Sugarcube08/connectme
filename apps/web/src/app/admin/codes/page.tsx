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
  Archive,
  Eye,
  Palette,
  RotateCcw,
  Code2,
  ImageDown,
} from "lucide-react";
import { AccessCodeItem, GeneratedCodeDetail, CodeStatus } from "@connectme/contracts";
import { apiClient } from "@/lib/api";
import { createZipBlob, downloadBlob } from "@/lib/zip";
import {
  CardDesign,
  DEFAULT_CARD_DESIGN,
  VisitingCard,
} from "@/components/visiting-card";

const DESIGN_STORAGE_KEY = "connectme-card-design-v2";

function safeFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "card";
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

async function svgToPngBlob(svgElement: SVGSVGElement): Promise<Blob> {
  const markup = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not render the card SVG as an image."));
    });
    image.src = objectUrl;
    await loaded;

    const canvas = document.createElement("canvas");
    // Export at 2x the card's native vector dimensions for crisp, high-resolution design exports.
    canvas.width = 2400;
    canvas.height = 1440;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The browser could not encode this card as PNG."));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

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

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genCount, setGenCount] = useState(1);
  const [genLabel, setGenLabel] = useState("");
  const [genExpiryDays, setGenExpiryDays] = useState(30);
  const [generating, setGenerating] = useState(false);

  const [generatedResults, setGeneratedResults] = useState<GeneratedCodeDetail[] | null>(null);
  const [previewAsset, setPreviewAsset] = useState<GeneratedCodeDetail | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [exportingCards, setExportingCards] = useState(false);
  const [cardDesign, setCardDesign] = useState<CardDesign>(DEFAULT_CARD_DESIGN);
  const [designLoaded, setDesignLoaded] = useState(false);
  const [editorTab, setEditorTab] = useState<"visual" | "source">("visual");
  const [componentSource, setComponentSource] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [exportItems, setExportItems] = useState<GeneratedCodeDetail[]>([]);
  const exportRefs = useRef(new Map<string, SVGSVGElement>());
  const initialPreviewRequested = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DESIGN_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<CardDesign>;
        setCardDesign({ ...DEFAULT_CARD_DESIGN, ...parsed });
      }
    } catch {
      // Invalid or unavailable local storage should not block the card editor.
    } finally {
      setDesignLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!designLoaded) return;
    try {
      localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(cardDesign));
    } catch {
      // Keep editing and exports usable if browser storage is unavailable.
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

        if (!initialPreviewRequested.current) {
          initialPreviewRequested.current = true;
          const firstAvailable = res.data.find((code) => code.canPrint && code.status === "ACTIVE");
          if (firstAvailable) {
            void apiClient.getCodePrintAssets([firstAvailable.id]).then((assets) => {
              if (assets.success && assets.data?.codes[0]) setPreviewAsset(assets.data.codes[0]);
            });
          }
        }
      } else if (!res.success) {
        console.error("Failed to fetch access codes", res.error?.message);
      }
    } catch {
      console.error("Failed to fetch access codes");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { void fetchCodes(); }, [fetchCodes]);

  const updateDesign = (key: keyof CardDesign, value: string) => {
    setCardDesign((current) => ({ ...current, [key]: value }));
  };

  const loadComponentSource = async () => {
    setEditorTab("source");
    if (componentSource || sourceLoading) return;
    setSourceLoading(true);
    setSourceError("");
    try {
      const response = await fetch("/api/card-component/source", { cache: "no-store" });
      if (!response.ok) throw new Error("The component source could not be loaded from this deployment.");
      setComponentSource(await response.text());
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : "Unable to load component source.");
    } finally {
      setSourceLoading(false);
    }
  };

  const downloadComponentSource = () => {
    if (!componentSource) return;
    downloadBlob(new Blob([componentSource], { type: "text/plain;charset=utf-8" }), "visiting-card.tsx");
  };

  const copyToClipboard = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedToken(id);
      window.setTimeout(() => setCopiedToken(null), 1800);
    } catch {
      alert("Clipboard access was denied by the browser.");
    }
  };

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setGenerating(true);
      const expiresAt = genExpiryDays > 0
        ? new Date(Date.now() + genExpiryDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const response = await apiClient.createCodes({
        count: genCount,
        label: genLabel.trim() || undefined,
        expiresAt,
      });
      if (!response.success) {
        alert(response.error.message || "Failed to generate access codes.");
        return;
      }
      if (!response.data) {
        alert("The API returned no generated codes.");
        return;
      }
      const details: GeneratedCodeDetail[] = "codes" in response.data ? response.data.codes : [response.data];
      setShowGenerateModal(false);
      setGeneratedResults(details);
      setSelectedIds(new Set(details.filter((item) => item.canPrint).map((item) => item.id)));
      setSelectedNonPrintableIds(new Set());
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
      const response = await apiClient.revokeCode(id);
      if (response.success) {
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
        alert(response.error?.message || "Failed to revoke code.");
      }
    } catch {
      alert("Network error while revoking code.");
    }
  };

  const selectableCodes = codes.filter((code) => code.status === "ACTIVE");
  const allVisibleSelected = selectableCodes.length > 0 &&
    selectableCodes.every((code) => selectedIds.has(code.id));

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
        selectableCodes.forEach((code) => code.canPrint ? next.delete(code.id) : next.add(code.id));
      }
      return next;
    });
  };

  const loadSelectedAssets = async (): Promise<GeneratedCodeDetail[] | null> => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      alert("Select at least one active QR code first.");
      return null;
    }
    if (ids.length > 100) {
      alert("A bulk operation supports up to 100 codes at a time.");
      return null;
    }
    if (selectedNonPrintableIds.size > 0) {
      alert("The selection includes legacy codes whose original tokens cannot be recovered. Unselect them before exporting cards; they can still be revoked.");
      return null;
    }
    const response = await apiClient.getCodePrintAssets(ids);
    if (!response.success) {
      alert(response.error.message || "Could not load the selected card data.");
      void fetchCodes();
      return null;
    }
    if (!response.data) {
      alert("The API returned no selected card data.");
      void fetchCodes();
      return null;
    }
    return response.data.codes;
  };

  const renderCardPng = async (item: GeneratedCodeDetail): Promise<Blob> => {
    // Mount the same React component used in the live preview at its export size.
    setExportItems([item]);
    await nextFrame();
    const svgElement = exportRefs.current.get(item.id);
    if (!svgElement) throw new Error("The card renderer was not ready. Try again.");
    return svgToPngBlob(svgElement);
  };

  const downloadOneCard = async (item: GeneratedCodeDetail) => {
    try {
      setExportingCards(true);
      const blob = await renderCardPng(item);
      downloadBlob(blob, `connectme-card-${safeFilename(item.label || item.id.slice(0, 8))}.png`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to render the card.");
    } finally {
      setExportingCards(false);
      setExportItems([]);
    }
  };

  const downloadCardZip = async (items: GeneratedCodeDetail[], prefix: string) => {
    if (!items.length) return;
    if (items.length > 100) {
      alert("A ZIP export supports up to 100 cards at a time.");
      return;
    }
    try {
      setExportingCards(true);
      const files = [];
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const blob = await renderCardPng(item);
        files.push({
          name: `${prefix}-${String(index + 1).padStart(2, "0")}-${safeFilename(item.label || item.id.slice(0, 8))}.png`,
          data: new Uint8Array(await blob.arrayBuffer()),
        });
      }
      downloadBlob(createZipBlob(files), `connectme-${prefix}-${items.length}-cards.zip`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create the card ZIP.");
    } finally {
      setExportingCards(false);
      setExportItems([]);
    }
  };

  const handleDownloadSelected = async () => {
    try {
      setBulkBusy(true);
      const assets = await loadSelectedAssets();
      if (assets?.length) await downloadCardZip(assets, "selected-card");
    } catch {
      alert("Failed to create the card ZIP.");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDownloadSelectedSingle = async () => {
    if (selectedIds.size !== 1) {
      alert("Select exactly one active code to download a single card, or use Download cards ZIP.");
      return;
    }
    try {
      setBulkBusy(true);
      const assets = await loadSelectedAssets();
      if (assets?.[0]) await downloadOneCard(assets[0]);
    } catch {
      alert("Failed to download the selected card.");
    } finally {
      setBulkBusy(false);
    }
  };

  const handlePreviewSelected = async () => {
    try {
      setBulkBusy(true);
      const assets = await loadSelectedAssets();
      if (assets?.length) setPreviewAsset(assets[0]);
    } catch {
      alert("Failed to preview the selected card.");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDownloadSelectedById = async (id: string) => {
    try {
      setBulkBusy(true);
      const response = await apiClient.getCodePrintAssets([id]);
      if (!response.success) {
        alert(response.error.message || "This code's card asset is unavailable.");
        return;
      }
      if (!response.data?.codes[0]) {
        alert("This code's card asset is unavailable.");
        return;
      }
      await downloadOneCard(response.data.codes[0]);
    } catch {
      alert("Failed to render the card.");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkRevoke = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      alert("Select at least one code to revoke.");
      return;
    }
    if (!confirm(`Revoke ${ids.length} selected code(s)? This cannot be undone.`)) return;
    try {
      setBulkBusy(true);
      const response = await apiClient.revokeCodes(ids);
      if (!response.success) {
        alert(response.error?.message || "Bulk revoke failed.");
        return;
      }
      setSelectedIds(new Set());
      setSelectedNonPrintableIds(new Set());
      if (previewAsset && ids.includes(previewAsset.id)) setPreviewAsset(null);
      alert(`Revoked ${response.data?.revokedCount ?? 0} code(s).`);
      void fetchCodes();
    } catch {
      alert("Network error while revoking selected codes.");
    } finally {
      setBulkBusy(false);
    }
  };

  const statusBadge = (status: CodeStatus) => {
    switch (status) {
      case "ACTIVE":
        return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400"><Clock className="h-3 w-3" /> ACTIVE</span>;
      case "CONSUMED":
        return <span className="inline-flex items-center gap-1 rounded-full border border-royalViolet/40 bg-royalViolet/15 px-2.5 py-0.5 text-[10px] font-bold text-warmIvory"><CheckCircle2 className="h-3 w-3 text-royalViolet-hover" /> CONSUMED</span>;
      case "REVOKED":
        return <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold text-red-400"><Ban className="h-3 w-3" /> REVOKED</span>;
      case "EXPIRED":
        return <span className="inline-flex items-center gap-1 rounded-full border border-slate-border bg-slate/10 px-2.5 py-0.5 text-[10px] font-bold text-slate-light">EXPIRED</span>;
    }
  };

  const previewCode = previewAsset || generatedResults?.[0] || null;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-warmIvory sm:text-3xl">QR Codes & Card Studio</h1>
            <p className="mt-1 text-xs text-slate-light">Design a complete card, select multiple codes, and export full-card PNGs individually or as a ZIP.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={() => setShowGenerateModal(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-royalViolet px-4 py-2.5 text-xs font-semibold text-white shadow-royal transition hover:bg-royalViolet-hover">
              <Plus className="h-4 w-4" /> Generate Codes
            </button>
            <a href="/api/v1/admin/codes/export" download className="inline-flex items-center gap-1.5 rounded-xl border border-obsidian-border bg-obsidian-surface px-4 py-2.5 text-xs font-semibold text-warmIvory transition hover:bg-obsidian-elevated">
              <Download className="h-4 w-4 text-metallicGold" /> Export CSV
            </a>
          </div>
        </div>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,1fr)]">
          <div className="rounded-2xl border border-obsidian-border bg-obsidian-surface/90 p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-warmIvory"><Palette className="h-4 w-4 text-metallicGold" /> Card design</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-slate">Customize the visible content and colors. These settings are saved in this browser.</p>
              </div>
              <button type="button" onClick={() => setCardDesign(DEFAULT_CARD_DESIGN)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-obsidian-border px-2.5 py-1.5 text-[10px] text-slate-light hover:bg-obsidian-elevated">
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>

            <div className="mb-4 flex gap-2 border-b border-obsidian-border pb-3">
              <button type="button" onClick={() => setEditorTab("visual")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${editorTab === "visual" ? "bg-royalViolet text-white" : "text-slate-light hover:bg-obsidian-elevated"}`}>Visual editor</button>
              <button type="button" onClick={loadComponentSource} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${editorTab === "source" ? "bg-royalViolet text-white" : "text-slate-light hover:bg-obsidian-elevated"}`}><Code2 className="h-3.5 w-3.5" /> React component code</button>
            </div>

            {editorTab === "visual" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-[11px] font-semibold text-slate-light">Brand / organization
                    <input value={cardDesign.brand} onChange={(event) => updateDesign("brand", event.target.value)} maxLength={48} className="mt-1 w-full rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs text-warmIvory focus:border-royalViolet focus:outline-none" />
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-light">Card headline
                    <input value={cardDesign.title} onChange={(event) => updateDesign("title", event.target.value)} maxLength={64} className="mt-1 w-full rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs text-warmIvory focus:border-royalViolet focus:outline-none" />
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-light sm:col-span-2">Subtitle
                    <input value={cardDesign.subtitle} onChange={(event) => updateDesign("subtitle", event.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs text-warmIvory focus:border-royalViolet focus:outline-none" />
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-light sm:col-span-2">Scan instructions
                    <textarea value={cardDesign.instructions} onChange={(event) => updateDesign("instructions", event.target.value)} maxLength={180} rows={2} className="mt-1 w-full resize-y rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs text-warmIvory focus:border-royalViolet focus:outline-none" />
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-light sm:col-span-2">Footer
                    <input value={cardDesign.footer} onChange={(event) => updateDesign("footer", event.target.value)} maxLength={80} className="mt-1 w-full rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs text-warmIvory focus:border-royalViolet focus:outline-none" />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-[11px] font-semibold text-slate-light">Accent color
                    <input aria-label="Accent color" type="color" value={cardDesign.accentColor} onChange={(event) => updateDesign("accentColor", event.target.value)} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent" />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-[11px] font-semibold text-slate-light">Card background
                    <input aria-label="Card background color" type="color" value={cardDesign.backgroundColor} onChange={(event) => updateDesign("backgroundColor", event.target.value)} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent" />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-[11px] font-semibold text-slate-light sm:col-span-2">Text color
                    <input aria-label="Text color" type="color" value={cardDesign.textColor} onChange={(event) => updateDesign("textColor", event.target.value)} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent" />
                  </label>
                </div>
                <p className="mt-3 text-[10px] text-slate">For deeper layout changes, open the React component code tab and customize the actual source file.</p>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] leading-relaxed text-slate-light">This is the source file used by the live card preview and image exporter. Edit it in your repository to customize layout, typography, QR placement, borders, and additional elements; the same component generates all card PNGs.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={!componentSource} onClick={() => void copyToClipboard(componentSource, "component-source")} className="inline-flex items-center gap-1.5 rounded-lg border border-obsidian-border px-3 py-2 text-xs text-warmIvory disabled:opacity-40">{copiedToken === "component-source" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy source</button>
                  <button type="button" disabled={!componentSource} onClick={downloadComponentSource} className="inline-flex items-center gap-1.5 rounded-lg bg-royalViolet px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Download className="h-3.5 w-3.5" /> Download .tsx</button>
                </div>
                {sourceLoading ? <p className="text-xs text-slate-light">Loading component source…</p> : null}
                {sourceError ? <p role="alert" className="text-xs text-red-300">{sourceError}</p> : null}
                {componentSource ? <pre className="max-h-[430px] overflow-auto rounded-xl border border-obsidian-border bg-[#09090d] p-4 text-[11px] leading-relaxed text-slate-light"><code>{componentSource}</code></pre> : null}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-obsidian-border bg-obsidian-surface/90 p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-warmIvory"><Eye className="h-4 w-4 text-metallicGold" /> Live card preview</h2>
                <p className="mt-1 text-[11px] text-slate">Current code: {previewCode?.label || "Default design preview"}</p>
              </div>
              <button type="button" onClick={handlePreviewSelected} disabled={bulkBusy || selectedIds.size === 0} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-royalViolet/50 px-3 py-2 text-[10px] font-semibold text-warmIvory hover:bg-royalViolet/10 disabled:opacity-40"><Eye className="h-3.5 w-3.5" /> Preview selected</button>
            </div>
            <div className="overflow-hidden rounded-xl bg-white shadow-lg">
              <VisitingCard design={cardDesign} code={previewCode} className="block h-auto w-full" />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] text-slate">{previewCode ? "Full card preview: design, QR code, URL, and card copy." : "Generate a code or select an active card to load its real QR and URL."}</p>
              <button type="button" disabled={!previewCode || exportingCards} onClick={() => previewCode && void downloadOneCard(previewCode)} className="inline-flex items-center gap-1.5 rounded-lg bg-royalViolet px-3 py-2 text-[10px] font-semibold text-white hover:bg-royalViolet-hover disabled:opacity-40"><ImageDown className="h-3.5 w-3.5" /> Download card PNG</button>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 rounded-xl border border-obsidian-border bg-obsidian-surface/60 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate" />
            <input type="text" placeholder="Search by code label…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="w-full rounded-lg border border-obsidian-border bg-obsidian-elevated py-2 pl-9 pr-3 text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate">Status:</span>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="rounded-lg border border-obsidian-border bg-obsidian-elevated px-3 py-2 text-xs text-warmIvory focus:border-royalViolet focus:outline-none">
              <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="CONSUMED">Consumed</option><option value="REVOKED">Revoked</option><option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-royalViolet/30 bg-obsidian-surface/90 p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-warmIvory">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisiblePage} disabled={!selectableCodes.length} className="h-4 w-4 accent-violet-600" /> Select active codes on this page
            </label>
            <span className="rounded-full border border-royalViolet/40 bg-royalViolet/10 px-2.5 py-1 text-[10px] font-bold text-warmIvory">{selectedIds.size} selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handlePreviewSelected} disabled={bulkBusy || selectedIds.size === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-obsidian-border px-3 py-2 text-xs font-semibold text-warmIvory hover:bg-obsidian-elevated disabled:opacity-40"><Eye className="h-3.5 w-3.5" /> Preview</button>
            <button onClick={() => void handleDownloadSelectedSingle()} disabled={bulkBusy || exportingCards || selectedIds.size !== 1} className="inline-flex items-center gap-1.5 rounded-lg border border-obsidian-border px-3 py-2 text-xs font-semibold text-warmIvory hover:bg-obsidian-elevated disabled:opacity-40"><ImageDown className="h-3.5 w-3.5" /> Download single card</button>
            <button onClick={() => void handleDownloadSelected()} disabled={bulkBusy || exportingCards || selectedIds.size === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-obsidian-border px-3 py-2 text-xs font-semibold text-warmIvory hover:bg-obsidian-elevated disabled:opacity-40"><Archive className="h-3.5 w-3.5" /> {exportingCards ? "Rendering cards…" : "Download cards ZIP"}</button>
            <button onClick={handleBulkRevoke} disabled={bulkBusy || selectedIds.size === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-40"><Ban className="h-3.5 w-3.5" /> Revoke selected</button>
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-slate">Legacy codes whose encrypted tokens cannot be recovered remain redeemable but cannot be re-exported. Unselect these codes before downloading cards; they can still be revoked.</p>

        <div className="overflow-hidden rounded-2xl border border-obsidian-border bg-obsidian-surface/90 shadow-sm">
          {loading ? (
            <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-royalViolet border-t-transparent" /></div>
          ) : codes.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-obsidian-border bg-obsidian-elevated/40 text-[11px] uppercase tracking-wider text-slate">
                  <tr><th className="px-4 py-3 font-semibold">Select</th><th className="px-4 py-3 font-semibold">Label / ID</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Redemption / Contact</th><th className="px-4 py-3 font-semibold">Created</th><th className="px-4 py-3 font-semibold">Expires</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-obsidian-border/50 text-warmIvory/90">
                  {codes.map((code) => (
                    <tr key={code.id} className="transition hover:bg-obsidian-elevated/30">
                      <td className="px-4 py-3.5"><input type="checkbox" checked={selectedIds.has(code.id)} disabled={code.status !== "ACTIVE"} onChange={(event) => toggleOne(code, event.target.checked)} aria-label={`Select ${code.label || "access code"}`} title={code.canPrint ? "Select for export and bulk actions" : "Legacy code: can be revoked, but not re-exported"} className="h-4 w-4 accent-violet-600 disabled:opacity-30" /></td>
                      <td className="px-4 py-3.5 font-medium"><div className="font-semibold text-warmIvory">{code.label || "Untitled Code"}</div><div className="font-mono text-[10px] text-slate">{code.id.slice(0, 8)}…</div></td>
                      <td className="px-4 py-3.5">{statusBadge(code.status)}</td>
                      <td className="px-4 py-3.5">{code.hasSubmission ? <span className="font-semibold text-warmIvory">{code.contactName || "Contact submitted"}</span> : <span className="text-slate">Unredeemed</span>}</td>
                      <td className="px-4 py-3.5 text-slate">{new Date(code.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3.5 text-slate">{code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : "Never"}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {code.status === "ACTIVE" && code.canPrint && <button onClick={() => void handleDownloadSelectedById(code.id)} disabled={bulkBusy || exportingCards} className="inline-flex items-center gap-1 rounded-md border border-obsidian-border px-2 py-1 text-[11px] font-medium text-warmIvory hover:bg-obsidian-elevated disabled:opacity-40"><Download className="h-3 w-3" /> Card</button>}
                          {code.status === "ACTIVE" && <button onClick={() => void handleRevoke(code.id)} className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"><Ban className="h-3 w-3" /> Revoke</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center"><QrCode className="mx-auto mb-3 h-8 w-8 text-slate" /><p className="text-sm font-medium text-warmIvory">No access codes found</p><p className="mt-1 text-xs text-slate">Generate a single code or a batch of QR assets to distribute.</p></div>
          )}
          {totalPages > 1 && <div className="flex items-center justify-between border-t border-obsidian-border px-4 py-3 text-xs text-slate"><div>Page {page} of {totalPages}</div><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-obsidian-border px-3 py-1 text-warmIvory disabled:opacity-40">Previous</button><button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-obsidian-border px-3 py-1 text-warmIvory disabled:opacity-40">Next</button></div></div>}
        </div>

        {showGenerateModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-obsidian-border bg-obsidian-surface p-6 shadow-royal">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold text-warmIvory">Generate access codes</h3><button onClick={() => setShowGenerateModal(false)} className="rounded-lg p-1 text-slate hover:text-warmIvory"><X className="h-5 w-5" /></button></div>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-light">Batch count (1 to 100)</label><input type="number" min={1} max={100} value={genCount} onChange={(event) => setGenCount(Math.min(100, Math.max(1, parseInt(event.target.value, 10) || 1)))} className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none" /></div>
            <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-light">Batch label (optional)</label><input type="text" maxLength={100} placeholder="e.g. Conference Day 1" value={genLabel} onChange={(event) => setGenLabel(event.target.value)} className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory placeholder-slate focus:border-royalViolet focus:outline-none" /></div>
            <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-light">Expiry duration (days, 0 = never)</label><input type="number" min={0} max={365} value={genExpiryDays} onChange={(event) => setGenExpiryDays(Math.min(365, Math.max(0, parseInt(event.target.value, 10) || 0)))} className="w-full rounded-xl border border-obsidian-border bg-obsidian-elevated px-4 py-2.5 text-xs text-warmIvory focus:border-royalViolet focus:outline-none" /></div>
            <div className="flex justify-end gap-2.5 pt-2"><button type="button" onClick={() => setShowGenerateModal(false)} className="rounded-xl border border-obsidian-border px-4 py-2.5 text-xs font-semibold text-slate-light hover:bg-obsidian-elevated">Cancel</button><button type="submit" disabled={generating} className="rounded-xl bg-royalViolet px-5 py-2.5 text-xs font-semibold text-white shadow-royal hover:bg-royalViolet-hover disabled:opacity-50">{generating ? "Generating…" : "Generate codes"}</button></div>
          </form>
        </div></div>}

        {generatedResults && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md">
          <div className="my-8 w-full max-w-4xl rounded-2xl border border-obsidian-border bg-obsidian-surface p-6 shadow-royal">
            <div className="mb-4 flex flex-col gap-3 border-b border-obsidian-border pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="text-lg font-bold text-warmIvory">Generated {generatedResults.length} code{generatedResults.length === 1 ? "" : "s"}</h3><p className="text-xs text-metallicGold">Download includes the full rendered card design and its unique QR—not just the QR image.</p></div>
              <div className="flex flex-wrap items-center gap-2">
                {generatedResults.length > 1 && <button type="button" disabled={exportingCards} onClick={() => void downloadCardZip(generatedResults, "generated-card")} className="inline-flex items-center gap-1.5 rounded-lg border border-royalViolet bg-royalViolet px-3 py-1.5 text-xs font-semibold text-white shadow-royal hover:bg-royalViolet-hover disabled:opacity-50"><Archive className="h-3.5 w-3.5" /> {exportingCards ? "Rendering cards…" : "Download cards ZIP"}</button>}
                <button onClick={() => setGeneratedResults(null)} className="rounded-lg p-1 text-slate hover:text-warmIvory"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              {generatedResults.map((item) => (
                <div key={item.id} className="flex flex-col gap-4 rounded-xl border border-obsidian-border bg-obsidian-elevated/50 p-4">
                  <div className="overflow-hidden rounded-lg bg-white">
                    <VisitingCard design={cardDesign} code={item} className="block h-auto w-full" />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0"><div className="text-sm font-semibold text-warmIvory">{item.label || "Access code"}</div><div className="break-all font-mono text-[11px] text-slate-light">{item.url}</div></div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => void copyToClipboard(item.url, item.id)} className="inline-flex items-center gap-1 rounded-lg border border-obsidian-border bg-obsidian-surface px-2.5 py-1.5 text-xs text-warmIvory hover:bg-obsidian-elevated">{copiedToken === item.id ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copied</> : <><Copy className="h-3.5 w-3.5 text-slate" /> Copy URL</>}</button>
                      <button onClick={() => void downloadOneCard(item)} disabled={exportingCards} className="inline-flex items-center gap-1 rounded-lg bg-royalViolet px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-royalViolet-hover disabled:opacity-50"><ImageDown className="h-3.5 w-3.5" /> Download full card</button>
                      <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-obsidian-border bg-obsidian-surface px-2.5 py-1.5 text-xs text-slate-light hover:text-warmIvory"><ExternalLink className="h-3.5 w-3.5" /> Open form</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end border-t border-obsidian-border pt-4"><button onClick={() => setGeneratedResults(null)} className="rounded-xl bg-obsidian-elevated px-5 py-2 text-xs font-semibold text-warmIvory hover:bg-obsidian-border">Close</button></div>
          </div>
        </div>}
      </div>

      {/* Off-canvas React renders are serialized from this same SVG component for PNG exports. */}
      <div aria-hidden="true" style={{ position: "fixed", left: "-20000px", top: 0, width: 1200, height: 720, opacity: 0, pointerEvents: "none", overflow: "hidden" }}>
        {exportItems.map((item) => <div key={item.id} style={{ width: 1200, height: 720 }}><VisitingCard ref={(node) => { if (node) exportRefs.current.set(item.id, node); else exportRefs.current.delete(item.id); }} design={cardDesign} code={item} className="block" /></div>)}
      </div>
    </>
  );
}
