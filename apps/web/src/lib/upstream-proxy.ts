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
  const configuredApiOrigin = process.env.API_INTERNAL_URL?.trim();
  if (!configuredApiOrigin && process.env.NODE_ENV === "production") {
    return Response.json(
      { success: false, error: { code: "API_CONFIGURATION_ERROR", message: "The API upstream is not configured." } },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const apiOrigin = (configuredApiOrigin || "http://localhost:4000").replace(/\/+$/, "");
  const incoming = new URL(request.url);
  let target: URL;
  try {
    target = new URL(`${apiPath}${incoming.search}`, apiOrigin);
    if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error("Unsupported API protocol");
  } catch {
    return Response.json(
      { success: false, error: { code: "API_CONFIGURATION_ERROR", message: "The API upstream URL is invalid." } },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.delete("connection");
  // This is a server-to-server hop. Strip browser CORS metadata, but pass the
  // original public web origin for QR URL generation by the API.
  headers.delete("origin");
  headers.delete("x-connectme-public-origin");
  headers.set("x-connectme-public-origin", incoming.origin);

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
