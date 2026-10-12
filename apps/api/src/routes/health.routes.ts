import { Router } from "express";
import { HealthController } from "../controllers/health.controller";

const router = Router();
const controller = new HealthController();

router.get("/live", controller.live);
router.get("/ready", controller.ready);

export const healthRoutes = router;
