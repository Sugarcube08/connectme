import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("production environment configuration", () => {
  it("does not require the removed CORS_ORIGIN or QR_CANONICAL_ORIGIN variables", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "mysql://connectme_user:testpassword@127.0.0.1:3306/connectme");
    vi.stubEnv("SESSION_SECRET", "s".repeat(32));
    vi.stubEnv("JWT_SECRET", "j".repeat(32));
    vi.stubEnv("ACCESS_CODE_PEPPER", "p".repeat(32));
    vi.stubEnv("CORS_ORIGIN", undefined);
    vi.stubEnv("QR_CANONICAL_ORIGIN", undefined);
    vi.resetModules();

    const { config } = await import("../config/env.js");

    expect(config.NODE_ENV).toBe("production");
    expect(config).not.toHaveProperty("CORS_ORIGIN");
    expect(config).not.toHaveProperty("QR_CANONICAL_ORIGIN");
  });
});
