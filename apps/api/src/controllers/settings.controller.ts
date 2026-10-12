import { Request, Response, NextFunction } from "express";
import { SettingsRepository } from "../repositories/settings.repository";

export class SettingsController {
  constructor(private settingsRepo = new SettingsRepository()) {}

  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await this.settingsRepo.getGeneral();
      return res.status(200).json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await this.settingsRepo.updateGeneral(req.body);
      return res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };
}
