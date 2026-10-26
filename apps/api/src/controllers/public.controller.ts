import { Request, Response, NextFunction } from "express";
import { TokenService } from "../services/token.service";
import { RedemptionService } from "../services/redemption.service";
import { SettingsRepository } from "../repositories/settings.repository";
import { ValidationError } from "../errors/app-error";

export class PublicController {
  constructor(
    private tokenService = new TokenService(),
    private redemptionService = new RedemptionService(),
    private settingsRepo = new SettingsRepository()
  ) {}

  verifyCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = String(req.params.token || "");
      if (!token || token.length < 10) {
        throw new ValidationError("Invalid or missing access token.");
      }

      const result = await this.tokenService.getStatusByToken(token);
      const settings = await this.settingsRepo.getGeneral();

      if (result.smsConfigured && result.smsStartupHeartbeatUrl) {
        // Asynchronously send initial wakeup heartbeat from server
        fetch(result.smsStartupHeartbeatUrl, { method: "GET", signal: AbortSignal.timeout(5000) })
          .catch((err: any) => console.log("[PublicController] Background startup heartbeat ping:", err?.message || err));
      }

      return res.status(200).json({
        success: true,
        data: {
          eligible: result.eligible,
          codeStatus: result.status,
          brandName: settings.brandName,
          requiresSmsNotice: result.requiresSmsNotice,
          smsNotice: result.smsNotice,
          smsConfigured: result.smsConfigured,
          smsGatewayUrl: result.smsGatewayUrl,
          smsStartupHeartbeatUrl: result.smsStartupHeartbeatUrl,
          message: result.eligible
            ? "Access code is active and eligible."
            : `This access code is ${result.status.toLowerCase()}.`,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  sendStartupHeartbeat = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = String(req.params.token || "");
      if (!token || token.length < 10) {
        throw new ValidationError("Invalid or missing access token.");
      }

      const result = await this.tokenService.getStatusByToken(token);
      if (!result.smsConfigured || !result.smsStartupHeartbeatUrl) {
        return res.status(200).json({
          success: true,
          data: {
            ready: false,
            message: "SMS gateway is not configured for this code.",
          },
        });
      }

      try {
        const heartbeatRes = await fetch(result.smsStartupHeartbeatUrl, {
          method: "GET",
          signal: AbortSignal.timeout(4000),
        });

        const isReady = heartbeatRes.ok;
        return res.status(200).json({
          success: true,
          data: {
            ready: isReady,
            status: heartbeatRes.status,
            message: isReady ? "SMS service is ready." : `Gateway responded with status ${heartbeatRes.status}`,
          },
        });
      } catch (err: any) {
        return res.status(200).json({
          success: true,
          data: {
            ready: false,
            message: `Heartbeat ping pending/warming up: ${err?.message || "timeout"}`,
          },
        });
      }
    } catch (err) {
      next(err);
    }
  };

  redeemCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = String(req.params.token || "");
      if (!token || token.length < 10) {
        throw new ValidationError("Invalid or missing access token.");
      }

      const input = {
        fullName: req.body.fullName,
        phoneNumber: req.body.phoneNumber,
        email: req.body.email || undefined,
        organization: req.body.organization || undefined,
        role: req.body.role || undefined,
        profileUrl: req.body.profileUrl || undefined,
        discussionNotes: req.body.discussionNotes || undefined,
      };

      const imageBuffer = req.file ? req.file.buffer : null;

      const result = await this.redemptionService.redeem({
        token,
        input,
        imageBuffer,
      });

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
