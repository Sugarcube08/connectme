import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

async function loadEnvironment(): Promise<void> {
  const loadEnvFile = (process as any).loadEnvFile as
    | ((fileName?: string) => void)
    | undefined;
  if (!loadEnvFile) return;

  for (const candidate of [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../apps/api/.env"),
    path.resolve(process.cwd(), "../../.env"),
  ]) {
    if (existsSync(candidate)) loadEnvFile(candidate);
  }
}

export interface BootstrapProvision {
  bootstrapToken: string;
  setupUrl: string;
  expiresAt: Date;
}

/**
 * Explicitly provisions a short-lived setup token, never an administrator account
 * or password. The owner chooses the username and password on the setup website.
 *
 * Re-running while a pending token exists is refused by default. Pass { rotatePending: true }
 * only when deliberately replacing a lost/expired setup token.
 */
export async function bootstrapAdmin(
  options: { rotatePending?: boolean } = {}
): Promise<BootstrapProvision> {
  await loadEnvironment();
  // Load Prisma after env values are available. This also allows the CLI to load
  // the monorepo-root .env while tests can import the same function.
  const { prisma } = await import("./index.js");

  const bootstrapToken = randomBytes(32).toString("base64url");
  const bootstrapTokenHash = createHash("sha256").update(bootstrapToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pendingUsername = `pending-${randomBytes(12).toString("hex")}`;

  await prisma.$transaction(async (tx) => {
    const existingAdmin = await tx.adminUser.findFirst();
    if (existingAdmin) {
      if (!existingAdmin.isBootstrapPending || existingAdmin.isActive) {
        throw new Error("An administrator record already exists. Initial setup cannot be reopened.");
      }
      if (!options.rotatePending) {
        throw new Error(
          "A bootstrap provision already exists. To intentionally replace its token, run: pnpm db:bootstrap -- --rotate"
        );
      }
      await tx.adminUser.update({
        where: { id: existingAdmin.id },
        data: {
          username: pendingUsername,
          bootstrapTokenHash,
          bootstrapExpiresAt: expiresAt,
          passwordHash: null,
          isActive: false,
          isBootstrapPending: true,
          isInitialAdmin: null,
        },
      });
    } else {
      await tx.adminUser.create({
        data: {
          username: pendingUsername,
          isBootstrapPending: true,
          isActive: false,
          bootstrapTokenHash,
          bootstrapExpiresAt: expiresAt,
        },
      });
    }

    await tx.appSetting.upsert({
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
  }, { isolationLevel: "Serializable" });

  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  // Never put a bearer-like setup token in URLs, browser history, logs or referrers.
  return {
    bootstrapToken,
    setupUrl: `${appOrigin}/setup`,
    expiresAt,
  };
}

if (require.main === module || process.argv[1]?.endsWith("bootstrap.ts")) {
  bootstrapAdmin({ rotatePending: process.argv.includes("--rotate") })
    .then((result) => {
      console.log("\n============================================================");
      console.log("CONNECT ME — FIRST-ADMIN SETUP TOKEN");
      console.log("============================================================");
      console.log("No username or password has been configured.");
      console.log(`One-Time Setup Token: ${result.bootstrapToken}`);
      console.log(`Setup Page          : ${result.setupUrl}`);
      console.log(`Expires At          : ${result.expiresAt.toISOString()}`);
      console.log("Enter this token manually on the setup page. Do not share or commit it.");
      console.log("============================================================\n");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Bootstrap Error]", err.message);
      process.exit(1);
    });
}
