import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

/**
 * Runtime same-origin proxy to the authoritative Express API.
 *
 * It forwards request bodies without interpreting them, so multipart submissions,
 * CSV responses, and image bytes survive the proxy. API_INTERNAL_URL is server-only
 * and can be changed without baking a new URL into browser JavaScript.
 */
async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const apiOrigin = (process.env.API_INTERNAL_URL || "http://localhost:4000").replace(/\/+$/, "");
  const incomingUrl = new URL(request.url);
  const endpoint = path.map((segment) => encodeURIComponent(segment)).join("/");
  const target = new URL(`/api/v1/${endpoint}${incomingUrl.search}`, apiOrigin);

  const headers = new Headers(request.headers);
  // Let fetch calculate transport headers for the upstream request.
  headers.delete("host");
  headers.delete("content-length");
  headers.delete("connection");

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const responseHeaders = new Headers();

  // Do not forward hop-by-hop headers or an upstream Content-Length that might
  // no longer match after fetch performs content decoding.
  for (const name of [
    "content-type",
    "content-disposition",
    "cache-control",
    "etag",
    "last-modified",
    "vary",
    "location",
    "retry-after",
    "x-request-id",
    "x-content-type-options",
    "content-security-policy",
    "x-frame-options",
    "referrer-policy",
  ]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  // Preserve authentication cookies from Express.
  const upstreamHeaders = upstream.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = upstreamHeaders.getSetCookie?.() ?? [];
  for (const cookie of cookies) responseHeaders.append("set-cookie", cookie);
  if (cookies.length === 0) {
    const cookie = upstream.headers.get("set-cookie");
    if (cookie) responseHeaders.set("set-cookie", cookie);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
