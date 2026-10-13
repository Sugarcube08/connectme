import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "@connectme/database";
import { bootstrapAdmin } from "@connectme/database/src/bootstrap";
import sharp from "sharp";

const app = createApp();
const testUsername = `test-${randomBytes(6).toString("hex")}`;
let activeTestUsername = testUsername;
const testPassword = `${randomBytes(18).toString("base64url")}A1`;

beforeAll(async () => {
  // Clear test tables
  await prisma.submissionImage.deleteMany();
  await prisma.contactSubmission.deleteMany();
  await prisma.accessCode.deleteMany();
  await prisma.adminUser.deleteMany();
});

describe("Express API MVC - Health Endpoints", () => {
  it("GET /health/live returns 200 OK", async () => {
    const res = await request(app).get("/health/live");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /health/ready confirms MySQL connection", async () => {
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.database).toBe("connected");
  });
});

describe("Controlled First-Admin Bootstrap Workflow", () => {
  let bootstrapToken: string;
  let adminToken: string;

  it("provisions pending administrator with a one-time cryptographic token", async () => {
    const provisionResult = await bootstrapAdmin();
    expect(provisionResult.bootstrapToken).toBeDefined();
    bootstrapToken = provisionResult.bootstrapToken;
    expect(provisionResult.setupUrl).toMatch(/\/setup$/);
    expect(provisionResult.setupUrl).not.toContain(bootstrapToken);

    // Verify GET /api/v1/auth/bootstrap/status reflects pending state
    const statusRes = await request(app).get("/api/v1/auth/bootstrap/status");
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.isBootstrapPending).toBe(true);
    expect(statusRes.body.data.username).toBeUndefined();
  });

  it("completes first-admin bootstrap and locks setup permanently", async () => {
    // Attempt with incorrect token fails
    const failRes = await request(app)
      .post("/api/v1/auth/bootstrap/setup")
      .send({
        token: "invalid-token-12345",
        username: activeTestUsername,
        password: testPassword,
        displayName: "Test Admin",
      });
    expect(failRes.status).toBe(401);

    // Concurrent requests with the same one-time token must yield one activation only.
    const candidateUsernames = [`${testUsername}-a`, `${testUsername}-b`];
    const setupResults = await Promise.all(
      candidateUsernames.map((candidate) =>
        request(app)
          .post("/api/v1/auth/bootstrap/setup")
          .send({
            token: bootstrapToken,
            username: candidate,
            password: testPassword,
            displayName: "Test Admin",
          })
      )
    );
    const successes = setupResults.filter((response) => response.status === 200);
    expect(successes).toHaveLength(1);
    const rejected = setupResults.filter((response) => response.status !== 200);
    expect(rejected).toHaveLength(1);
    expect([401, 403, 410]).toContain(rejected[0].status);

    const successIndex = setupResults.findIndex((response) => response.status === 200);
    activeTestUsername = candidateUsernames[successIndex];
    const successRes = successes[0];
    expect(successRes.body.data.user.username).toBe(activeTestUsername);
    expect(successRes.body.data.user.isActive).toBe(true);
    expect(successRes.body.data.user.isBootstrapPending).toBe(false);
    expect(successRes.body.data.token).toBeDefined();
    adminToken = successRes.body.data.token;

    // Check bootstrap status is now closed
    const statusAfter = await request(app).get("/api/v1/auth/bootstrap/status");
    expect(statusAfter.body.data.isBootstrapPending).toBe(false);

    // Replay attack: attempting to reuse bootstrap token fails
    const replayRes = await request(app)
      .post("/api/v1/auth/bootstrap/setup")
      .send({
        token: bootstrapToken,
        username: activeTestUsername,
        password: testPassword,
      });
    expect(replayRes.status).toBe(403);
  });

  it("authenticates active administrator with password and issues JWT", async () => {
    // Incorrect password
    const wrongRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: activeTestUsername,
        password: `${testPassword}wrong`,
      });
    expect(wrongRes.status).toBe(401);

    // Correct password
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: activeTestUsername,
        password: testPassword,
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.token).toBeDefined();
    expect(loginRes.headers["set-cookie"]).toBeDefined(); // HTTP-only session cookie
  });
});

