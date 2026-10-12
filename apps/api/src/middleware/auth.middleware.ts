import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { UnauthorizedError } from "../errors/app-error";
import { AdminUserDTO } from "@connectme/contracts";

declare global {
  namespace Express {
    interface Request {
      adminUser?: AdminUserDTO;
    }
  }
}

const authService = new AuthService();

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  let sessionPayload: { userId: string; username: string } | null = null;

  // 1. Check Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    sessionPayload = await authService.verifyMobileToken(token);
  }

  // 2. Check HTTP-only cookie
  if (!sessionPayload && req.cookies?.connectme_session) {
    sessionPayload = await authService.verifyWebSession(req.cookies.connectme_session);
  }

  if (!sessionPayload) {
    return next(new UnauthorizedError("Authentication required.", "UNAUTHORIZED"));
  }

  const user = await authService.getUserById(sessionPayload.userId);
  if (!user || !user.isActive) {
    return next(new UnauthorizedError("Administrator account is inactive or not found."));
  }

  req.adminUser = user;
  next();
}
