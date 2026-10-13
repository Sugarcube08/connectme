import { ContactRepository } from "../repositories/contact.repository";
import { serializeContact } from "../serializers";
import { ContactItem, DashboardMetrics, FollowUpStatus, UpdateContactInput } from "@connectme/contracts";
import { NotFoundError } from "../errors/app-error";

export class ContactService {
  constructor(private contactRepo = new ContactRepository()) {}

  async list(params: {
    adminUserId: string;
    page: number;
    limit: number;
    status?: FollowUpStatus;
    search?: string;
  }): Promise<{ contacts: ContactItem[]; total: number; totalPages: number }> {
    const skip = (params.page - 1) * params.limit;
    const { items, total } = await this.contactRepo.list({
      adminUserId: params.adminUserId, skip, take: params.limit, status: params.status, search: params.search,
    });
    return { contacts: items.map(serializeContact), total, totalPages: Math.ceil(total / params.limit) || 1 };
  }

  async getById(id: string, adminUserId: string): Promise<ContactItem> {
    const item = await this.contactRepo.findById(id, adminUserId);
    if (!item) throw new NotFoundError("Contact not found.");
    return serializeContact(item);
  }

  async update(id: string, adminUserId: string, input: UpdateContactInput): Promise<ContactItem> {
    const existing = await this.contactRepo.findById(id, adminUserId);
    if (!existing) throw new NotFoundError("Contact not found.");
    const updated = await this.contactRepo.update(id, {
      followUpStatus: input.followUpStatus as FollowUpStatus,
      discussionNotes: input.discussionNotes,
    });
    return serializeContact(updated);
  }

  async getImage(contactId: string, adminUserId: string): Promise<{ buffer: Buffer; mime: string }> {
    const img = await this.contactRepo.getImage(contactId, adminUserId);
    if (!img) throw new NotFoundError("Profile image not found.");
    return { buffer: Buffer.from(img.profileImage), mime: img.mime };
  }

  async deleteImage(contactId: string, adminUserId: string): Promise<boolean> {
    return this.contactRepo.deleteImage(contactId, adminUserId);
  }

  async getMetrics(adminUserId: string): Promise<DashboardMetrics> {
    const metrics = await this.contactRepo.getMetrics(adminUserId);
    return {
      totalCodes: metrics.totalCodes,
      activeCodes: metrics.activeCodes,
      consumedCodes: metrics.consumedCodes,
      revokedCodes: metrics.revokedCodes,
      expiredCodes: metrics.expiredCodes,
      totalSubmissions: metrics.totalSubmissions,
      recentSubmissions: metrics.recentSubmissions.map(serializeContact),
      statusDistribution: metrics.statusDistribution as Record<FollowUpStatus, number>,
    };
  }

  async exportCsv(adminUserId: string): Promise<string> {
    const items = await this.contactRepo.exportAll(adminUserId);
    const headers = [
      "ID", "Full Name", "Phone Number", "Email", "Organization", "Role",
      "Profile URL", "Follow-up Status", "Notes", "Source Code Label", "Submitted At",
    ];
    const escape = (s: string | null) => {
      if (!s) return "";
      const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) return `"${safe.replace(/"/g, '""')}"`;
      return safe;
    };
    const rows = items.map((c) => [
      c.id, escape(c.fullName), escape(c.phoneNumber), escape(c.email), escape(c.organization),
      escape(c.role), escape(c.profileUrl), c.followUpStatus, escape(c.discussionNotes),
      escape(c.accessCode?.label || null), c.submittedAt.toISOString(),
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }
}