describe("Core Operations: Code Generation, Atomic Single-Use Redemption & Concurrency", () => {
  let adminToken: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: activeTestUsername,
        password: testPassword,
      });
    adminToken = loginRes.body.data.token;
  });

  it("generates a single code and verifies public eligibility", async () => {
    const genRes = await request(app)
      .post("/api/v1/admin/codes")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-connectme-public-origin", "https://connectme.example.test")
      .send({ label: "Devcon Booth Alpha" });

    expect(genRes.status).toBe(201);
    const code = genRes.body.data;
    expect(code.url).toBe(`https://connectme.example.test/${code.token}`);
    expect(code.token).toBeDefined();
    expect(code.token.length).toBe(22);
    expect(code.qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);

    // Public eligibility check
    const checkRes = await request(app).get(`/api/v1/public/codes/${code.token}`);
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.eligible).toBe(true);
    expect(checkRes.body.data.codeStatus).toBe("ACTIVE");
  });

  it("atomically redeems code with optional profile image and burns single-use token", async () => {
    const genRes = await request(app)
      .post("/api/v1/admin/codes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ label: "VIP Attendee 001" });
    const code = genRes.body.data;

    // Create a 100x100 PNG test image buffer
    const testImage = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 109, g: 60, b: 232, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    // Redeem code with multipart image
    const redeemRes = await request(app)
      .post(`/api/v1/public/codes/${code.token}/redeem`)
      .field("fullName", "Vitalik Buterin")
      .field("phoneNumber", "+1 555-0199")
      .field("organization", "Ethereum Foundation")
      .field("role", "Chief Scientist")
      .attach("profileImage", testImage, "vitalik.png");

    expect(redeemRes.status).toBe(201);
    expect(redeemRes.body.data.success).toBe(true);

    // Verify token is now burned/CONSUMED
    const checkRes = await request(app).get(`/api/v1/public/codes/${code.token}`);
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.eligible).toBe(false);
    expect(checkRes.body.data.codeStatus).toBe("CONSUMED");

    // Second redemption must fail with 409 Conflict
    const secondRedeemRes = await request(app)
      .post(`/api/v1/public/codes/${code.token}/redeem`)
      .send({
        fullName: "Attacker Trying Again",
        phoneNumber: "+1 555-0200",
      });
    expect(secondRedeemRes.status).toBe(409);
    expect(secondRedeemRes.body.error.code).toBe("ALREADY_CONSUMED");
  });

  it("guarantees strictly AT MOST ONE redemption succeeds under concurrent pressure", async () => {
    const genRes = await request(app)
      .post("/api/v1/admin/codes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ label: "Concurrent Stress Test" });
    const code = genRes.body.data;

    const totalAttempts = 8;
    const promises = Array.from({ length: totalAttempts }, (_, index) =>
      request(app)
        .post(`/api/v1/public/codes/${code.token}/redeem`)
        .send({
          fullName: `Concurrent Visitor ${index}`,
          phoneNumber: `+1 555-${2000 + index}`,
          organization: `Company ${index}`,
        })
    );

    const outcomes = await Promise.all(promises);

    const successful = outcomes.filter((r) => r.status === 201);
    const conflicts = outcomes.filter((r) => r.status === 409);

    // Exactly 1 success
    expect(successful.length).toBe(1);
    // All others were rejected as conflicts
    expect(conflicts.length).toBe(totalAttempts - 1);

    // Verify database has strictly 1 submission for this code
    const dbSubmissions = await prisma.contactSubmission.count({
      where: { accessCodeId: code.id },
    });
    expect(dbSubmissions).toBe(1);
  });

  it("admin can view contact list, retrieve stored image, and update follow-up status", async () => {
    // List contacts
    const listRes = await request(app)
      .get("/api/v1/admin/contacts")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

    const contact = listRes.body.data[0];

    // Update follow-up status
    const updateRes = await request(app)
      .patch(`/api/v1/admin/contacts/${contact.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ followUpStatus: "CONTACTED", discussionNotes: "Met at Devcon opening." });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.followUpStatus).toBe("CONTACTED");

    // Dashboard metrics
    const dashRes = await request(app)
      .get("/api/v1/admin/dashboard")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.totalSubmissions).toBeGreaterThanOrEqual(1);
  });
});
