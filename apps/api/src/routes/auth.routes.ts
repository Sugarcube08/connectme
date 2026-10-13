import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { requireAdmin } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { AdminLoginSchema, BootstrapSetupSchema } from "@connectme/contracts";

const router = Router();
const controller = new AuthController();

router.get("/bootstrap/status", controller.getBootstrapStatus);
router.post("/bootstrap/setup", validateBody(BootstrapSetupSchema), controller.setupBootstrap);
router.post("/login", validateBody(AdminLoginSchema), controller.login);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.get("/me", requireAdmin, controller.getMe);

export const authRoutes = router;
