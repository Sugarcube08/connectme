import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "connectme_mobile_admin_access_token";
const REFRESH_TOKEN_KEY = "connectme_mobile_admin_refresh_token";

export async function saveAuthToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function saveRefreshToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function saveAuthTokens(token: string, refreshToken: string): Promise<void> {
  await Promise.all([saveAuthToken(token), saveRefreshToken(refreshToken)]);
}

export async function getAuthToken(): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY);
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem(REFRESH_TOKEN_KEY);
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function removeAuthToken(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
