import { ConnectMeApiClient } from "@connectme/api-client";

// Browser requests always use the same-origin Next.js proxy. This keeps the
// API_INTERNAL_URL server-only and avoids a separately configured browser CORS allow-list.
export const apiClient = new ConnectMeApiClient({
  baseUrl: "",
});
