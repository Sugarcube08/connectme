import { Router } from "express";
import multer from "multer";
import { PublicController } from "../controllers/public.controller";

const upload = multer({
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB limit
  storage: multer.memoryStorage(),
});

const router = Router();
const controller = new PublicController();

router.get("/codes/:token", controller.verifyCode);
router.post("/codes/:token/redeem", upload.single("profileImage"), controller.redeemCode);

export const publicRoutes = router;
