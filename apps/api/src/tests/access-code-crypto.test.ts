import { describe, expect, it } from "vitest";
import { decryptAccessCodeToken, encryptAccessCodeToken } from "../services/access-code-crypto";

describe("access-code token encryption", () => {
  it("round-trips tokens without storing plaintext", () => {
    const token = "test-redeem-token-that-must-stay-private";
    const envelope = encryptAccessCodeToken(token);

    expect(envelope).not.toContain(token);
    expect(envelope.split(".")).toHaveLength(4);
    expect(decryptAccessCodeToken(envelope)).toBe(token);
  });

  it("uses a fresh nonce for each encryption of the same token", () => {
    const token = "repeat-token";
    const one = encryptAccessCodeToken(token);
    const two = encryptAccessCodeToken(token);

    expect(one).not.toBe(two);
    expect(decryptAccessCodeToken(one)).toBe(token);
    expect(decryptAccessCodeToken(two)).toBe(token);
  });

  it("rejects modified ciphertext and malformed envelopes", () => {
    const envelope = encryptAccessCodeToken("do-not-tamper");
    const [version, iv, ciphertext, tag] = envelope.split(".");
    const replacement = ciphertext.startsWith("A") ? "B" : "A";
    expect(() => decryptAccessCodeToken([version, iv, replacement + ciphertext.slice(1), tag].join(".")).toString()).toThrow();
    expect(() => decryptAccessCodeToken("plaintext-token")).toThrow();
  });
});
