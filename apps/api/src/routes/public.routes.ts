import { Router } from "express";
import multer from "multer";
import { PublicController } from "../controllers/public.controller";
import { config } from "../config/env";

const upload = multer({
  limits: { fileSize: config.MAX_IMAGE_SIZE_BYTES },
  storage: multer.memoryStorage(),
});

const router = Router();
const controller = new PublicController();

router.get("/codes/:token", controller.verifyCode);
router.post("/codes/:token/redeem", upload.single("profileImage"), controller.redeemCode);

export const publicRoutes = router;
