import { prisma, ContactSubmission, FollowUpStatus } from "@connectme/database";

export class ContactRepository {
  async findById(id: string) {
    return prisma.contactSubmission.findUnique({
      where: { id },
      include: {
        accessCode: { select: { label: true } },
        image: { select: { id: true, mime: true, size: true } },
      },
    });
  }

  async list(params: {
    skip: number;
    take: number;
    status?: FollowUpStatus;
    search?: string;
  }) {
    const where: any = {};

    if (params.status) {
      where.followUpStatus = params.status;
    }

    if (params.search) {
      where.OR = [
        { fullName: { contains: params.search } },
        { organization: { contains: params.search } },
        { role: { contains: params.search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.contactSubmission.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { submittedAt: "desc" },
        include: {
          accessCode: { select: { label: true } },
          image: { select: { id: true, mime: true, size: true } },
        },
      }),
      prisma.contactSubmission.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: { followUpStatus?: FollowUpStatus; discussionNotes?: string }
  ) {
    return prisma.contactSubmission.update({
      where: { id },
      data,
      include: {
        accessCode: { select: { label: true } },
        image: { select: { id: true, mime: true, size: true } },
      },
    });
  }

  async getImage(contactId: string) {
    return prisma.submissionImage.findUnique({
      where: { contactSubmissionId: contactId },
      select: { profileImage: true, mime: true, size: true },
    });
  }

  async deleteImage(contactId: string): Promise<boolean> {
    try {
      await prisma.submissionImage.delete({
        where: { contactSubmissionId: contactId },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getMetrics() {
    const [
      totalCodes,
      activeCodes,
      consumedCodes,
      revokedCodes,
      expiredCodes,
      totalSubmissions,
      statusNew,
      statusContacted,
      statusReplied,
      statusOpportunity,
      statusArchived,
      recentSubmissions,
    ] = await Promise.all([
      prisma.accessCode.count(),
      prisma.accessCode.count({
        where: {
          status: "ACTIVE",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
      prisma.accessCode.count({ where: { status: "CONSUMED" } }),
      prisma.accessCode.count({ where: { status: "REVOKED" } }),
      prisma.accessCode.count({
        where: {
          status: "ACTIVE",
          expiresAt: { lte: new Date() },
        },
      }),
      prisma.contactSubmission.count(),
      prisma.contactSubmission.count({ where: { followUpStatus: "NEW" } }),
      prisma.contactSubmission.count({ where: { followUpStatus: "CONTACTED" } }),
      prisma.contactSubmission.count({ where: { followUpStatus: "REPLIED" } }),
      prisma.contactSubmission.count({ where: { followUpStatus: "OPPORTUNITY" } }),
      prisma.contactSubmission.count({ where: { followUpStatus: "ARCHIVED" } }),
      prisma.contactSubmission.findMany({
        take: 5,
        orderBy: { submittedAt: "desc" },
        include: {
          accessCode: { select: { label: true } },
          image: { select: { id: true, mime: true, size: true } },
        },
      }),
    ]);

    return {
      totalCodes,
      activeCodes,
      consumedCodes,
      revokedCodes,
      expiredCodes,
      totalSubmissions,
      recentSubmissions,
      statusDistribution: {
        NEW: statusNew,
        CONTACTED: statusContacted,
        REPLIED: statusReplied,
        OPPORTUNITY: statusOpportunity,
        ARCHIVED: statusArchived,
      },
    };
  }

  async exportAll() {
    return prisma.contactSubmission.findMany({
      orderBy: { submittedAt: "desc" },
      include: {
        accessCode: { select: { label: true } },
      },
    });
  }
}
