import { prisma, type Prisma } from "@connectme/database";
import { TokenService } from "./token.service";
import { ImageService } from "./image.service";
import { ContactSubmissionSchema, ContactSubmissionInput, SubmissionSuccessResponse } from "@connectme/contracts";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  GoneError,
} from "../errors/app-error";

export class RedemptionService {
  constructor(
    private tokenService = new TokenService(),
    private imageService = new ImageService()
  ) {}

  async redeem(options: {
    token: string;
    input: ContactSubmissionInput;
    imageBuffer?: Buffer | null;
  }): Promise<SubmissionSuccessResponse> {
    // Step 1: Validate input
    const parsed = ContactSubmissionSchema.safeParse(options.input);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => e.message).join(", ")
      );
    }
    const cleanData = parsed.data;

    // Step 2: Normalize image before transaction (if present)
    let processedImage: { buffer: Buffer; mime: string; size: number } | null = null;
    if (options.imageBuffer && options.imageBuffer.length > 0) {
      processedImage = await this.imageService.process(options.imageBuffer);
    }

    const tokenHash = this.tokenService.hashToken(options.token);

    // Step 3: Authoritative atomic transaction via Prisma
    const submission = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Conditional atomic transition: ACTIVE -> CONSUMED
      const updated = await tx.accessCode.updateMany({
        where: {
          tokenHash,
          status: "ACTIVE",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        data: {
          status: "CONSUMED",
          consumedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        // Detailed check for exact domain error code
        const existing = await tx.accessCode.findUnique({
          where: { tokenHash },
        });

        if (!existing) {
          throw new NotFoundError("Access code is invalid or unrecognized.", "TOKEN_NOT_FOUND");
        }
        if (existing.status === "CONSUMED") {
          throw new ConflictError("This access code has already been used.", "ALREADY_CONSUMED");
        }
        if (existing.status === "REVOKED") {
          throw new GoneError("This access link is no longer available.", "TOKEN_REVOKED");
        }
        if (existing.expiresAt && existing.expiresAt <= new Date()) {
          throw new GoneError("This access link has expired.", "TOKEN_EXPIRED");
        }

        throw new ConflictError(
          "This access code was just redeemed by another request.",
          "CONCURRENT_CONFLICT"
        );
      }

      const code = await tx.accessCode.findUniqueOrThrow({
        where: { tokenHash },
      });

      // Insert contact submission
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

      // Insert binary image into separate one-to-one table if attached
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

      return sub;
    });

    return {
      success: true,
      message: "Thank you for sharing your contact details.",
      submittedAt: submission.submittedAt.toISOString(),
    };
  }
}
