import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import YAML from "yamljs";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/env";
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

  // Credentialed CORS must use an explicit origin allow-list, never "*".
  const allowedOrigins = config.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
  app.use(
    cors({
      origin: (origin, callback) => {
        // Native app clients and server-to-server requests usually omit Origin.
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin is not allowed by Connect Me CORS policy."));
      },
      credentials: true,
    })
  );

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
