import crypto from "crypto";
import { prisma } from "@connectme/database";

export class OtpRepository {
  private hashOtp(otp: string): string {
    const salt = process.env.SESSION_SECRET || process.env.JWT_SECRET || "connectme-otp-salt";
    return crypto.createHash("sha256").update(`${otp}:${salt}`).digest("hex");
  }

  /**
   * Invalidates any pending OTPs for the email and creates a new one.
   */
  async createOtp(email: string, otp: string, ttlMinutes = 10): Promise<{ id: string; expiresAt: Date }> {
    const normalizedEmail = email.trim().toLowerCase();
    const otpHash = this.hashOtp(otp.trim());
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    // Invalidate existing active OTPs for this email
    await prisma.emailOtp.updateMany({
      where: {
        email: normalizedEmail,
        consumed: false,
      },
      data: {
        consumed: true,
      },
    });

    const record = await prisma.emailOtp.create({
      data: {
        email: normalizedEmail,
        otpHash,
        expiresAt,
        consumed: false,
      },
    });

    return {
      id: record.id,
      expiresAt: record.expiresAt,
    };
  }

  /**
   * Verifies an OTP for the email. If valid, marks it as consumed and returns true.
   */
  async verifyOtp(email: string, otp: string): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();
    const expectedHash = this.hashOtp(cleanOtp);
    const now = new Date();

    const record = await prisma.emailOtp.findFirst({
      where: {
        email: normalizedEmail,
        consumed: false,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!record) {
      return false;
    }

    if (record.otpHash !== expectedHash) {
      return false;
    }

    // Consume the OTP
    await prisma.emailOtp.update({
      where: { id: record.id },
      data: { consumed: true },
    });

    return true;
  }
}
