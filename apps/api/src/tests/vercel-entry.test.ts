import { describe, expect, it } from "vitest";
import defaultAppFromApp, { createApp as createAppFromApp } from "../app";
import defaultAppFromIndex, { createApp as createAppFromIndex } from "../index";

describe("Vercel entrypoint exports", () => {
  it("exports an Express application instance as default export from app.ts", () => {
    expect(defaultAppFromApp).toBeDefined();
    expect(typeof defaultAppFromApp).toBe("function");
    expect(typeof defaultAppFromApp.use).toBe("function");
    expect(typeof defaultAppFromApp.listen).toBe("function");
  });

  it("exports createApp factory function as named export from app.ts", () => {
    expect(typeof createAppFromApp).toBe("function");
    const freshApp = createAppFromApp();
    expect(typeof freshApp).toBe("function");
    expect(typeof freshApp.use).toBe("function");
  });

  it("exports an Express application instance as default export from index.ts", () => {
    expect(defaultAppFromIndex).toBeDefined();
    expect(typeof defaultAppFromIndex).toBe("function");
    expect(typeof defaultAppFromIndex.use).toBe("function");
    expect(typeof defaultAppFromIndex.listen).toBe("function");
  });

  it("exports createApp factory function as named export from index.ts", () => {
    expect(typeof createAppFromIndex).toBe("function");
  });
});
