import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exposes the reusable card component source requested by the authenticated
 * Card Studio UI. The component contains presentation code only; no secrets.
 * Keep candidates compatible with both monorepo-root and apps/web-root builds.
 */
export async function GET() {
  const candidates = [
    path.resolve(process.cwd(), "src/components/visiting-card.tsx"),
    path.resolve(process.cwd(), "apps/web/src/components/visiting-card.tsx"),
  ];

  for (const candidate of candidates) {
    try {
      const source = await readFile(candidate, "utf8");
      return new NextResponse(source, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      // Try the other supported monorepo path.
    }
  }

  return NextResponse.json(
    { error: "Card component source is unavailable in this deployment." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}
