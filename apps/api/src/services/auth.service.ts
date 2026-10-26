import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@connectme/database";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { UserRepository } from "../repositories/user.repository";
import { config } from "../config/env";
import { serializeAdminUser } from "../serializers";
import { EmailService } from "./email.service";
import { OtpRepository } from "../repositories/otp.repository";
import {
  AdminLoginInput,
  RegisterInput,
  BootstrapSetupInput,
  BootstrapStatusDTO,
  AdminUserDTO,
  CheckUsernameDTO,
} from "@connectme/contracts";
import {
  UnauthorizedError,
  ValidationError,
  ForbiddenError,
  ConflictError,
  OtpError,
  GoneError,
} from "../errors/app-error";

const REFRESH_TOKEN_SECONDS = 7 * 24 * 60 * 60;

type AuthSessionResult = {
  user: AdminUserDTO;
  token: string;
  webSession: string;
  refreshToken: string;
};

export type RegisterResult =
  | AuthSessionResult
  | { requiresOtp: true; email: string; message: string };

export class AuthService {
  private sessionSecret = new TextEncoder().encode(config.SESSION_SECRET);
  private jwtSecret = new TextEncoder().encode(config.JWT_SECRET);

  constructor(
    private userRepo = new UserRepository(),
    private emailService = new EmailService(),
    private otpRepo = new OtpRepository()
  ) {}

  async checkUsername(rawUsername: string): Promise<CheckUsernameDTO> {
    const username = rawUsername.trim().toLowerCase();
    const user = await this.userRepo.findByUsername(username);
    if (!user) {
      return { exists: false };
    }
    const needsSetup = Boolean(user.isInitialAdmin && (user.isBootstrapPending || !user.passwordHash));
    return {
      exists: true,
      isInitialAdmin: Boolean(user.isInitialAdmin),
      needsSetup,
      displayName: user.displayName || undefined,
    };
  }

  async getBootstrapStatus(): Promise<BootstrapStatusDTO> {
    const pendingInitial = await this.userRepo.findPendingInitialAdmin();
    const pendingBootstrap = await this.userRepo.findPendingBootstrap();

    if (pendingInitial || pendingBootstrap) {
      return {
        isBootstrapPending: true,
        hasExpired: pendingBootstrap?.bootstrapExpiresAt ? pendingBootstrap.bootstrapExpiresAt < new Date() : false,
      };
    }

    const active = await this.userRepo.findActiveAdmin();
    if (active) return { isBootstrapPending: false };
    return { isBootstrapPending: false };
  }

  async setupBootstrap(input: BootstrapSetupInput, publicOrigin?: string): Promise<AuthSessionResult> {
    const pendingInitial = await this.userRepo.findPendingInitialAdmin();
    const pendingBootstrap = await this.userRepo.findPendingBootstrap();
    if (!pendingInitial && !pendingBootstrap) {
      throw new ForbiddenError("Administrator setup is already complete and cannot be reopened.", "BOOTSTRAP_ALREADY_COMPLETED");
    }

    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
      throw new ValidationError("Username must be 3–32 characters and use only letters, numbers, dots, underscores, or hyphens.");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    // If a token was provided, verify and consume the token (legacy token flow)
    if (input.token?.trim()) {
      const tokenHash = createHash("sha256").update(input.token.trim()).digest("hex");
      const pendingUser = await this.userRepo.findByBootstrapTokenHash(tokenHash);
      if (!pendingUser || !pendingUser.isBootstrapPending || pendingUser.isActive) {
        throw new UnauthorizedError("Invalid, consumed, or unrecognized one-time bootstrap token.", "INVALID_BOOTSTRAP_TOKEN");
      }
      if (pendingUser.bootstrapExpiresAt && pendingUser.bootstrapExpiresAt < new Date()) {
        throw new GoneError("Bootstrap setup token has expired. An authorized operator must provision a new token.", "BOOTSTRAP_TOKEN_EXPIRED");
      }

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
        throw new ForbiddenError("This setup token has already been consumed or setup is no longer available.", "BOOTSTRAP_ALREADY_COMPLETED");
      }
      return this.createAuthSession(serializeAdminUser(activatedUser));
    }

