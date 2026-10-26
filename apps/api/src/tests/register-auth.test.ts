import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { EmailService } from "../services/email.service";

const app = createApp();

describe("Public User Registration & Login/Signup Flow", () => {
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const testEmail = `newuser-${randomSuffix}@example.com`;
  const testPhone = "+919876543210";
  const testPassword = "SecurePass123!";
  const testName = "Alex Rivera";

  it("allows any public visitor to register a new admin account with name, email, number, and password when OTP_VERIFICATION is false", async () => {
    process.env.OTP_VERIFICATION = "false";

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: testName,
        email: testEmail,
        number: testPhone,
        password: testPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
    expect(res.body.data.user.displayName).toBe(testName);
    expect(res.body.data.user.phoneNumber).toBe(testPhone);
    expect(res.body.data.user.isActive).toBe(true);
    expect(res.body.data.user.isBootstrapPending).toBe(false);

    // Browser receives HTTP-only cookies
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    expect(cookieStr).toContain("connectme_session");
  });

  it("returns mobile tokens when X-ConnectMe-Client: mobile header is sent during registration", async () => {
    process.env.OTP_VERIFICATION = "false";
    const mobileEmail = `mobile-${randomSuffix}@example.com`;
    const res = await request(app)
      .post("/api/v1/auth/register")
      .set("X-ConnectMe-Client", "mobile")
      .send({
        name: "Mobile User",
        email: mobileEmail,
        number: "+14155552671",
        password: testPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it("rejects duplicate email registrations with a 409 Conflict error", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Duplicate Attempt",
        email: testEmail,
        number: testPhone,
        password: testPassword,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("allows logging in using the registered EMAIL address and password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: testEmail, // User enters email into username field
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
  });

  describe("OTP Verification Pipeline (OTP_VERIFICATION=true)", () => {
    const otpUserEmail = `otp-${randomSuffix}@example.com`;

    beforeEach(() => {
      process.env.OTP_VERIFICATION = "true";
    });

    afterEach(() => {
      process.env.OTP_VERIFICATION = "false";
    });

    it("triggers OTP dispatch when registering with OTP_VERIFICATION=true and requiresOtp is returned", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "OTP Test User",
          email: otpUserEmail,
          number: "+919876543299",
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requiresOtp).toBe(true);
      expect(res.body.data.email).toBe(otpUserEmail.toLowerCase());
      expect(EmailService.lastSentEmail).not.toBeNull();
      expect(EmailService.lastSentEmail?.to).toBe(otpUserEmail.toLowerCase());
      expect(EmailService.lastSentEmail?.otp).toHaveLength(6);
    });

    it("rejects invalid OTP with 400 Bad Request", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "OTP Test User",
          email: otpUserEmail,
          number: "+919876543299",
          password: testPassword,
          otp: "000000",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_OTP");
    });

    it("allows resending OTP via POST /api/v1/auth/resend-otp", async () => {
      const res = await request(app)
        .post("/api/v1/auth/resend-otp")
        .send({
          email: otpUserEmail,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(EmailService.lastSentEmail?.to).toBe(otpUserEmail.toLowerCase());
    });

    it("completes registration and issues session when correct OTP is provided", async () => {
      const latestOtp = EmailService.lastSentEmail?.otp;
      expect(latestOtp).toBeDefined();

      const res = await request(app)
        .post("/api/v1/auth/register")
        .set("X-ConnectMe-Client", "mobile")
        .send({
          name: "OTP Test User",
          email: otpUserEmail,
          number: "+919876543299",
          password: testPassword,
          otp: latestOtp,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(otpUserEmail.toLowerCase());
      expect(res.body.data.token).toBeDefined();
    });

    it("cannot reuse the consumed OTP", async () => {
      const usedOtp = EmailService.lastSentEmail?.otp;
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Another User",
          email: `reuse-${randomSuffix}@example.com`,
          number: "+919876543299",
          password: testPassword,
          otp: usedOtp,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_OTP");
    });
  });
});
