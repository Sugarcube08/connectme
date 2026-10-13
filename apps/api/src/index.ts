import app, { createApp } from "./app";

// Re-export the Express application as the default export and createApp as a named export.
// This ensures compatibility whether Vercel or external tooling invokes src/app.ts or src/index.ts.
export { createApp };
export default app;

