import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "@connectme/database";
import { encryptPassword, decryptPassword } from "../lib/sms-crypto";
import { renderSmsTemplate, DEFAULT_SMS_TEMPLATE, SmsService } from "../services/sms.service";

const app = createApp();

describe("SMS Gateway Security & Integration", () => {
  describe("Password Cryptography (AES-256-GCM)", () => {
    it("encrypts and decrypts passwords reliably", () => {
      const rawPassword = "ultra-secret-gateway-password-123!@#";
      const encrypted = encryptPassword(rawPassword);

      expect(encrypted).not.toBe(rawPassword);
      expect(encrypted.startsWith("enc:v1:")).toBe(true);

      const decrypted = decryptPassword(encrypted);
      expect(decrypted).toBe(rawPassword);
    });

    it("returns empty string on invalid ciphertexts gracefully", () => {
      expect(decryptPassword("")).toBe("");
      expect(decryptPassword("invalid-string")).toBe("");
      expect(decryptPassword("enc:v1:corrupted")).toBe("");
    });
  });

  describe("SMS Template Rendering", () => {
    it("interpolates variables correctly", () => {
      const template = "Hello {{fullName}}, your phone is {{phoneNumber}}. From {{adminName}} ({{adminPhone}})";
      const rendered = renderSmsTemplate(template, {
        fullName: "Alice Smith",
        phoneNumber: "+15550001",
        adminName: "Bob Admin",
        adminPhone: "+15559999",
      });

      expect(rendered).toBe("Hello Alice Smith, your phone is +15550001. From Bob Admin (+15559999)");
    });

    it("handles missing variables without crashing", () => {
      const rendered = renderSmsTemplate(DEFAULT_SMS_TEMPLATE, {
        fullName: "Charlie",
        phoneNumber: "+123456",
      });

      expect(rendered).toContain("Charlie");
      expect(rendered).not.toContain("undefined");
    });
  });

  describe("Admin SMS Gateway Settings Endpoints", () => {
    let adminToken: string;
    let adminId: string;
    const testUsername = `sms-admin-${randomBytes(4).toString("hex")}`;
    const testPassword = `Passw0rd_${randomBytes(6).toString("hex")}`;

    beforeAll(async () => {
      // Create admin user directly
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(testPassword, 10);
      const user = await prisma.adminUser.create({
        data: {
          username: testUsername,
          displayName: "SMS Gateway Tester",
          passwordHash,
          isActive: true,
          isBootstrapPending: false,
        },
      });
      adminId = user.id;

      // Log in with mobile client header to get bearer token
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .set("X-ConnectMe-Client", "mobile")
        .send({
          username: testUsername,
          password: testPassword,
        });

      expect(loginRes.status).toBe(200);
      adminToken = loginRes.body.data.token;
    });

    it("requires authentication for SMS settings", async () => {
      const getRes = await request(app).get("/api/v1/admin/settings/sms");
      expect(getRes.status).toBe(401);

      const patchRes = await request(app).patch("/api/v1/admin/settings/sms").send({
        smsEnabled: true,
      });
      expect(patchRes.status).toBe(401);
    });

    it("retrieves empty default SMS settings for newly created admin", async () => {
      const res = await request(app)
        .get("/api/v1/admin/settings/sms")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        smsEnabled: false,
        smsGatewayUrl: null,
        smsGatewayUsername: null,
        hasPassword: false,
        smsTemplate: null,
        smsSenderPhone: null,
        smsSenderEmail: null,
      });
    });

    it("rejects enabling SMS without gateway credentials", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/settings/sms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          smsEnabled: true,
          smsGatewayUrl: "",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("saves gateway configuration securely and masks password", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/settings/sms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          smsEnabled: true,
          smsGatewayUrl: "https://androgateserver.onrender.com",
          smsGatewayUsername: "test-gateway-user",
          smsGatewayPassword: "gateway-secret-password-xyz",
          smsTemplate: "Hi {{fullName}}, connecting with you!",
          smsSenderPhone: "+15551234567",
          smsSenderEmail: "admin@connectme.dev",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.smsEnabled).toBe(true);
      expect(res.body.data.smsGatewayUrl).toBe("https://androgateserver.onrender.com");
      expect(res.body.data.smsGatewayUsername).toBe("test-gateway-user");
      expect(res.body.data.hasPassword).toBe(true);
      expect(res.body.data.smsGatewayPassword).toBeUndefined(); // Must NEVER expose password!

      // Verify encrypted in database
      const dbUser = await prisma.adminUser.findUnique({ where: { id: adminId } });
      expect(dbUser?.smsGatewayPassword).not.toBe("gateway-secret-password-xyz");
      expect(decryptPassword(dbUser?.smsGatewayPassword)).toBe("gateway-secret-password-xyz");
    });

    it("retains existing encrypted password when updating without providing a new password", async () => {
      const res = await request(app)
        .patch("/api/v1/admin/settings/sms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          smsEnabled: true,
          smsGatewayUrl: "https://androgateserver.onrender.com",
          smsGatewayUsername: "test-gateway-user",
          smsSenderPhone: "+15559876543",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.hasPassword).toBe(true);
      expect(res.body.data.smsSenderPhone).toBe("+15559876543");

      const dbUser = await prisma.adminUser.findUnique({ where: { id: adminId } });
      expect(decryptPassword(dbUser?.smsGatewayPassword)).toBe("gateway-secret-password-xyz");
    });

    it("returns requiresSmsNotice and smsNotice when verifying code created by SMS-enabled admin", async () => {
      // Create code created by this SMS-enabled admin
      const token = `test-sms-token-${randomBytes(6).toString("hex")}`;
      const tokenHash = (await import("node:crypto")).createHash("sha256").update(token).digest("hex");

      await prisma.accessCode.create({
        data: {
          token,
          tokenHash,
          createdByAdminId: adminId,
          status: "ACTIVE",
        },
      });

      const verifyRes = await request(app).get(`/api/v1/public/codes/${token}`);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.eligible).toBe(true);
      expect(verifyRes.body.data.requiresSmsNotice).toBe(true);
      expect(verifyRes.body.data.smsNotice).toBe(
        "be sure to enter correct number, because it's not editable and you'll receive my contact on the given number via sms only"
      );
    });
  });
});
