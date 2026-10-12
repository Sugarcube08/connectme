import { Request, Response } from "express";
import { prisma } from "@connectme/database";

export class HealthController {
  live = (req: Request, res: Response) => {
    return res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  };

  ready = async (req: Request, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch {
      return res.status(503).json({
        status: "error",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      });
    }
  };
}
