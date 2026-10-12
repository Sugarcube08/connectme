import { prisma, AccessCode, CodeStatus } from "@connectme/database";

export class CodeRepository {
  async create(data: {
    tokenHash: string;
    label?: string | null;
    expiresAt?: Date | null;
  }): Promise<AccessCode> {
    return prisma.accessCode.create({
      data: {
        tokenHash: data.tokenHash,
        label: data.label || null,
        expiresAt: data.expiresAt || null,
      },
    });
  }

  async findByTokenHash(tokenHash: string) {
    return prisma.accessCode.findUnique({
      where: { tokenHash },
      include: {
        submission: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  async findById(id: string) {
    return prisma.accessCode.findUnique({
      where: { id },
      include: {
        submission: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  async revoke(id: string): Promise<boolean> {
    const res = await prisma.accessCode.updateMany({
      where: { id, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    return res.count > 0;
  }

  async list(params: {
    skip: number;
    take: number;
    status?: CodeStatus | "EXPIRED";
    search?: string;
  }) {
    const where: any = {};

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

    if (params.search) {
      where.label = { contains: params.search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      prisma.accessCode.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: "desc" },
        include: {
          submission: {
            select: { id: true, fullName: true },
          },
        },
      }),
      prisma.accessCode.count({ where }),
    ]);

    return { items, total };
  }

  async exportAll() {
    return prisma.accessCode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        submission: {
          select: { fullName: true },
        },
      },
    });
  }
}
