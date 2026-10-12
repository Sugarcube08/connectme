import { prisma, AdminUser } from "@connectme/database";

export class UserRepository {
  async findByUsername(username: string): Promise<AdminUser | null> {
    return prisma.adminUser.findUnique({
      where: { username: username.toLowerCase().trim() },
    });
  }

  async findById(id: string): Promise<AdminUser | null> {
    return prisma.adminUser.findUnique({
      where: { id },
    });
  }

  async findActiveAdmin(): Promise<AdminUser | null> {
    return prisma.adminUser.findFirst({
      where: { isActive: true },
    });
  }

  async findPendingBootstrap(): Promise<AdminUser | null> {
    return prisma.adminUser.findFirst({
      where: { isBootstrapPending: true },
    });
  }

  async findByBootstrapTokenHash(hash: string): Promise<AdminUser | null> {
    return prisma.adminUser.findUnique({
      where: { bootstrapTokenHash: hash },
    });
  }

  async completeBootstrap(data: {
    userId: string;
    passwordHash: string;
    displayName?: string;
  }): Promise<AdminUser> {
    return prisma.adminUser.update({
      where: { id: data.userId },
      data: {
        passwordHash: data.passwordHash,
        displayName: data.displayName || null,
        isActive: true,
        isBootstrapPending: false,
        bootstrapTokenHash: null,
        bootstrapExpiresAt: null,
      },
    });
  }
}
