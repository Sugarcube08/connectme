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

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Swagger UI and local development
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // CORS Configuration
  const allowedOrigins = config.CORS_ORIGIN.split(",").map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          callback(null, true);
        } else {
          callback(null, true); // Allow all in dev mode
        }
      },
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  // Swagger UI for OpenAPI 3.1
  const possibleOpenApiPaths = [
    path.resolve(process.cwd(), "docs/openapi.yaml"),
    path.resolve(process.cwd(), "../../docs/openapi.yaml"),
  ];
  const openApiPath = possibleOpenApiPaths.find((p) => fs.existsSync(p));

  if (openApiPath) {
    try {
      const swaggerDocument = YAML.load(openApiPath);
      app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
      app.get("/api/v1/docs.yaml", (req, res) => {
        res.sendFile(openApiPath);
      });
    } catch (err) {
      console.warn("[Swagger] Could not load openapi.yaml:", err);
    }
  }

  // Health Checks
  app.use("/health", healthRoutes);

  // Versioned API v1 Routes
  app.use("/api/v1/public", publicRoutes);
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/admin", adminRoutes);

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}
