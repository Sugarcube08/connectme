import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./index";

export async function bootstrapAdmin(username?: string): Promise<{
  username: string;
  bootstrapToken: string;
  setupUrl: string;
  expiresAt: Date;
}> {
  const adminUsername = (
    username ||
    process.env.INITIAL_ADMIN_USERNAME ||
    "harsh"
  )
    .trim()
    .toLowerCase();

  // Check if active administrator already exists
  const activeAdmin = await prisma.adminUser.findFirst({
    where: { isActive: true },
  });

  if (activeAdmin) {
    console.log(
      `[Bootstrap] Active administrator already initialized (${activeAdmin.username}). Bootstrap route is permanently locked.`
    );
    throw new Error("Active administrator already exists. Bootstrap is permanently locked.");
  }

  // Generate 128-bit cryptographically secure one-time token
  const bootstrapToken = randomBytes(16).toString("base64url");
  const bootstrapTokenHash = createHash("sha256").update(bootstrapToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000); // 24 hours validity

  // Upsert pending admin record
  const user = await prisma.adminUser.upsert({
    where: { username: adminUsername },
    update: {
      isBootstrapPending: true,
      isActive: false,
      bootstrapTokenHash,
      bootstrapExpiresAt: expiresAt,
      passwordHash: null,
    },
    create: {
      username: adminUsername,
      isBootstrapPending: true,
      isActive: false,
      bootstrapTokenHash,
      bootstrapExpiresAt: expiresAt,
    },
  });

  // Seed default non-secret app settings if missing
  await prisma.appSetting.upsert({
    where: { key: "general" },
    update: {},
    create: {
      key: "general",
      value: {
        brandName: "Connect Me",
        privacyNotice:
          "Your contact details are shared privately and directly with the owner for professional follow-up. Connect Me never discloses your information publicly.",
        defaultExpiryDays: 30,
      },
    },
  });

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const setupUrl = `${appOrigin}/setup?token=${bootstrapToken}`;

  return {
    username: user.username,
    bootstrapToken,
    setupUrl,
    expiresAt,
  };
}

if (require.main === module || process.argv[1]?.endsWith("bootstrap.ts")) {
  bootstrapAdmin()
    .then((result) => {
      console.log("\n============================================================");
      console.log("CONNECT ME — FIRST ADMINISTRATOR PROVISIONED");
      console.log("============================================================");
      console.log(`Administrator Username: ${result.username}`);
      console.log(`One-Time Setup Token  : ${result.bootstrapToken}`);
      console.log(`Setup URL             : ${result.setupUrl}`);
      console.log(`Expires At            : ${result.expiresAt.toISOString()}`);
      console.log("============================================================\n");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Bootstrap Error]", err.message);
      process.exit(1);
    });
}
