import { Request, Response, NextFunction } from "express";
import { ContactService } from "../services/contact.service";

export class ContactsController {
  constructor(private contactService = new ContactService()) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const limit = parseInt((req.query.limit as string) || "20", 10);
      const result = await this.contactService.list({
        adminUserId: req.adminUser!.id,
        page, limit,
        status: (req.query.status as any) || undefined,
        search: (req.query.search as string) || undefined,
      });
      return res.status(200).json({
        success: true, data: result.contacts,
        meta: { page, limit, total: result.total, totalPages: result.totalPages },
      });
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return res.status(200).json({
        success: true,
        data: await this.contactService.getById(String(req.params.id), req.adminUser!.id),
      });
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await this.contactService.update(String(req.params.id), req.adminUser!.id, req.body);
      return res.status(200).json({ success: true, data: updated });
    } catch (err) { next(err); }
  };

  getImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const img = await this.contactService.getImage(String(req.params.id), req.adminUser!.id);
      res.setHeader("Content-Type", img.mime);
      res.setHeader("Content-Length", img.buffer.length.toString());
      res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
      return res.status(200).send(img.buffer);
    } catch (err) { next(err); }
  };

  deleteImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleted = await this.contactService.deleteImage(String(req.params.id), req.adminUser!.id);
      return res.status(200).json({
        success: true,
        data: { message: deleted ? "Profile picture deleted." : "No picture found." },
      });
    } catch (err) { next(err); }
  };

  exportCsv = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const csv = await this.contactService.exportCsv(req.adminUser!.id);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="connectme-contacts-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.status(200).send(csv);
    } catch (err) { next(err); }
  };

  getDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const metrics = await this.contactService.getMetrics(req.adminUser!.id);
      return res.status(200).json({ success: true, data: metrics });
    } catch (err) { next(err); }
  };
}
