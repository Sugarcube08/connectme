import { createApp } from "./app";

// Vercel detects this file as the Express serverless entry point when the
// Vercel project's Root Directory is set to apps/api. Keep server.ts for
// ordinary Node/Docker deployments, where it owns the HTTP listener.
const app = createApp();

export default app;
