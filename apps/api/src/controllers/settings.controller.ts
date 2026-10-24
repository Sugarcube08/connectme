import { Request, Response, NextFunction } from "express";
import { SettingsRepository } from "../repositories/settings.repository";
import { UserRepository } from "../repositories/user.repository";
import { encryptPassword } from "../lib/sms-crypto";
import { ValidationError, UnauthorizedError } from "../errors/app-error";
import { AdminSmsSettingsDTO } from "@connectme/contracts";

export class SettingsController {
  constructor(
    private settingsRepo = new SettingsRepository(),
    private userRepo = new UserRepository()
  ) {}

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

  getAdminSmsSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = req.adminUser?.id;
      if (!adminId) throw new UnauthorizedError("Authentication required.");

      const raw = await this.userRepo.getSmsSettings(adminId);
      const data: AdminSmsSettingsDTO = {
        smsEnabled: raw?.smsEnabled ?? false,
        smsGatewayUrl: raw?.smsGatewayUrl ?? null,
        smsGatewayUsername: raw?.smsGatewayUsername ?? null,
        hasPassword: Boolean(raw?.smsGatewayPassword),
        smsTemplate: raw?.smsTemplate ?? null,
        smsSenderPhone: raw?.smsSenderPhone ?? null,
        smsSenderEmail: raw?.smsSenderEmail ?? null,
      };

      return res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateAdminSmsSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = req.adminUser?.id;
      if (!adminId) throw new UnauthorizedError("Authentication required.");

      const current = await this.userRepo.getSmsSettings(adminId);

      const {
        smsEnabled,
        smsGatewayUrl,
        smsGatewayUsername,
        smsGatewayPassword,
        smsTemplate,
        smsSenderPhone,
        smsSenderEmail,
      } = req.body;

      // Handle password encryption and retention
      let encryptedPassword = current?.smsGatewayPassword;
      if (smsGatewayPassword && typeof smsGatewayPassword === "string" && smsGatewayPassword.trim().length > 0) {
        encryptedPassword = encryptPassword(smsGatewayPassword.trim());
      }

      // If user provided a gateway URL, require username and password
      if (smsGatewayUrl && typeof smsGatewayUrl === "string" && smsGatewayUrl.trim().length > 0) {
        if (!smsGatewayUsername || typeof smsGatewayUsername !== "string" || smsGatewayUsername.trim().length === 0) {
          throw new ValidationError("SMS Gateway Username is required when Gateway URL is configured.");
        }
        if (!encryptedPassword) {
          throw new ValidationError("SMS Gateway Password is required when Gateway URL is configured.");
        }
      }

      // If enabling SMS delivery, all gateway parameters must be present
      if (smsEnabled) {
        if (!smsGatewayUrl || typeof smsGatewayUrl !== "string" || smsGatewayUrl.trim().length === 0) {
          throw new ValidationError("SMS Gateway URL is required to enable SMS delivery.");
        }
        if (!smsGatewayUsername || typeof smsGatewayUsername !== "string" || smsGatewayUsername.trim().length === 0) {
          throw new ValidationError("SMS Gateway Username is required to enable SMS delivery.");
        }
        if (!encryptedPassword) {
          throw new ValidationError("SMS Gateway Password is required to enable SMS delivery.");
        }
      }

      const updated = await this.userRepo.updateSmsSettings(adminId, {
        smsEnabled: Boolean(smsEnabled),
        smsGatewayUrl: smsGatewayUrl?.trim() || null,
        smsGatewayUsername: smsGatewayUsername?.trim() || null,
        smsGatewayPassword: encryptedPassword || null,
        smsTemplate: smsTemplate?.trim() || null,
        smsSenderPhone: smsSenderPhone?.trim() || null,
        smsSenderEmail: smsSenderEmail?.trim() || null,
      });

      const data: AdminSmsSettingsDTO = {
        smsEnabled: updated.smsEnabled,
        smsGatewayUrl: updated.smsGatewayUrl,
        smsGatewayUsername: updated.smsGatewayUsername,
        hasPassword: Boolean(updated.smsGatewayPassword),
        smsTemplate: updated.smsTemplate,
        smsSenderPhone: updated.smsSenderPhone,
        smsSenderEmail: updated.smsSenderEmail,
      };

      return res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
