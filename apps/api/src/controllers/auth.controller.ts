import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { config } from "../config/env";
import { normalizeOrigin } from "../config/origin";

const isMobileClient = (req: Request) => req.get("x-connectme-client") === "mobile";
const accessCookie = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 72 * 60 * 60 * 1000,
  path: "/",
};
const refreshCookie = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

export class AuthController {
  constructor(private authService = new AuthService()) {}

  private setCookies(res: Response, result: { webSession: string; refreshToken: string }) {
    res.cookie("connectme_session", result.webSession, accessCookie);
    res.cookie("connectme_refresh", result.refreshToken, refreshCookie);
  }

  private authResponse(req: Request, res: Response, result: {
    user: unknown; token: string; webSession: string; refreshToken: string;
  }, statusCode = 200) {
    this.setCookies(res, result);
    return res.status(statusCode).json({
      success: true,
      data: {
        user: result.user,
        // Browser sessions use HTTP-only cookies; never expose bearer credentials to browser JavaScript.
        ...(isMobileClient(req) ? { token: result.token, refreshToken: result.refreshToken } : {}),
      },
    });
  }

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.register(req.body);
      return this.authResponse(req, res, result, 201);
    } catch (err) { next(err); }
  };

  getBootstrapStatus = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      return res.status(200).json({ success: true, data: await this.authService.getBootstrapStatus() });
    } catch (err) { next(err); }
  };

  setupBootstrap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const publicOrigin = normalizeOrigin(req.get("x-connectme-public-origin")) ?? undefined;
      const result = await this.authService.setupBootstrap(req.body, publicOrigin);
      return this.authResponse(req, res, result);
    } catch (err) { next(err); }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return this.authResponse(req, res, await this.authService.login(req.body));
    } catch (err) { next(err); }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = String(req.body?.refreshToken || req.cookies?.connectme_refresh || "");
      return this.authResponse(req, res, await this.authService.refresh(refreshToken));
    } catch (err) { next(err); }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.authService.revokeRefreshToken(String(req.body?.refreshToken || req.cookies?.connectme_refresh || ""));
      res.clearCookie("connectme_session", { ...accessCookie, maxAge: undefined });
      res.clearCookie("connectme_refresh", { ...refreshCookie, maxAge: undefined });
      return res.status(200).json({ success: true, data: { message: "Successfully logged out." } });
    } catch (err) {
      next(err);
    }
  };

  checkUsername = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return res.status(200).json({ success: true, data: await this.authService.checkUsername(req.body.username) });
    } catch (err) { next(err); }
  };

  createAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const admin = await this.authService.createAdmin(req.adminUser!.id, req.body);
      return res.status(201).json({ success: true, data: { user: admin } });
    } catch (err) { next(err); }
  };

  listAdmins = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const admins = await this.authService.listAdmins();
      return res.status(200).json({ success: true, data: admins });
    } catch (err) { next(err); }
  };

  getMe = async (req: Request, res: Response) => {
    return res.status(200).json({ success: true, data: { user: req.adminUser } });
  };
}
