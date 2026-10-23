import { Request, Response, NextFunction } from "express";
import { TokenService } from "../services/token.service";
import { NotFoundError } from "../errors/app-error";
import { PublicOriginService } from "../services/public-origin.service";

export class CodesController {
  constructor(
    private tokenService = new TokenService(),
    private publicOriginService = new PublicOriginService()
  ) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const limit = parseInt((req.query.limit as string) || "20", 10);
      const status = (req.query.status as any) || undefined;
      const search = (req.query.search as string) || undefined;
      const result = await this.tokenService.list({
        adminUserId: req.adminUser!.id, page, limit, status, search,
      });
      return res.status(200).json({
        success: true,
        data: result.codes,
        meta: { page, limit, total: result.total, totalPages: result.totalPages },
      });
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const count = parseInt(req.body.count || "1", 10);
      const label = req.body.label ? String(req.body.label).trim() : undefined;
      const expiresAt = req.body.expiresAt ? String(req.body.expiresAt) : null;
      const options = {
        adminUserId: req.adminUser!.id,
        label,
        expiresAt,
        publicOrigin: await this.publicOriginService.resolve(req),
      };
      if (count > 1) {
        const codes = await this.tokenService.createBatch(count, options);
        return res.status(201).json({ success: true, data: { count: codes.length, codes } });
      }
      const code = await this.tokenService.createSingle(options);
      return res.status(201).json({ success: true, data: code });
    } catch (err) { next(err); }
  };

  printAssets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const codes = await this.tokenService.getPrintAssets(
        req.body?.ids,
        req.adminUser!.id,
        await this.publicOriginService.resolve(req)
      );
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      return res.status(200).json({ success: true, data: { count: codes.length, codes } });
    } catch (err) { next(err); }
  };

  bulkRevoke = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ids = req.body?.ids;
      if (
        !Array.isArray(ids) ||
        ids.length < 1 ||
        ids.length > 100 ||
        !ids.every((id: unknown) => typeof id === "string" && id.length > 0 && id.length <= 191) ||
        new Set(ids).size !== ids.length
      ) {
        return res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Select 1 to 100 unique access-code IDs." },
        });
      }

      const revoked = await this.tokenService.revokeMany(ids, req.adminUser!.id);
      return res.status(200).json({ success: true, data: { revokedCount: revoked } });
    } catch (err) { next(err); }
  };

  revoke = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const revoked = await this.tokenService.revoke(String(req.params.id), req.adminUser!.id);
      if (!revoked) {
        throw new NotFoundError("Code cannot be revoked because it does not exist, is not owned by this admin, or is not active.");
      }
      return res.status(200).json({ success: true, data: { message: "Code successfully revoked." } });
    } catch (err) { next(err); }
  };

  exportCsv = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const csv = await this.tokenService.exportCsv(req.adminUser!.id);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="connectme-codes-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.status(200).send(csv);
    } catch (err) { next(err); }
  };
}
