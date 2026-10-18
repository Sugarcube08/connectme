import type { NextRequest } from "next/server";

const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
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
  const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  // Cookie-authenticated browser writes must originate from this exact web
  // origin. SameSite cookies alone do not protect against hostile sibling
  // subdomains; the API sees a server-to-server request after this proxy.
  if (!safeMethods.has(request.method.toUpperCase())) {
    if (fetchSite === "cross-site") {
      return Response.json(
        { success: false, error: { code: "CSRF_ORIGIN_DENIED", message: "Cross-site state-changing requests are not allowed." } },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (origin) {
      try {
        if (new URL(origin).origin !== incoming.origin) throw new Error("Origin mismatch");
      } catch {
        return Response.json(
          { success: false, error: { code: "CSRF_ORIGIN_DENIED", message: "State-changing requests must originate from this website." } },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
    }
  }

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
  // The mobile-client marker controls whether the API returns bearer credentials
  // in JSON. Never trust a browser-supplied value across the web proxy boundary.
  headers.delete("x-connectme-client");
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

  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
