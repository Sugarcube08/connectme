import { ConnectMeApiClient } from "@connectme/api-client";
import { getAuthToken, getRefreshToken, removeAuthToken, saveAuthTokens } from "./auth";
import { Platform } from "react-native";

const DEFAULT_HOST =
  Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_HOST;

export const mobileApiClient = new ConnectMeApiClient({
  baseUrl: API_BASE_URL,
  clientType: "mobile",
  publicOrigin: process.env.EXPO_PUBLIC_APP_URL,
  getToken: async () => await getAuthToken(),
  getRefreshToken: async () => await getRefreshToken(),
  onTokensRefreshed: async ({ token, refreshToken }) => {
    await saveAuthTokens(token, refreshToken);
  },
  onUnauthorized: async () => {
    await removeAuthToken();
  },
});
