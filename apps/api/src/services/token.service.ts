import { createHash, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { CodeRepository } from "../repositories/code.repository";
import { config } from "../config/env";
import { serializeAccessCode } from "../serializers";
import { AccessCodeItem, GeneratedCodeDetail, CodeStatus } from "@connectme/contracts";

export class TokenService {
  constructor(private codeRepo = new CodeRepository()) {}

  generateToken(): string {
    return randomBytes(16).toString("base64url");
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  getCanonicalUrl(token: string, publicOrigin: string): string {
    return `${publicOrigin.replace(/\/+$/, "")}/${token}`;
  }

  async generateQr(url: string): Promise<string> {
    return QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 512,
      color: {
        dark: "#0B0B10",
        light: "#FFFFFF",
      },
    });
  }

  async createSingle(options: {
    label?: string;
    expiresAt?: string | null;
    publicOrigin: string;
  }): Promise<GeneratedCodeDetail> {
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const url = this.getCanonicalUrl(token, options.publicOrigin);
    const qrDataUrl = await this.generateQr(url);

    const record = await this.codeRepo.create({
      tokenHash,
      label: options.label,
      expiresAt: options.expiresAt ? new Date(options.expiresAt) : null,
    });

    const serialized = serializeAccessCode(record);

    return {
      ...serialized,
      token,
      url,
      qrDataUrl,
    };
  }

  async createBatch(
    count: number,
    options: { label?: string; expiresAt?: string | null; publicOrigin: string }
  ): Promise<GeneratedCodeDetail[]> {
    const safeCount = Math.min(Math.max(1, count), config.MAX_BATCH_CODE_COUNT);
    const results: GeneratedCodeDetail[] = [];

    for (let i = 0; i < safeCount; i++) {
      const token = this.generateToken();
      const tokenHash = this.hashToken(token);
      const url = this.getCanonicalUrl(token, options.publicOrigin);
      const batchLabel = options.label
        ? safeCount > 1
          ? `${options.label} #${i + 1}`
          : options.label
        : null;

      const record = await this.codeRepo.create({
        tokenHash,
        label: batchLabel,
        expiresAt: options.expiresAt ? new Date(options.expiresAt) : null,
      });

      const qrDataUrl = await this.generateQr(url);
      const serialized = serializeAccessCode(record);

      results.push({
        ...serialized,
        token,
        url,
        qrDataUrl,
      });
    }

    return results;
  }

  async getStatusByToken(token: string): Promise<{
    eligible: boolean;
    status: CodeStatus;
    codeId?: string;
  }> {
    const tokenHash = this.hashToken(token);
    const code = await this.codeRepo.findByTokenHash(tokenHash);

    if (!code) {
      return { eligible: false, status: "REVOKED" };
    }

    let effectiveStatus: CodeStatus = code.status as CodeStatus;
    if (effectiveStatus === "ACTIVE" && code.expiresAt && code.expiresAt < new Date()) {
      effectiveStatus = "EXPIRED";
    }

    return {
      eligible: effectiveStatus === "ACTIVE",
      status: effectiveStatus,
      codeId: code.id,
    };
  }

  async revoke(id: string): Promise<boolean> {
    return this.codeRepo.revoke(id);
  }

  async list(params: {
    page: number;
    limit: number;
    status?: CodeStatus | "EXPIRED";
    search?: string;
  }): Promise<{ codes: AccessCodeItem[]; total: number; totalPages: number }> {
    const skip = (params.page - 1) * params.limit;
    const { items, total } = await this.codeRepo.list({
      skip,
      take: params.limit,
      status: params.status,
      search: params.search,
    });

    return {
      codes: items.map(serializeAccessCode),
      total,
      totalPages: Math.ceil(total / params.limit) || 1,
    };
  }

  async exportCsv(): Promise<string> {
    const items = await this.codeRepo.exportAll();
    const headers = [
      "ID",
      "Label",
      "Status",
      "Created At",
      "Expires At",
      "Consumed At",
      "Revoked At",
      "Contact Name",
    ];

    const escape = (s: string | null) => {
      if (!s) return "";
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = items.map((c) => {
      let status = c.status;
      if (status === "ACTIVE" && c.expiresAt && c.expiresAt < new Date()) {
        status = "EXPIRED" as any;
      }
      return [
        c.id,
        escape(c.label),
        status,
        c.createdAt.toISOString(),
        c.expiresAt ? c.expiresAt.toISOString() : "",
        c.consumedAt ? c.consumedAt.toISOString() : "",
        c.revokedAt ? c.revokedAt.toISOString() : "",
        escape(c.submission?.fullName || null),
      ];
    });

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }
}
