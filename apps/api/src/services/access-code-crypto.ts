import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const AAD = Buffer.from("connectme/access-code-token/v1", "utf8");

function getEncryptionKey(): Buffer {
  // Environment validation requires exactly 32 bytes encoded as 64 hex chars.
  return Buffer.from(config.ACCESS_CODE_ENCRYPTION_KEY, "hex");
}

/**
 * Encrypt a redeem token for owner-authorized reprinting. The DB stores this
 * authenticated-encryption envelope separately from the one-way HMAC digest.
 * A database-only compromise cannot recover tokens without the runtime key.
 */
export function encryptAccessCodeToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

/**
 * Decrypts only after the caller has verified code ownership and state.
 * Throws on malformed, unsupported, or modified envelopes (GCM integrity check).
 */
export function decryptAccessCodeToken(envelope: string): string {
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Unsupported access-code encryption envelope.");
  }

  const iv = Buffer.from(parts[1], "base64url");
  const ciphertext = Buffer.from(parts[2], "base64url");
  const tag = Buffer.from(parts[3], "base64url");
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error("Malformed access-code encryption envelope.");
  }

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
