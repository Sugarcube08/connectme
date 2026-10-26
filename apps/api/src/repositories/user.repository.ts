import { prisma, AdminUser, type Prisma } from "@connectme/database";

export class UserRepository {
  async findByUsername(username: string): Promise<(AdminUser & { createdBy?: AdminUser | null }) | null> {
    return prisma.adminUser.findUnique({
      where: { username: username.toLowerCase().trim() },
      include: { createdBy: true },
    });
  }

  async findByUsernameOrEmail(identifier: string): Promise<(AdminUser & { createdBy?: AdminUser | null }) | null> {
    const clean = identifier.toLowerCase().trim();
    return prisma.adminUser.findFirst({
      where: {
        OR: [
          { username: clean },
          { email: clean },
          { phoneNumber: clean },
        ],
      },
      include: { createdBy: true },
    });
  }

  async findByEmail(email: string): Promise<AdminUser | null> {
    return prisma.adminUser.findFirst({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async registerUser(data: {
    username: string;
    displayName: string;
    email: string;
    phoneNumber?: string;
    passwordHash: string;
  }): Promise<AdminUser & { createdBy?: AdminUser | null }> {
    return prisma.adminUser.create({
      data: {
        username: data.username.toLowerCase().trim(),
        displayName: data.displayName.trim(),
        email: data.email.toLowerCase().trim(),
        phoneNumber: data.phoneNumber?.trim() || null,
        smsSenderPhone: data.phoneNumber?.trim() || null,
        smsSenderEmail: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        isActive: true,
        isBootstrapPending: false,
        isInitialAdmin: null,
      },
      include: {
        createdBy: true,
      },
    });
  }

  async findById(id: string): Promise<(AdminUser & { createdBy?: AdminUser | null }) | null> {
    return prisma.adminUser.findUnique({
      where: { id },
      include: { createdBy: true },
    });
  }

  async findActiveAdmin(): Promise<(AdminUser & { createdBy?: AdminUser | null }) | null> {
    return prisma.adminUser.findFirst({
      where: { isActive: true, isBootstrapPending: false, passwordHash: { not: null } },
      include: { createdBy: true },
    });
  }

  async findPendingInitialAdmin(): Promise<AdminUser | null> {
    return prisma.adminUser.findFirst({
      where: { isInitialAdmin: true, isBootstrapPending: true },
    });
  }

  async findPendingBootstrap(): Promise<AdminUser | null> {
    return prisma.adminUser.findFirst({
      where: { isBootstrapPending: true, bootstrapTokenHash: { not: null } },
    });
  }

  async findByBootstrapTokenHash(hash: string): Promise<AdminUser | null> {
    return prisma.adminUser.findUnique({ where: { bootstrapTokenHash: hash } });
  }

  async listAdmins(): Promise<(AdminUser & { createdBy?: AdminUser | null })[]> {
    return prisma.adminUser.findMany({
      include: { createdBy: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async createAdmin(data: {
    username: string;
    displayName?: string;
    passwordHash: string;
    createdById?: string;
  }): Promise<AdminUser & { createdBy?: AdminUser | null }> {
    return prisma.adminUser.create({
      data: {
        username: data.username.toLowerCase().trim(),
        displayName: data.displayName?.trim() || null,
        passwordHash: data.passwordHash,
        isActive: true,
        isBootstrapPending: false,
        isInitialAdmin: null,
        createdById: data.createdById || null,
      },
      include: {
        createdBy: true,
      },
    });
  }

  /**
   * Atomically sets up the initial administrator when found by username.
   */
  async completeInitialAdminSetup(data: {
    username: string;
    passwordHash: string;
    displayName?: string;
    publicOrigin?: string;
  }): Promise<(AdminUser & { createdBy?: AdminUser | null }) | null> {
    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const user = await tx.adminUser.findUnique({
          where: { username: data.username.toLowerCase().trim() },
        });
        if (!user || user.isInitialAdmin !== true || !user.isBootstrapPending) {
          return null;
        }

        const updated = await tx.adminUser.update({
          where: { id: user.id },
          data: {
            passwordHash: data.passwordHash,
            displayName: data.displayName?.trim() || user.displayName || null,
            isActive: true,
            isBootstrapPending: false,
            isInitialAdmin: true,
            bootstrapTokenHash: null,
            bootstrapExpiresAt: null,
          },
          include: {
            createdBy: true,
          },
        });

        if (data.publicOrigin) {
          await tx.appSetting.upsert({
            where: { key: "public-origin" },
            update: { value: { origin: data.publicOrigin } },
            create: { key: "public-origin", value: { origin: data.publicOrigin } },
          });
        }

        return updated;
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error) {
        const prismaError = error as { code?: string };
        if (prismaError.code === "P2034") return null;
      }
      throw error;
    }
  }

  /**
   * Atomically consumes a valid bootstrap token and activates the first admin.
   * A second concurrent request updates zero rows after the first consumes it.
   */
  async completeBootstrap(data: {
    userId: string;
    tokenHash: string;
    username: string;
    passwordHash: string;
    displayName?: string;
    publicOrigin?: string;
  }): Promise<(AdminUser & { createdBy?: AdminUser | null }) | null> {
    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

        if (data.publicOrigin) {
          await tx.appSetting.upsert({
            where: { key: "public-origin" },
            update: { value: { origin: data.publicOrigin } },
            create: { key: "public-origin", value: { origin: data.publicOrigin } },
          });
        }
        return tx.adminUser.findUnique({
          where: { id: data.userId },
          include: { createdBy: true },
        });
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error) {
        const prismaError = error as { code?: string; meta?: { target?: unknown } };
        if (prismaError.code === "P2034") return null;
        if (prismaError.code === "P2002") {
          const target = prismaError.meta?.target;
          const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");
          if (targetText.includes("is_initial_admin")) return null;
        }
      }
      throw error;
    }
  }

  async getSmsSettings(id: string) {
    return prisma.adminUser.findUnique({
      where: { id },
      select: {
        smsEnabled: true,
        smsGatewayUrl: true,
        smsGatewayUsername: true,
        smsGatewayPassword: true,
        smsTemplate: true,
        smsSenderPhone: true,
        smsSenderEmail: true,
      },
    });
  }

  async updateSmsSettings(id: string, data: {
    smsEnabled: boolean;
    smsGatewayUrl?: string | null;
    smsGatewayUsername?: string | null;
    smsGatewayPassword?: string | null;
    smsTemplate?: string | null;
    smsSenderPhone?: string | null;
    smsSenderEmail?: string | null;
  }) {
    return prisma.adminUser.update({
      where: { id },
      data,
      select: {
        smsEnabled: true,
        smsGatewayUrl: true,
        smsGatewayUsername: true,
        smsGatewayPassword: true,
        smsTemplate: true,
        smsSenderPhone: true,
        smsSenderEmail: true,
      },
    });
  }
}
