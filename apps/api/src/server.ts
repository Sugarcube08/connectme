import { createApp } from "./app";
import { config } from "./config/env";
import { prisma } from "@connectme/database";

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`\n============================================================`);
  console.log(`CONNECT ME API SERVER (EXPRESS MVC)`);
  console.log(`============================================================`);
  console.log(`Port         : ${config.PORT}`);
  console.log(`Environment  : ${config.NODE_ENV}`);
  console.log(`Swagger Docs : http://localhost:${config.PORT}/api/docs`);
  console.log(`Health Check : http://localhost:${config.PORT}/health/ready`);
  console.log(`============================================================\n`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log("[Server] Database connections closed. Process exiting.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
