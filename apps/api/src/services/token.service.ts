import { createHash, createHmac, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { CodeRepository } from "../repositories/code.repository";
import { config } from "../config/env";
import { serializeAccessCode } from "../serializers";
import { AccessCodeItem, GeneratedCodeDetail, CodeStatus } from "@connectme/contracts";

const TOKEN_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export class TokenService {
  constructor(private codeRepo = new CodeRepository()) {}

  generateToken(): string {
    // 16 alphanumeric characters (Base62) provides ~95 bits of entropy (62^16 combinations).
    // Clean URL without encoding issues; compact representation produces lower-density QR codes for faster scanning.
    const bytes = randomBytes(16);
    let token = "";
    for (let i = 0; i < 16; i++) {
      token += TOKEN_ALPHABET[bytes[i] % 62];
    }
    return token;
  }

  hashToken(token: string): string {
    // Access tokens can be validated with HMAC pepper.
    return `hmac-sha256:${createHmac("sha256", config.ACCESS_CODE_PEPPER).update(token).digest("hex")}`;
  }

  tokenHashCandidates(token: string): string[] {
    return [
      this.hashToken(token),
      createHash("sha256").update(token).digest("hex"),
    ];
  }

  getCanonicalUrl(token: string, publicOrigin: string): string {
    return `${publicOrigin.replace(/\/+$/, "")}/${token}`;
  }

  async generateQr(url: string): Promise<string> {
    // High-resolution 1024x1024 QR data URL for crisp print-ready output at generation time.
    return QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 1024,
      color: { dark: "#0B0B10", light: "#FFFFFF" },
    });
  }

  async createSingle(options: {
    adminUserId: string;
    label?: string;
    expiresAt?: string | null;
    publicOrigin: string;
  }): Promise<GeneratedCodeDetail> {
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const url = this.getCanonicalUrl(token, options.publicOrigin);
    const qrDataUrl = await this.generateQr(url);
    const record = await this.codeRepo.create({
      token,
      tokenHash,
      createdByAdminId: options.adminUserId,
      label: options.label,
      expiresAt: options.expiresAt ? new Date(options.expiresAt) : null,
    });

    return { ...serializeAccessCode(record, options.publicOrigin), token, url, qrDataUrl };
  }

  async createBatch(
    count: number,
    options: { adminUserId: string; label?: string; expiresAt?: string | null; publicOrigin: string }
  ): Promise<GeneratedCodeDetail[]> {
    const safeCount = Math.min(Math.max(1, count), config.MAX_BATCH_CODE_COUNT);
    const expiresAt = options.expiresAt ? new Date(options.expiresAt) : null;

    const items = Array.from({ length: safeCount }, (_, i) => {
      const token = this.generateToken();
      const tokenHash = this.hashToken(token);
      const url = this.getCanonicalUrl(token, options.publicOrigin);
      const batchLabel = options.label
        ? safeCount > 1 ? `${options.label} #${i + 1}` : options.label
        : null;
      return {
        token,
        tokenHash,
        createdByAdminId: options.adminUserId,
        label: batchLabel,
        expiresAt,
        url,
      };
    });

    // High performance: parallel QR rendering and single bulk SQL insertion
    const [qrDataUrls] = await Promise.all([
      Promise.all(items.map((item) => this.generateQr(item.url))),
      this.codeRepo.createMany(items.map(({ url, ...record }) => record)),
    ]);

    const createdRecords = await this.codeRepo.findOwnedByTokens(
      items.map((i) => i.token),
      options.adminUserId
    );
    const recordMap = new Map(createdRecords.map((r) => [r.token, r]));

    return items.map((item, index) => {
      const record = recordMap.get(item.token) || {
        id: `gen-${item.token}`,
        label: item.label,
        status: "ACTIVE",
        createdAt: new Date(),
        expiresAt: item.expiresAt,
        consumedAt: null,
        revokedAt: null,
        token: item.token,
      };
      return {
        ...serializeAccessCode(record, options.publicOrigin),
        token: item.token,
        url: item.url,
        qrDataUrl: qrDataUrls[index],
      };
    });
  }

  async getStatusByToken(token: string): Promise<{
    eligible: boolean;
    status: CodeStatus;
    codeId?: string;
    requiresSmsNotice?: boolean;
    smsNotice?: string;
  }> {
    const code = await this.codeRepo.findByTokenOrHashes(token, this.tokenHashCandidates(token));
    if (!code) return { eligible: false, status: "REVOKED" };

    let effectiveStatus: CodeStatus = code.status as CodeStatus;
    if (effectiveStatus === "ACTIVE" && code.expiresAt && code.expiresAt < new Date()) {
      effectiveStatus = "EXPIRED";
    }

    const admin = code.createdByAdmin;
    const isSmsConfigured = Boolean(
      admin?.smsEnabled &&
      admin?.smsGatewayUrl &&
      admin?.smsGatewayUsername &&
      admin?.smsGatewayPassword
    );

    return {
      eligible: effectiveStatus === "ACTIVE",
      status: effectiveStatus,
      codeId: code.id,
      requiresSmsNotice: isSmsConfigured,
      smsNotice: isSmsConfigured
        ? "Be sure to enter correct number, because it's not editable and you'll receive my contact on the given number via sms only"
        : undefined,
    };
  }

  async revoke(id: string, adminUserId: string): Promise<boolean> {
    return this.codeRepo.revoke(id, adminUserId);
  }

  async revokeMany(ids: string[], adminUserId: string): Promise<number> {
    return this.codeRepo.revokeMany(ids, adminUserId);
  }

  async list(params: {
    adminUserId: string;
    page: number;
    limit: number;
    status?: CodeStatus | "EXPIRED";
    search?: string;
    publicOrigin?: string;
  }): Promise<{ codes: AccessCodeItem[]; total: number; totalPages: number }> {
    const skip = (params.page - 1) * params.limit;
    const { items, total } = await this.codeRepo.list({
      adminUserId: params.adminUserId,
      skip,
      take: params.limit,
      status: params.status,
      search: params.search,
    });
    return {
      codes: items.map((item) => serializeAccessCode(item, params.publicOrigin)),
      total,
      totalPages: Math.ceil(total / params.limit) || 1,
    };
  }

  async exportCsv(adminUserId: string): Promise<string> {
    const items = await this.codeRepo.exportAll(adminUserId);
    const headers = ["ID", "Label", "Status", "Created At", "Expires At", "Consumed At", "Revoked At", "Contact Name"];
    const escape = (s: string | null) => {
      if (!s) return "";
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = items.map((c) => {
      let status = c.status;
      if (status === "ACTIVE" && c.expiresAt && c.expiresAt < new Date()) status = "EXPIRED" as any;
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
