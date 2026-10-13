import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectMeApiClient } from "@connectme/api-client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client refresh handling", () => {
  it("retries a 401 with the newly issued access JWT, not the stale stored JWT", async () => {
    const authorizationHeaders: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.endsWith("/api/v1/auth/refresh")) {
        return jsonResponse(200, {
          success: true,
          data: { token: "fresh-access", refreshToken: "fresh-refresh" },
        });
      }

      authorizationHeaders.push(new Headers(init?.headers).get("Authorization") || "");
      if (new Headers(init?.headers).get("Authorization") === "Bearer fresh-access") {
        return jsonResponse(200, { success: true, data: { user: { id: "admin-1" } } });
      }
      return jsonResponse(401, {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Expired access token." },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new ConnectMeApiClient({
      baseUrl: "https://api.example.test",
      clientType: "mobile",
      getToken: () => "expired-access",
      getRefreshToken: () => "old-refresh",
      onTokensRefreshed: vi.fn(),
    });

    const result = await client.getMe();

    expect(result.success).toBe(true);
    expect(authorizationHeaders).toEqual(["Bearer expired-access", "Bearer fresh-access"]);
  });

  it("shares a single rotating refresh request across concurrent 401 responses", async () => {
    let refreshRequests = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.endsWith("/api/v1/auth/refresh")) {
        refreshRequests += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return jsonResponse(200, {
          success: true,
          data: { token: "fresh-access", refreshToken: "fresh-refresh" },
        });
      }

      if (new Headers(init?.headers).get("Authorization") === "Bearer fresh-access") {
        return jsonResponse(200, { success: true, data: { user: { id: "admin-1" } } });
      }
      return jsonResponse(401, {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Expired access token." },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new ConnectMeApiClient({
      baseUrl: "https://api.example.test",
      clientType: "mobile",
      getToken: () => "expired-access",
      getRefreshToken: () => "old-refresh",
      onTokensRefreshed: vi.fn(),
    });

    const results = await Promise.all([client.getMe(), client.getMe()]);

    expect(results.every((result) => result.success)).toBe(true);
    expect(refreshRequests).toBe(1);
  });
});