    // Direct initial admin setup by username
    const existingUser = await this.userRepo.findByUsername(username);
    if (!existingUser) {
      throw new UnauthorizedError("Administrator account not found.", "INVALID_ADMIN");
    }
    if (existingUser.isInitialAdmin !== true) {
      throw new ForbiddenError("Only the initial administrator account can be initialized via direct setup.", "SETUP_NOT_ALLOWED");
    }
    if (!existingUser.isBootstrapPending && existingUser.passwordHash) {
      throw new ForbiddenError("Administrator setup is already complete and cannot be reopened.", "BOOTSTRAP_ALREADY_COMPLETED");
    }

    let activatedUser;
    try {
      activatedUser = await this.userRepo.completeInitialAdminSetup({
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
      throw new ForbiddenError("Initial administrator setup could not be completed.", "BOOTSTRAP_FAILED");
    }

    return this.createAuthSession(serializeAdminUser(activatedUser));
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new ConflictError("An account with this email address already exists. Please sign in.", "EMAIL_ALREADY_EXISTS");
    }

    const isOtpRequired = this.emailService.isOtpVerificationEnabled();

    // If OTP verification pipeline is active on the server
    if (isOtpRequired) {
      if (!input.otp) {
        // Step 1: User requested registration without OTP -> Generate OTP and send email
        const otp = this.emailService.generateOtp();
        await this.otpRepo.createOtp(email, otp, 10);
        await this.emailService.sendOtpEmail({
          to: email,
          otp,
          recipientName: input.name.trim(),
        });

        return {
          requiresOtp: true,
          email,
          message: "A 6-digit verification code has been sent to your email address.",
        };
      }

      // Step 2: User submitted registration with OTP -> Verify OTP
      const isValid = await this.otpRepo.verifyOtp(email, input.otp);
      if (!isValid) {
        throw new OtpError("Invalid or expired verification code. Please request a new code.", "INVALID_OTP");
      }
    }

    // Determine or generate unique username
    let username = input.username?.trim().toLowerCase();
    if (!username) {
      const emailPrefix = email.split("@")[0].replace(/[^a-z0-9]/g, "").slice(0, 20);
      username = emailPrefix.length >= 3 ? emailPrefix : `user${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Ensure username uniqueness
    let attempt = 0;
    let finalUsername = username;
    while (await this.userRepo.findByUsername(finalUsername)) {
      attempt++;
      finalUsername = `${username}${Math.floor(100 + Math.random() * 900)}`;
      if (attempt > 10) {
        finalUsername = `${username}${Date.now().toString().slice(-4)}`;
        break;
      }
    }

    const phoneNumber = (input.number || input.phoneNumber)?.trim();
    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await this.userRepo.registerUser({
      username: finalUsername,
      displayName: input.name.trim(),
      email,
      phoneNumber,
      passwordHash,
    });

    return this.createAuthSession(serializeAdminUser(user));
  }

  async resendOtp(rawEmail: string): Promise<{ message: string }> {
    const email = rawEmail.trim().toLowerCase();
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new ConflictError("An account with this email address already exists. Please sign in.", "EMAIL_ALREADY_EXISTS");
    }

    if (!this.emailService.isOtpVerificationEnabled()) {
      throw new ValidationError("OTP verification is not active on this server.", "OTP_NOT_ACTIVE");
    }

    const otp = this.emailService.generateOtp();
    await this.otpRepo.createOtp(email, otp, 10);
    await this.emailService.sendOtpEmail({
      to: email,
      otp,
    });

    return {
      message: "A new verification code has been dispatched to your email address.",
    };
  }

  async login(input: AdminLoginInput): Promise<AuthSessionResult> {
    const user = await this.userRepo.findByUsernameOrEmail(input.username);
    if (!user || !user.isActive || !user.passwordHash || user.isBootstrapPending) {
      throw new UnauthorizedError("Invalid username or password.", "INVALID_CREDENTIALS");
    }
    const match = await bcrypt.compare(input.password, user.passwordHash);
    if (!match) throw new UnauthorizedError("Invalid username or password.", "INVALID_CREDENTIALS");
    return this.createAuthSession(serializeAdminUser(user));
  }

  private async createAuthSession(user: AdminUserDTO): Promise<AuthSessionResult> {
    const token = await this.createMobileToken(user.id, user.username);
    const webSession = await this.createWebSession(user.id, user.username);
    const refreshToken = await this.createRefreshToken(user.id);
    return { user, token, webSession, refreshToken };
  }

  async createWebSession(userId: string, username: string): Promise<string> {
    return new SignJWT({ userId, username, tokenUse: "web_access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("72h")
      .sign(this.sessionSecret);
  }

  async createMobileToken(userId: string, username: string): Promise<string> {
    return new SignJWT({ userId, username, tokenUse: "mobile_access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("72h")
      .sign(this.jwtSecret);
  }

  async verifyWebSession(token: string): Promise<{ userId: string; username: string } | null> {
    try {
      const { payload } = await jwtVerify(token, this.sessionSecret);
      if (payload.tokenUse !== "web_access" || typeof payload.userId !== "string" || typeof payload.username !== "string") return null;
      return { userId: payload.userId, username: payload.username };
    } catch { return null; }
  }

  async verifyMobileToken(token: string): Promise<{ userId: string; username: string } | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      if (payload.tokenUse !== "mobile_access" || typeof payload.userId !== "string" || typeof payload.username !== "string") return null;
      return { userId: payload.userId, username: payload.username };
    } catch { return null; }
  }

  private async createRefreshToken(adminUserId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await prisma.adminRefreshToken.create({
      data: {
        adminUserId,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_SECONDS * 1000),
      },
    });
    return token;
  }

  async refresh(rawToken: string): Promise<AuthSessionResult> {
    if (!rawToken?.trim()) throw new UnauthorizedError("Refresh token is required.", "INVALID_REFRESH_TOKEN");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const rotation = await this.rotateRefreshToken(tokenHash);
    if (rotation.kind !== "success") {
      throw new UnauthorizedError("Refresh token is invalid, expired, revoked, or already used. Sign in again.", "INVALID_REFRESH_TOKEN");
    }
    return this.createRotatedSession(rotation.user, rotation.refreshToken);
  }

  private async createRotatedSession(
    user: AdminUserDTO,
    refreshToken: string
  ): Promise<AuthSessionResult> {
    return {
      user,
      token: await this.createMobileToken(user.id, user.username),
      webSession: await this.createWebSession(user.id, user.username),
      refreshToken,
    };
  }

  private async rotateRefreshToken(tokenHash: string): Promise<
    { kind: "success"; user: AdminUserDTO; refreshToken: string } | { kind: "invalid" }
  > {
    try {
      return await prisma.$transaction(async (tx) => {
        const record = await tx.adminRefreshToken.findUnique({
          where: { tokenHash },
          include: { adminUser: true },
        });
        if (!record) return { kind: "invalid" } as const;

        const now = new Date();
        if (record.revokedAt) {
          // A revoked token presented again indicates possible theft/replay. Revoke
          // every still-active refresh token for this account.
          await tx.adminRefreshToken.updateMany({
            where: { adminUserId: record.adminUserId, revokedAt: null },
            data: { revokedAt: now },
          });
          return { kind: "invalid" } as const;
        }
        if (record.expiresAt <= now || !record.adminUser.isActive) {
          await tx.adminRefreshToken.updateMany({
            where: { id: record.id, revokedAt: null },
            data: { revokedAt: now },
          });
          if (!record.adminUser.isActive) {
            await tx.adminRefreshToken.updateMany({
              where: { adminUserId: record.adminUserId, revokedAt: null },
              data: { revokedAt: now },
            });
          }
          return { kind: "invalid" } as const;
        }

        const consumed = await tx.adminRefreshToken.updateMany({
          where: { id: record.id, revokedAt: null, expiresAt: { gt: now } },
          data: { revokedAt: now },
        });
        if (consumed.count !== 1) {
          await tx.adminRefreshToken.updateMany({
            where: { adminUserId: record.adminUserId, revokedAt: null },
            data: { revokedAt: now },
          });
          return { kind: "invalid" } as const;
        }

        const nextToken = randomBytes(32).toString("base64url");
        await tx.adminRefreshToken.create({
          data: {
            adminUserId: record.adminUserId,
            tokenHash: createHash("sha256").update(nextToken).digest("hex"),
            expiresAt: new Date(now.getTime() + REFRESH_TOKEN_SECONDS * 1000),
          },
        });
        return { kind: "success", user: serializeAdminUser(record.adminUser), refreshToken: nextToken } as const;
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
        return { kind: "invalid" };
      }
      throw error;
    }
  }

  async revokeRefreshToken(rawToken?: string): Promise<void> {
    if (!rawToken?.trim()) return;
    await prisma.adminRefreshToken.updateMany({
      where: { tokenHash: createHash("sha256").update(rawToken).digest("hex"), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getUserById(id: string): Promise<AdminUserDTO | null> {
    const user = await this.userRepo.findById(id);
    return user ? serializeAdminUser(user) : null;
  }
}
