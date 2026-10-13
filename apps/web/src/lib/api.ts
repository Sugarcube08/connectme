import { ConnectMeApiClient } from "@connectme/api-client";

// Empty means same-origin and is proxied by Next.js to API_INTERNAL_URL.
// For a direct browser-to-API deployment, set NEXT_PUBLIC_API_BASE_URL to the API origin.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const apiClient = new ConnectMeApiClient({
  baseUrl: API_BASE_URL,
});
