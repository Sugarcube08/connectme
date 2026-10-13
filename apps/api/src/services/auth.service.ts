import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { UserRepository } from "../repositories/user.repository";
import { config } from "../config/env";
import { serializeAdminUser } from "../serializers";
import {
  AdminLoginInput,
  BootstrapSetupInput,
  BootstrapStatusDTO,
  AdminUserDTO,
} from "@connectme/contracts";
import {
  UnauthorizedError,
  ValidationError,
  ForbiddenError,
  GoneError,
} from "../errors/app-error";

export class AuthService {
  private sessionSecret = new TextEncoder().encode(config.SESSION_SECRET);
  private jwtSecret = new TextEncoder().encode(config.JWT_SECRET);

  constructor(private userRepo = new UserRepository()) {}

  async getBootstrapStatus(): Promise<BootstrapStatusDTO> {
    // Even a stale pending row must not make setup appear open once an admin exists.
    if (await this.userRepo.findActiveAdmin()) {
      return { isBootstrapPending: false };
    }

    const pending = await this.userRepo.findPendingBootstrap();
    if (!pending) return { isBootstrapPending: false };

    const hasExpired = !pending.bootstrapExpiresAt || pending.bootstrapExpiresAt < new Date();
    return {
      isBootstrapPending: true,
      hasExpired,
    };
  }

  async setupBootstrap(
    input: BootstrapSetupInput,
    publicOrigin?: string
  ): Promise<{ user: AdminUserDTO; token: string; webSession: string }> {
    if (await this.userRepo.findActiveAdmin()) {
      throw new ForbiddenError(
        "Administrator setup is already complete and cannot be reopened.",
        "BOOTSTRAP_ALREADY_COMPLETED"
      );
    }

    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
      throw new ValidationError("Username must be 3–32 characters and use only letters, numbers, dots, underscores, or hyphens.");
    }

    const tokenHash = createHash("sha256").update(input.token.trim()).digest("hex");
    const pendingUser = await this.userRepo.findByBootstrapTokenHash(tokenHash);
    if (!pendingUser || !pendingUser.isBootstrapPending || pendingUser.isActive) {
      throw new UnauthorizedError(
        "Invalid, consumed, or unrecognized one-time bootstrap token.",
        "INVALID_BOOTSTRAP_TOKEN"
      );
    }

    if (!pendingUser.bootstrapExpiresAt || pendingUser.bootstrapExpiresAt < new Date()) {
      throw new GoneError(
        "Bootstrap setup token has expired. An authorized operator must provision a new token.",
        "BOOTSTRAP_TOKEN_EXPIRED"
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    let activatedUser;
    try {
      activatedUser = await this.userRepo.completeBootstrap({
        userId: pendingUser.id,
        tokenHash,
        username,
        passwordHash,
        displayName: input.displayName,
        publicOrigin,
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new ValidationError("That username is unavailable. Choose another username.");
      }
      throw error;
    }

    if (!activatedUser) {
      throw new ForbiddenError(
        "This setup token has already been consumed or setup is no longer available.",
        "BOOTSTRAP_ALREADY_COMPLETED"
      );
    }

    const userDTO = serializeAdminUser(activatedUser);
    const token = await this.createMobileToken(userDTO.id, userDTO.username);
    const webSession = await this.createWebSession(userDTO.id, userDTO.username);
    return { user: userDTO, token, webSession };
  }

  async login(
    input: AdminLoginInput
  ): Promise<{ user: AdminUserDTO; token: string; webSession: string }> {
    const user = await this.userRepo.findByUsername(input.username);

    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedError("Invalid username or password.", "INVALID_CREDENTIALS");
    }

    const match = await bcrypt.compare(input.password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedError("Invalid username or password.", "INVALID_CREDENTIALS");
    }

    const userDTO = serializeAdminUser(user);
    const token = await this.createMobileToken(userDTO.id, userDTO.username);
    const webSession = await this.createWebSession(userDTO.id, userDTO.username);
    return { user: userDTO, token, webSession };
  }

  async createWebSession(userId: string, username: string): Promise<string> {
    return new SignJWT({ userId, username })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(this.sessionSecret);
  }

  async createMobileToken(userId: string, username: string): Promise<string> {
    return new SignJWT({ userId, username })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(this.jwtSecret);
  }

  async verifyWebSession(token: string): Promise<{ userId: string; username: string } | null> {
    try {
      const { payload } = await jwtVerify(token, this.sessionSecret);
      return { userId: payload.userId as string, username: payload.username as string };
    } catch {
      return null;
    }
  }

  async verifyMobileToken(token: string): Promise<{ userId: string; username: string } | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      return { userId: payload.userId as string, username: payload.username as string };
    } catch {
      return null;
    }
  }

  async getUserById(id: string): Promise<AdminUserDTO | null> {
    const user = await this.userRepo.findById(id);
    return user ? serializeAdminUser(user) : null;
  }
}
