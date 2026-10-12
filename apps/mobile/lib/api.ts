import { ConnectMeApiClient } from "@connectme/api-client";
import { getAuthToken, removeAuthToken } from "./auth";
import { Platform } from "react-native";

// On Android emulator, 10.0.2.2 maps to host 127.0.0.1; on iOS/Web localhost works.
const DEFAULT_HOST =
  Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || DEFAULT_HOST;

export const mobileApiClient = new ConnectMeApiClient({
  baseUrl: API_BASE_URL,
  getToken: async () => await getAuthToken(),
  onUnauthorized: async () => {
    await removeAuthToken();
  },
});
