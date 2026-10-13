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

