import { ConnectMeApiClient } from "@connectme/api-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const apiClient = new ConnectMeApiClient({
  baseUrl: API_BASE_URL,
});
