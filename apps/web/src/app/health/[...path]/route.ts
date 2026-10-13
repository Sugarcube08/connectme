import type { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/upstream-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const endpoint = path.map((segment) => encodeURIComponent(segment)).join("/");
  return proxyToApi(request, `/health/${endpoint}`);
}
