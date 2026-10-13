import type { Request } from "express";

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Accept only a bare HTTP(S) origin. Production public origins must use HTTPS.
 * This deliberately rejects paths, credentials, query strings and fragments.
 */
export function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value?.trim()) return null;

  try {
    const parsed = new URL(value.trim());
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      (isProduction() && parsed.protocol !== "https:")
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function originFromDeploymentHost(host: string | undefined): string | null {
  if (!host?.trim()) return null;
  // Vercel system variables provide hostnames without a scheme.
  const value = host.includes("://") ? host : `https://${host}`;
  return normalizeOrigin(value);
}

function deploymentOrigins(): Set<string> {
  return new Set(
    [
      process.env.VERCEL_URL,
      process.env.VERCEL_BRANCH_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ]
      .map(originFromDeploymentHost)
      .filter((origin): origin is string => Boolean(origin))
  );
}

/**
 * CORS is derived from the request host and Vercel's system URLs instead of an
 * operator-maintained CORS_ORIGIN value. The web frontend should use the
 * same-origin Next.js proxy; that proxy strips browser Origin before calling API.
 * Native clients normally do not send Origin and therefore need no CORS grant.
 */
export function isAllowedCorsOrigin(origin: string, request: Request): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized || normalized !== origin) return false;

  if (deploymentOrigins().has(normalized)) return true;

  const requestHost = request.get("host")?.trim().toLowerCase();
  if (!requestHost) return false;

  try {
    const parsed = new URL(normalized);
    if (parsed.host.toLowerCase() !== requestHost) return false;
    return !isProduction() || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Resolves the origin where a QR link should open.
 *
 * Same-origin Next.js requests provide a server-generated
 * X-ConnectMe-Public-Origin header. Direct same-origin browser requests can use
 * Origin. Non-browser callers fall back to Vercel's stable production domain,
 * then the current request host. No QR origin environment variable is required.
 */
export function resolvePublicOrigin(request: Request): string {
  const forwardedPublicOrigin = normalizeOrigin(request.get("x-connectme-public-origin"));
  if (forwardedPublicOrigin) return forwardedPublicOrigin;

  const requestOrigin = request.get("origin");
  if (requestOrigin && isAllowedCorsOrigin(requestOrigin, request)) {
    return requestOrigin;
  }

  const deploymentOrigin =
    originFromDeploymentHost(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    originFromDeploymentHost(process.env.VERCEL_URL) ??
    originFromDeploymentHost(process.env.VERCEL_BRANCH_URL);
  if (deploymentOrigin) return deploymentOrigin;

  const host = request.get("host");
  const requestOriginFromHost = normalizeOrigin(
    host ? `${isProduction() ? "https" : request.protocol}://${host}` : undefined
  );
  if (requestOriginFromHost) return requestOriginFromHost;

  if (!isProduction()) return "http://localhost:3000";

  throw new Error(
    "Unable to determine the public origin for this QR link. Serve code creation through the web proxy or use a Vercel deployment URL."
  );
}
