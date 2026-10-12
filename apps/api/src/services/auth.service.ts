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
    const pending = await this.userRepo.findPendingBootstrap();
    if (!pending) {
      return { isBootstrapPending: false };
    }

    const hasExpired =
      !!pending.bootstrapExpiresAt && pending.bootstrapExpiresAt < new Date();

    return {
      isBootstrapPending: true,
      username: pending.username,
      hasExpired,
    };
  }

  async setupBootstrap(
    input: BootstrapSetupInput
  ): Promise<{ user: AdminUserDTO; token: string; webSession: string }> {
    const tokenHash = createHash("sha256").update(input.token.trim()).digest("hex");
    const pendingUser = await this.userRepo.findByBootstrapTokenHash(tokenHash);

    if (!pendingUser) {
      throw new UnauthorizedError(
        "Invalid or unrecognized one-time bootstrap token.",
        "INVALID_BOOTSTRAP_TOKEN"
      );
    }

    if (!pendingUser.isBootstrapPending) {
      throw new ForbiddenError(
        "Administrator account has already been bootstrapped. Setup is permanently locked.",
        "BOOTSTRAP_ALREADY_COMPLETED"
      );
    }

    if (
      pendingUser.bootstrapExpiresAt &&
      pendingUser.bootstrapExpiresAt < new Date()
    ) {
      throw new GoneError(
        "Bootstrap setup token has expired. Please run deployment provisioning again.",
        "BOOTSTRAP_TOKEN_EXPIRED"
      );
    }

    if (pendingUser.username !== input.username.toLowerCase().trim()) {
      throw new ValidationError(
        `Username mismatch. Configured administrator username is "${pendingUser.username}".`
      );
    }

    // Hash password securely with bcrypt
    const passwordHash = await bcrypt.hash(input.password, 12);

    const activatedUser = await this.userRepo.completeBootstrap({
      userId: pendingUser.id,
      passwordHash,
      displayName: input.displayName,
    });

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
      return {
        userId: payload.userId as string,
        username: payload.username as string,
      };
    } catch {
      return null;
    }
  }

  async verifyMobileToken(token: string): Promise<{ userId: string; username: string } | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      return {
        userId: payload.userId as string,
        username: payload.username as string,
      };
    } catch {
      return null;
    }
  }

  async getUserById(id: string): Promise<AdminUserDTO | null> {
    const user = await this.userRepo.findById(id);
    return user ? serializeAdminUser(user) : null;
  }
}
