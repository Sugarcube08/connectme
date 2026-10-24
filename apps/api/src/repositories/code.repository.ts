import { prisma, AccessCode, CodeStatus } from "@connectme/database";

export class CodeRepository {
  async create(data: {
    token: string;
    tokenHash: string;
    createdByAdminId: string;
    label?: string | null;
    expiresAt?: Date | null;
  }): Promise<AccessCode> {
    return prisma.accessCode.create({
      data: {
        token: data.token,
        tokenHash: data.tokenHash,
        createdByAdminId: data.createdByAdminId,
        label: data.label || null,
        expiresAt: data.expiresAt || null,
      },
    });
  }

  async createMany(items: Array<{
    token: string;
    tokenHash: string;
    createdByAdminId: string;
    label?: string | null;
    expiresAt?: Date | null;
  }>): Promise<number> {
    const res = await prisma.accessCode.createMany({
      data: items.map((item) => ({
        token: item.token,
        tokenHash: item.tokenHash,
        createdByAdminId: item.createdByAdminId,
        label: item.label || null,
        expiresAt: item.expiresAt || null,
      })),
    });
    return res.count;
  }

  async findByTokenOrHashes(token: string, tokenHashes: string[]) {
    return prisma.accessCode.findFirst({
      where: {
        OR: [
          { token },
          { tokenHash: { in: tokenHashes } },
        ],
      },
      include: { submission: { select: { id: true, fullName: true } } },
    });
  }

  async findByTokenHashes(tokenHashes: string[]) {
    return prisma.accessCode.findFirst({
      where: { tokenHash: { in: tokenHashes } },
      include: { submission: { select: { id: true, fullName: true } } },
    });
  }

  async findOwnedByTokens(tokens: string[], adminUserId: string) {
    return prisma.accessCode.findMany({
      where: { token: { in: tokens }, createdByAdminId: adminUserId },
      include: { submission: { select: { id: true, fullName: true } } },
    });
  }

  async findOwnedByIds(ids: string[], adminUserId: string) {
    return prisma.accessCode.findMany({
      where: { id: { in: ids }, createdByAdminId: adminUserId },
      include: { submission: { select: { id: true, fullName: true } } },
    });
  }

  async revoke(id: string, adminUserId: string): Promise<boolean> {
    const res = await prisma.accessCode.updateMany({
      where: { id, createdByAdminId: adminUserId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    return res.count > 0;
  }

  async revokeMany(ids: string[], adminUserId: string): Promise<number> {
    const res = await prisma.accessCode.updateMany({
      where: { id: { in: ids }, createdByAdminId: adminUserId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    return res.count;
  }

  async list(params: {
    adminUserId: string;
    skip: number;
    take: number;
    status?: CodeStatus | "EXPIRED";
    search?: string;
  }) {
    const where: any = { createdByAdminId: params.adminUserId };

    if (params.status) {
      if (params.status === "EXPIRED") {
        where.status = "ACTIVE";
        where.expiresAt = { lte: new Date() };
      } else if (params.status === "ACTIVE") {
        where.status = "ACTIVE";
        where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
      } else {
        where.status = params.status;
      }
    }

    if (params.search) where.label = { contains: params.search };

    const [items, total] = await Promise.all([
      prisma.accessCode.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: "desc" },
        include: { submission: { select: { id: true, fullName: true } } },
      }),
      prisma.accessCode.count({ where }),
    ]);

    return { items, total };
  }

  async exportAll(adminUserId: string) {
    return prisma.accessCode.findMany({
      where: { createdByAdminId: adminUserId },
      orderBy: { createdAt: "desc" },
      include: { submission: { select: { fullName: true } } },
    });
  }
}
