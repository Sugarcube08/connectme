import type { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/upstream-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

/**
 * Runtime same-origin proxy to the authoritative Express API.
 * Request bodies and binary responses are streamed through the shared proxy
 * helper, which also handles upstream outages consistently.
 */
async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const endpoint = path.map((segment) => encodeURIComponent(segment)).join("/");
  return proxyToApi(request, `/api/v1/${endpoint}`);
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
