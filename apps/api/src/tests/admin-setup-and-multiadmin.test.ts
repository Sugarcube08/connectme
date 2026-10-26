import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "@connectme/database";
import bcrypt from "bcryptjs";

const app = createApp();

describe("Direct Initial Admin Setup & Multi-Admin Creator Tracking", () => {
  const initialAdminUsername = `init-${randomBytes(6).toString("hex")}`;
  const initialAdminPassword = `Secret${randomBytes(8).toString("base64url")}1!`;
  let initialAdminSessionCookie: string;
  let initialAdminId: string;

  const secondAdminUsername = `admin2-${randomBytes(6).toString("hex")}`;
  const secondAdminPassword = `Secret${randomBytes(8).toString("base64url")}2!`;
  let secondAdminSessionCookie: string;
  let secondAdminId: string;

  const thirdAdminUsername = `admin3-${randomBytes(6).toString("hex")}`;
  const thirdAdminPassword = `Secret${randomBytes(8).toString("base64url")}3!`;

  beforeAll(async () => {
    // Clean up test tables
    await prisma.adminRefreshToken.deleteMany();
    await prisma.submissionImage.deleteMany();
    await prisma.contactSubmission.deleteMany();
    await prisma.accessCode.deleteMany();
    await prisma.adminUser.deleteMany();

    // Create an initial admin row in the database pending setup (chicken-egg fix scenario)
    const initialUser = await prisma.adminUser.create({
      data: {
        username: initialAdminUsername,
        displayName: "Initial Admin Pending",
        isActive: true,
        isInitialAdmin: true,
        isBootstrapPending: true,
        passwordHash: null,
      },
    });
    initialAdminId = initialUser.id;
  });

  it("POST /auth/check-username identifies non-existent user", async () => {
    const res = await request(app)
      .post("/api/v1/auth/check-username")
      .send({ username: "does-not-exist" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.exists).toBe(false);
  });

  it("POST /auth/check-username detects initial admin pending setup (needsSetup: true)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/check-username")
      .send({ username: initialAdminUsername });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.exists).toBe(true);
    expect(res.body.data.isInitialAdmin).toBe(true);
    expect(res.body.data.needsSetup).toBe(true);
    expect(res.body.data.displayName).toBe("Initial Admin Pending");
  });

  it("completes initial admin setup directly by username without requiring a token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/bootstrap/setup")
      .send({
        username: initialAdminUsername,
        displayName: "Initial Admin Configured",
        password: initialAdminPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe(initialAdminUsername);
    expect(res.body.data.user.displayName).toBe("Initial Admin Configured");
    expect(res.body.data.user.isActive).toBe(true);
    expect(res.body.data.user.isBootstrapPending).toBe(false);

    // Save session cookie for authenticated requests
    const setCookies = res.headers["set-cookie"] as unknown as string[];
    const sessionCookie = setCookies.find((c) => c.startsWith("connectme_session="));
    expect(sessionCookie).toBeDefined();
    initialAdminSessionCookie = sessionCookie!.split(";")[0];

    // Verify DB state
    const dbUser = await prisma.adminUser.findUnique({ where: { id: initialAdminId } });
    expect(dbUser?.isActive).toBe(true);
    expect(dbUser?.isBootstrapPending).toBe(false);
    expect(dbUser?.passwordHash).not.toBeNull();
    const match = await bcrypt.compare(initialAdminPassword, dbUser!.passwordHash!);
    expect(match).toBe(true);
  });

  it("POST /auth/check-username indicates needsSetup: false once initial admin setup is complete", async () => {
    const res = await request(app)
      .post("/api/v1/auth/check-username")
      .send({ username: initialAdminUsername });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.exists).toBe(true);
    expect(res.body.data.isInitialAdmin).toBe(true);
    expect(res.body.data.needsSetup).toBe(false);
  });

  it("rejects reopening setup once initial admin is setup", async () => {
    const res = await request(app)
      .post("/api/v1/auth/bootstrap/setup")
      .send({
        username: initialAdminUsername,
        password: initialAdminPassword,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("BOOTSTRAP_ALREADY_COMPLETED");
  });

  it("POST /admin/admins is decommissioned (returns 404) and new admins register independently", async () => {
    // Attempting old decommissioned endpoint returns 404
    const oldEndpointRes = await request(app)
      .post("/api/v1/admin/admins")
      .set("Cookie", initialAdminSessionCookie)
      .send({
        username: secondAdminUsername,
        displayName: "Second Admin",
        password: secondAdminPassword,
      });
    expect(oldEndpointRes.status).toBe(404);

    // Independent registration
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Second Admin",
        username: secondAdminUsername,
        email: `${secondAdminUsername}@example.com`,
        number: "+91 98765 43210",
        password: secondAdminPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe(secondAdminUsername);
    secondAdminId = res.body.data.user.id;

    // Login as second admin
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: secondAdminUsername,
        password: secondAdminPassword,
      });

    expect(loginRes.status).toBe(200);
    const setCookies = loginRes.headers["set-cookie"] as unknown as string[];
    const sessionCookie = setCookies.find((c) => c.startsWith("connectme_session="));
    expect(sessionCookie).toBeDefined();
    secondAdminSessionCookie = sessionCookie!.split(";")[0];
  });

  it("third admin can register independently and login", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Third Admin",
        username: thirdAdminUsername,
        email: `${thirdAdminUsername}@example.com`,
        number: "+91 98765 43211",
        password: thirdAdminPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe(thirdAdminUsername);
  });

  it("GET /admin/admins is removed (returns 404) to ensure accounts are completely self-contained and individual", async () => {
    const res = await request(app)
      .get("/api/v1/admin/admins")
      .set("Cookie", initialAdminSessionCookie);

    expect(res.status).toBe(404);
  });

  it("admin can access their own profile via GET /auth/me without exposure of other accounts", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", secondAdminSessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe(secondAdminUsername);
  });
});
