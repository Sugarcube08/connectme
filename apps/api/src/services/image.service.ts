import sharp from "sharp";
import { ValidationError } from "../errors/app-error";
import { config } from "../config/env";

export interface ProcessedImage {
  buffer: Buffer;
  mime: string;
  size: number;
}

export class ImageService {
  async process(inputBuffer: Buffer): Promise<ProcessedImage> {
    if (inputBuffer.length > config.MAX_IMAGE_SIZE_BYTES) {
      throw new ValidationError(
        `Image exceeds maximum allowed size of ${config.MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB`
      );
    }

    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(inputBuffer).metadata();
    } catch {
      throw new ValidationError("Invalid or unreadable image file.");
    }

    const supported = ["jpeg", "png", "webp"];
    if (!metadata.format || !supported.includes(metadata.format)) {
      throw new ValidationError(
        `Unsupported image format (${metadata.format || "unknown"}). Only JPEG, PNG, and WebP are allowed.`
      );
    }

    const processedBuffer = await sharp(inputBuffer)
      .rotate()
      .resize(1000, 1000, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    return {
      buffer: processedBuffer,
      mime: "image/webp",
      size: processedBuffer.length,
    };
  }
}
