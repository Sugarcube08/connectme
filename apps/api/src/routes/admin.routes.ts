import { Router } from "express";
import { CodesController } from "../controllers/codes.controller";
import { ContactsController } from "../controllers/contacts.controller";
import { SettingsController } from "../controllers/settings.controller";
import { requireAdmin } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import {
  UpdateContactSchema,
  UpdateSettingsSchema,
} from "@connectme/contracts";

const router = Router();
const codesController = new CodesController();
const contactsController = new ContactsController();
const settingsController = new SettingsController();

// All admin routes require authenticated active admin
router.use(requireAdmin);

// Dashboard
router.get("/dashboard", contactsController.getDashboard);

// Code Management
router.get("/codes", codesController.list);
router.post("/codes", codesController.create);
router.post("/codes/:id/revoke", codesController.revoke);
router.get("/codes/export", codesController.exportCsv);

// Contact Management
router.get("/contacts", contactsController.list);
router.get("/contacts/:id", contactsController.getById);
router.patch("/contacts/:id", validateBody(UpdateContactSchema), contactsController.update);
router.get("/contacts/:id/image", contactsController.getImage);
router.delete("/contacts/:id/image", contactsController.deleteImage);
router.get("/contacts/export", contactsController.exportCsv);

// Settings
router.get("/settings", settingsController.getSettings);
router.patch("/settings", validateBody(UpdateSettingsSchema), settingsController.updateSettings);

export const adminRoutes = router;
