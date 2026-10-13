import type { Request } from "express";
import { isAllowedCorsOrigin, normalizeOrigin } from "../config/origin";
import { SettingsRepository } from "../repositories/settings.repository";

function originFromDeploymentHost(host: string | undefined): string | null {
  if (!host?.trim()) return null;
  return normalizeOrigin(host.includes("://") ? host : `https://${host}`);
}

/**
 * Finds the public website origin without a QR_CANONICAL_ORIGIN setting.
 *
 * The same-origin web proxy supplies its origin; first-admin setup persists
 * that value in MySQL so native clients can create working web QR links later.
 */
export class PublicOriginService {
  constructor(private settingsRepo = new SettingsRepository()) {}

  async resolve(request: Request): Promise<string> {
    const proxyOrigin = normalizeOrigin(request.get("x-connectme-public-origin"));
    if (proxyOrigin) return proxyOrigin;

    const browserOrigin = request.get("origin");
    if (browserOrigin && isAllowedCorsOrigin(browserOrigin, request)) {
      return browserOrigin;
    }

    const storedOrigin = normalizeOrigin(await this.settingsRepo.getPublicOrigin());
    if (storedOrigin) return storedOrigin;

    const deploymentOrigin =
      originFromDeploymentHost(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
      originFromDeploymentHost(process.env.VERCEL_URL) ??
      originFromDeploymentHost(process.env.VERCEL_BRANCH_URL);
    if (deploymentOrigin) return deploymentOrigin;

    const host = request.get("host");
    const requestOrigin = normalizeOrigin(
      host ? `${process.env.NODE_ENV === "production" ? "https" : request.protocol}://${host}` : undefined
    );
    if (requestOrigin) return requestOrigin;

    if (process.env.NODE_ENV !== "production") return "http://localhost:3000";

    throw new Error(
      "Unable to determine the public website origin. Complete first-admin setup through the web proxy or configure Vercel deployment metadata."
    );
  }
}
