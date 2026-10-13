import type { NextRequest } from "next/server";

const FORWARDED_RESPONSE_HEADERS = [
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
] as const;

/**
 * Runtime proxy to the authoritative Express API. Keeping this server-side allows
 * web and API to be deployed independently and lets one public web origin route
 * /api/v1/* without exposing an internal service URL in browser bundles.
 */
export async function proxyToApi(request: NextRequest, apiPath: string): Promise<Response> {
  const apiOrigin = (process.env.API_INTERNAL_URL || "http://localhost:4000").replace(/\/+$/, "");
  const incoming = new URL(request.url);
  const target = new URL(`${apiPath}${incoming.search}`, apiOrigin);

  const headers = new Headers(request.headers);
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

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return Response.json(
      { success: false, error: { code: "API_UNAVAILABLE", message: "The Connect Me API is temporarily unavailable." } },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  // Cookies must survive the proxy so browser login/setup sessions remain HTTP-only.
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
