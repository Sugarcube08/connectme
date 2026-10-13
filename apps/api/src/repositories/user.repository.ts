import { prisma, AdminUser } from "@connectme/database";

export class UserRepository {
  async findByUsername(username: string): Promise<AdminUser | null> {
    return prisma.adminUser.findUnique({
      where: { username: username.toLowerCase().trim() },
    });
  }

  async findById(id: string): Promise<AdminUser | null> {
    return prisma.adminUser.findUnique({ where: { id } });
  }

  async findActiveAdmin(): Promise<AdminUser | null> {
    return prisma.adminUser.findFirst({ where: { isActive: true } });
  }

  async findPendingBootstrap(): Promise<AdminUser | null> {
    return prisma.adminUser.findFirst({
      where: { isBootstrapPending: true, isActive: false, bootstrapTokenHash: { not: null } },
    });
  }

  async findByBootstrapTokenHash(hash: string): Promise<AdminUser | null> {
    return prisma.adminUser.findUnique({ where: { bootstrapTokenHash: hash } });
  }

  /**
   * Atomically consumes a valid bootstrap token and activates the first admin.
   * A second concurrent request will update zero rows after the first consumes it.
   * The unique nullable isInitialAdmin marker is an additional database-level guard.
   */
  async completeBootstrap(data: {
    userId: string;
    tokenHash: string;
    username: string;
    passwordHash: string;
    displayName?: string;
    publicOrigin?: string;
  }): Promise<AdminUser | null> {
    try {
      return await prisma.$transaction(async (tx) => {
      const update = await tx.adminUser.updateMany({
        where: {
          id: data.userId,
          bootstrapTokenHash: data.tokenHash,
          isBootstrapPending: true,
          isActive: false,
          isInitialAdmin: null,
          bootstrapExpiresAt: { gt: new Date() },
        },
        data: {
          username: data.username.toLowerCase().trim(),
          passwordHash: data.passwordHash,
          displayName: data.displayName || null,
          isActive: true,
          isBootstrapPending: false,
          isInitialAdmin: true,
          bootstrapTokenHash: null,
          bootstrapExpiresAt: null,
        },
      });

      if (update.count !== 1) return null;

      // Persist the public web origin learned from the setup page in the same
      // transaction as first-admin activation. Native clients can then create
      // QR links to the website without a separate QR-origin environment value.
      if (data.publicOrigin) {
        await tx.appSetting.upsert({
          where: { key: "public-origin" },
          update: { value: { origin: data.publicOrigin } },
          create: { key: "public-origin", value: { origin: data.publicOrigin } },
        });
      }

      return tx.adminUser.findUnique({ where: { id: data.userId } });
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error) {
        const prismaError = error as { code?: string; meta?: { target?: unknown } };
        if (prismaError.code === "P2034") return null; // concurrent serializable transaction lost
        if (prismaError.code === "P2002") {
          const target = prismaError.meta?.target;
          const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");
          if (targetText.includes("is_initial_admin")) return null;
        }
      }
      throw error;
    }
  }
}
