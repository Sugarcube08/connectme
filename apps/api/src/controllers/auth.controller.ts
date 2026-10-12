import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { config } from "../config/env";

export class AuthController {
  constructor(private authService = new AuthService()) {}

  getBootstrapStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await this.authService.getBootstrapStatus();
      return res.status(200).json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  };

  setupBootstrap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.setupBootstrap(req.body);

      // Set HTTP-only session cookie for browser
      res.cookie("connectme_session", result.webSession, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 3600 * 1000,
        path: "/",
      });

      return res.status(200).json({
        success: true,
        data: {
          user: result.user,
          token: result.token,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.login(req.body);

      res.cookie("connectme_session", result.webSession, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 3600 * 1000,
        path: "/",
      });

      return res.status(200).json({
        success: true,
        data: {
          user: result.user,
          token: result.token,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response) => {
    res.clearCookie("connectme_session", {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      data: { message: "Successfully logged out." },
    });
  };

  getMe = async (req: Request, res: Response) => {
    return res.status(200).json({
      success: true,
      data: { user: req.adminUser },
    });
  };
}
