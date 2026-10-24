import { prisma, type Prisma } from "@connectme/database";
import { TokenService } from "./token.service";
import { ImageService } from "./image.service";
import { SmsService, DEFAULT_SMS_TEMPLATE, renderSmsTemplate } from "./sms.service";
import { decryptPassword } from "../lib/sms-crypto";
import { ContactSubmissionSchema, ContactSubmissionInput, SubmissionSuccessResponse } from "@connectme/contracts";
import { ValidationError, NotFoundError, ConflictError, GoneError } from "../errors/app-error";

export class RedemptionService {
  constructor(
    private tokenService = new TokenService(),
    private imageService = new ImageService(),
    private smsService = new SmsService()
  ) {}

  async redeem(options: {
    token: string;
    input: ContactSubmissionInput;
    imageBuffer?: Buffer | null;
  }): Promise<SubmissionSuccessResponse> {
    const parsed = ContactSubmissionSchema.safeParse(options.input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(", "));
    }
    const cleanData = parsed.data;

    let processedImage: { buffer: Buffer; mime: string; size: number } | null = null;
    if (options.imageBuffer && options.imageBuffer.length > 0) {
      processedImage = await this.imageService.process(options.imageBuffer);
    }

    const tokenHashes = this.tokenService.tokenHashCandidates(options.token);
    const tokenFilter = {
      OR: [
        { token: options.token },
        { tokenHash: { in: tokenHashes } },
      ],
    };
    const { sub: submission, admin } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.accessCode.updateMany({
        where: {
          AND: [
            tokenFilter,
            { status: "ACTIVE" },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          ],
        },
        data: { status: "CONSUMED", consumedAt: new Date() },
      });

      if (updated.count === 0) {
        const existing = await tx.accessCode.findFirst({ where: tokenFilter });
        if (!existing) throw new NotFoundError("Access code is invalid or unrecognized.", "TOKEN_NOT_FOUND");
        if (existing.status === "CONSUMED") throw new ConflictError("This access code has already been used.", "ALREADY_CONSUMED");
        if (existing.status === "REVOKED") throw new GoneError("This access link is no longer available.", "TOKEN_REVOKED");
        if (existing.expiresAt && existing.expiresAt <= new Date()) throw new GoneError("This access link has expired.", "TOKEN_EXPIRED");
        throw new ConflictError("This access code was just redeemed by another request.", "CONCURRENT_CONFLICT");
      }

      const code = await tx.accessCode.findFirstOrThrow({
        where: tokenFilter,
        include: { createdByAdmin: true },
      });
      const sub = await tx.contactSubmission.create({
        data: {
          accessCodeId: code.id,
          fullName: cleanData.fullName,
          phoneNumber: cleanData.phoneNumber,
          email: cleanData.email || null,
          organization: cleanData.organization || null,
          role: cleanData.role || null,
          profileUrl: cleanData.profileUrl || null,
          discussionNotes: cleanData.discussionNotes || null,
        },
      });

      if (processedImage) {
        await tx.submissionImage.create({
          data: {
            contactSubmissionId: sub.id,
            profileImage: new Uint8Array(processedImage.buffer),
            mime: processedImage.mime,
            size: processedImage.size,
          },
        });
      }
      return { sub, admin: code.createdByAdmin };
    });

    // Auto-trigger SMS via configured SMS Gateway if admin enabled it
    if (
      admin &&
      admin.smsEnabled &&
      admin.smsGatewayUrl &&
      admin.smsGatewayUsername &&
      admin.smsGatewayPassword
    ) {
      const password = decryptPassword(admin.smsGatewayPassword);
      if (password) {
        const template = admin.smsTemplate?.trim() || DEFAULT_SMS_TEMPLATE;
        const message = renderSmsTemplate(template, {
          fullName: cleanData.fullName,
          phoneNumber: cleanData.phoneNumber,
          email: cleanData.email,
          organization: cleanData.organization,
          role: cleanData.role,
          adminName: admin.displayName || admin.username,
          adminPhone: admin.smsSenderPhone || undefined,
          adminEmail: admin.smsSenderEmail || undefined,
        });

        // Trigger asynchronously to not hold up or fail the visitor submission response
        this.smsService
          .sendContactSms({
            gatewayUrl: admin.smsGatewayUrl,
            username: admin.smsGatewayUsername,
            password,
            recipientPhone: cleanData.phoneNumber,
            message,
          })
          .catch((err) => {
            console.error("[RedemptionService] Failed to trigger SMS dispatch:", err);
          });
      }
    }

    return {
      success: true,
      message: "Thank you for sharing your contact details.",
      submittedAt: submission.submittedAt.toISOString(),
    };
  }
}
