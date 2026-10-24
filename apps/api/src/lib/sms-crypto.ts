import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "../config/env";

// Derive a 256-bit encryption key from SESSION_SECRET
const KEY = createHash("sha256").update(config.SESSION_SECRET).digest();
const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";

export function encryptPassword(plainText: string): string {
  if (!plainText) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptPassword(cipherText: string | null | undefined): string {
  if (!cipherText || !cipherText.startsWith(PREFIX)) return "";
  try {
    const parts = cipherText.slice(PREFIX.length).split(":");
    if (parts.length !== 3) return "";

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString("utf8");
  } catch (err) {
    console.error("[Crypto] Failed to decrypt password:", err);
    return "";
  }
}
