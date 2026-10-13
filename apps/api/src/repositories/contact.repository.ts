import { prisma, FollowUpStatus } from "@connectme/database";

const ownerFilter = (adminUserId: string) => ({
  accessCode: { is: { createdByAdminId: adminUserId } },
});

export class ContactRepository {
  async findById(id: string, adminUserId: string) {
    return prisma.contactSubmission.findFirst({
      where: { id, ...ownerFilter(adminUserId) },
      include: {
        accessCode: { select: { label: true } },
        image: { select: { id: true, mime: true, size: true } },
      },
    });
  }

  async list(params: {
    adminUserId: string;
    skip: number;
    take: number;
    status?: FollowUpStatus;
    search?: string;
  }) {
    const where: any = ownerFilter(params.adminUserId);
    if (params.status) where.followUpStatus = params.status;
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
    adminUserId: string,
    data: { followUpStatus?: FollowUpStatus; discussionNotes?: string }
  ) {
    // Enforce ownership in the mutation itself rather than relying only on a
    // preceding read, so every write is owner-scoped and fails closed.
    const result = await prisma.contactSubmission.updateMany({
      where: { id, ...ownerFilter(adminUserId) },
      data,
    });
    if (result.count !== 1) return null;

    return prisma.contactSubmission.findFirst({
      where: { id, ...ownerFilter(adminUserId) },
      include: {
        accessCode: { select: { label: true } },
        image: { select: { id: true, mime: true, size: true } },
      },
    });
  }

  async getImage(contactId: string, adminUserId: string) {
    return prisma.submissionImage.findFirst({
      where: {
        contactSubmission: {
          is: { accessCode: { is: { createdByAdminId: adminUserId } } },
        },
        contactSubmissionId: contactId,
      },
      select: { profileImage: true, mime: true, size: true },
    });
  }

  async deleteImage(contactId: string, adminUserId: string): Promise<boolean> {
    const result = await prisma.submissionImage.deleteMany({
      where: {
        contactSubmissionId: contactId,
        contactSubmission: {
          is: { accessCode: { is: { createdByAdminId: adminUserId } } },
        },
      },
    });
    return result.count > 0;
  }

  async getMetrics(adminUserId: string) {
    const codes = { createdByAdminId: adminUserId };
    const submissions = ownerFilter(adminUserId);
    const now = new Date();
    const [
      totalCodes, activeCodes, consumedCodes, revokedCodes, expiredCodes,
      totalSubmissions, statusNew, statusContacted, statusReplied,
      statusOpportunity, statusArchived, recentSubmissions,
    ] = await Promise.all([
      prisma.accessCode.count({ where: codes }),
      prisma.accessCode.count({ where: { ...codes, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
      prisma.accessCode.count({ where: { ...codes, status: "CONSUMED" } }),
      prisma.accessCode.count({ where: { ...codes, status: "REVOKED" } }),
      prisma.accessCode.count({ where: { ...codes, status: "ACTIVE", expiresAt: { lte: now } } }),
      prisma.contactSubmission.count({ where: submissions }),
      prisma.contactSubmission.count({ where: { ...submissions, followUpStatus: "NEW" } }),
      prisma.contactSubmission.count({ where: { ...submissions, followUpStatus: "CONTACTED" } }),
      prisma.contactSubmission.count({ where: { ...submissions, followUpStatus: "REPLIED" } }),
      prisma.contactSubmission.count({ where: { ...submissions, followUpStatus: "OPPORTUNITY" } }),
      prisma.contactSubmission.count({ where: { ...submissions, followUpStatus: "ARCHIVED" } }),
      prisma.contactSubmission.findMany({
        where: submissions,
        take: 5,
        orderBy: { submittedAt: "desc" },
        include: {
          accessCode: { select: { label: true } },
          image: { select: { id: true, mime: true, size: true } },
        },
      }),
    ]);

    return {
      totalCodes, activeCodes, consumedCodes, revokedCodes, expiredCodes, totalSubmissions,
      recentSubmissions,
      statusDistribution: {
        NEW: statusNew, CONTACTED: statusContacted, REPLIED: statusReplied,
        OPPORTUNITY: statusOpportunity, ARCHIVED: statusArchived,
      },
    };
  }

  async exportAll(adminUserId: string) {
    return prisma.contactSubmission.findMany({
      where: ownerFilter(adminUserId),
      orderBy: { submittedAt: "desc" },
      include: { accessCode: { select: { label: true } } },
    });
  }
}
