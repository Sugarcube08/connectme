import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import YAML from "yamljs";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/env";
import { isAllowedCorsOrigin } from "./config/origin";
import { healthRoutes } from "./routes/health.routes";
import { publicRoutes } from "./routes/public.routes";
import { authRoutes } from "./routes/auth.routes";
import { adminRoutes } from "./routes/admin.routes";
import { errorHandler } from "./middleware/error.middleware";

export function createApp(): Express {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // CORS is inferred from the request host and Vercel system domains. The
  // Next.js server-side proxy strips Origin, and native clients usually omit it.
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (!origin) return next();

    if (!isAllowedCorsOrigin(origin, req)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "CORS_ORIGIN_DENIED",
          message: "This browser origin is not allowed. Use the same-origin web proxy.",
        },
      });
    }

    return cors({ origin, credentials: true })(req, res, next);
  });

  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  const possibleOpenApiPaths = [
    path.resolve(process.cwd(), "docs/openapi.yaml"),
    path.resolve(process.cwd(), "../../docs/openapi.yaml"),
  ];
  const openApiPath = possibleOpenApiPaths.find((candidate) => fs.existsSync(candidate));
  if (openApiPath) {
    try {
      const swaggerDocument = YAML.load(openApiPath);
      app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
      app.get("/api/v1/docs.yaml", (_req, res) => res.sendFile(openApiPath));
    } catch (err) {
      console.warn("[Swagger] Could not load openapi.yaml:", err);
    }
  }

  app.use("/health", healthRoutes);
  app.use("/api/v1/public", publicRoutes);
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/admin", adminRoutes);
  app.use(errorHandler);
  return app;
}
