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

      const result = await this.tokenService.list({ page, limit, status, search });

      return res.status(200).json({
        success: true,
        data: result.codes,
        meta: {
          page,
          limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const count = parseInt(req.body.count || "1", 10);
      const label = req.body.label ? String(req.body.label).trim() : undefined;
      const expiresAt = req.body.expiresAt ? String(req.body.expiresAt) : null;

      if (count > 1) {
        const codes = await this.tokenService.createBatch(count, { label, expiresAt, publicOrigin: await this.publicOriginService.resolve(req) });
        return res.status(201).json({
          success: true,
          data: { count: codes.length, codes },
        });
      } else {
        const code = await this.tokenService.createSingle({ label, expiresAt, publicOrigin: await this.publicOriginService.resolve(req) });
        return res.status(201).json({
          success: true,
          data: code,
        });
      }
    } catch (err) {
      next(err);
    }
  };

  revoke = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const revoked = await this.tokenService.revoke(id);

      if (!revoked) {
        throw new NotFoundError(
          "Code cannot be revoked because it does not exist or is not active."
        );
      }

      return res.status(200).json({
        success: true,
        data: { message: "Code successfully revoked." },
      });
    } catch (err) {
      next(err);
    }
  };

  exportCsv = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const csv = await this.tokenService.exportCsv();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="connectme-codes-${new Date().toISOString().slice(0, 10)}.csv"`
      );
      return res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  };
}
