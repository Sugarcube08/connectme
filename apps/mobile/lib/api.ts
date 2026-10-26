import { ConnectMeApiClient } from "@connectme/api-client";
import { getAuthToken, getRefreshToken, removeAuthToken, saveAuthTokens } from "./auth";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";
export const APP_URL = process.env.EXPO_PUBLIC_APP_URL || "";

export const mobileApiClient = new ConnectMeApiClient({
  baseUrl: API_BASE_URL,
  clientType: "mobile",
  publicOrigin: APP_URL || undefined,
  getToken: async () => await getAuthToken(),
  getRefreshToken: async () => await getRefreshToken(),
  onTokensRefreshed: async ({ token, refreshToken }) => {
    await saveAuthTokens(token, refreshToken);
  },
  onUnauthorized: async () => {
    await removeAuthToken();
  },
});
