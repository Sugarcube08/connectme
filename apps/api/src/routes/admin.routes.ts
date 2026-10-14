import { Router } from "express";
import { CodesController } from "../controllers/codes.controller";
import { ContactsController } from "../controllers/contacts.controller";
import { SettingsController } from "../controllers/settings.controller";
import { AuthController } from "../controllers/auth.controller";
import { requireAdmin } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateAdminSchema, UpdateContactSchema, UpdateSettingsSchema } from "@connectme/contracts";

const router = Router();
const codesController = new CodesController();
const contactsController = new ContactsController();
const settingsController = new SettingsController();
const authController = new AuthController();

router.use(requireAdmin);

router.get("/dashboard", contactsController.getDashboard);

// Additional administrators can be provisioned by any administrator.
router.get("/admins", authController.listAdmins);
router.post("/admins", validateBody(CreateAdminSchema), authController.createAdmin);

router.get("/codes", codesController.list);
router.post("/codes", codesController.create);
router.post("/codes/:id/revoke", codesController.revoke);
router.get("/codes/export", codesController.exportCsv);

router.get("/contacts", contactsController.list);
router.get("/contacts/:id", contactsController.getById);
router.patch("/contacts/:id", validateBody(UpdateContactSchema), contactsController.update);
router.get("/contacts/:id/image", contactsController.getImage);
router.delete("/contacts/:id/image", contactsController.deleteImage);
router.get("/contacts/export", contactsController.exportCsv);

router.get("/settings", settingsController.getSettings);
router.patch("/settings", validateBody(UpdateSettingsSchema), settingsController.updateSettings);

export const adminRoutes = router;
