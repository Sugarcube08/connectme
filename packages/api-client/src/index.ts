import {
  ApiResponse,
  PublicCodeVerificationResponse,
  SubmissionSuccessResponse,
  ContactSubmissionInput,
  AdminLoginInput,
  BootstrapSetupInput,
  BootstrapStatusDTO,
  AdminUserDTO,
  DashboardMetrics,
  AccessCodeItem,
  GeneratedCodeDetail,
  ContactItem,
  AppSettings,
  UpdateContactInput,
  UpdateSettingsInput,
} from "@connectme/contracts";

export interface ApiClientConfig {
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
  getRefreshToken?: () => string | null | Promise<string | null>;
  onTokensRefreshed?: (tokens: { token: string; refreshToken: string }) => void | Promise<void>;
  onUnauthorized?: () => void | Promise<void>;
  clientType?: "mobile";
  /** Public visitor-facing web origin. Set by native clients only when they create QR codes directly. */
  publicOrigin?: string;
}

export class ConnectMeApiClient {
  private baseUrl: string;
  private getToken?: ApiClientConfig["getToken"];
  private getRefreshToken?: ApiClientConfig["getRefreshToken"];
  private onTokensRefreshed?: ApiClientConfig["onTokensRefreshed"];
  private onUnauthorized?: ApiClientConfig["onUnauthorized"];
  private clientType?: ApiClientConfig["clientType"];
  private publicOrigin?: string;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.getToken = config.getToken;
    this.getRefreshToken = config.getRefreshToken;
    this.onTokensRefreshed = config.onTokensRefreshed;
    this.onUnauthorized = config.onUnauthorized;
    this.clientType = config.clientType;
    this.publicOrigin = config.publicOrigin?.replace(/\/+$/, "");
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit, freshToken?: string): Promise<Response> {
    const headers = new Headers(options.headers || {});
    if (this.clientType) headers.set("X-ConnectMe-Client", this.clientType);
    if (this.getToken) {
      const savedToken = await this.getToken();
      const token = freshToken || savedToken;
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(`${this.baseUrl}/api/v1${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });
  }

  private async refreshAccessToken(): Promise<{ refreshed: boolean; token?: string }> {
    try {
      const refreshToken = await this.getRefreshToken?.();
      const headers = new Headers({ "Content-Type": "application/json" });
      if (this.clientType) headers.set("X-ConnectMe-Client", this.clientType);
      const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers,
        credentials: "include",
        ...(refreshToken ? { body: JSON.stringify({ refreshToken }) } : {}),
      });
      const result = await response.json();
      if (!response.ok || result?.success !== true) return { refreshed: false };

      if (this.clientType === "mobile") {
        if (typeof result.data?.token !== "string" || typeof result.data?.refreshToken !== "string") {
          return { refreshed: false };
        }
        await this.onTokensRefreshed?.({
          token: result.data.token,
          refreshToken: result.data.refreshToken,
        });
        return { refreshed: true, token: result.data.token };
      }

      // Browser refresh responses intentionally contain no bearer JWT. The API
      // rotates HTTP-only cookies, which the browser sends on the retried request.
      return { refreshed: true };
    } catch {
      return { refreshed: false };
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    allowRefresh = true
  ): Promise<ApiResponse<T>> {
    try {
      let response = await this.fetchWithAuth(endpoint, options);
      const authEndpoint = endpoint === "/auth/login" ||
        endpoint === "/auth/bootstrap/setup" ||
        endpoint === "/auth/refresh" ||
        endpoint === "/auth/logout";

      if (response.status === 401 && allowRefresh && !authEndpoint) {
        const refresh = await this.refreshAccessToken();
        if (refresh.refreshed) {
          response = await this.fetchWithAuth(endpoint, options, refresh.token);
        }
        if (response.status === 401) await this.onUnauthorized?.();
      }

      return await response.json() as ApiResponse<T>;
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: err?.message || "Failed to communicate with API server.",
        },
      };
    }
  }

  async verifyCode(token: string): Promise<ApiResponse<PublicCodeVerificationResponse>> {
    return this.request<PublicCodeVerificationResponse>(`/public/codes/${encodeURIComponent(token)}`);
  }

  async redeemCode(token: string, data: ContactSubmissionInput, image?: any): Promise<ApiResponse<SubmissionSuccessResponse>> {
    if (image) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, val]) => {
        if (val !== undefined && val !== null) formData.append(key, String(val));
      });
      formData.append("profileImage", image);
      return this.request<SubmissionSuccessResponse>(`/public/codes/${encodeURIComponent(token)}/redeem`, {
        method: "POST",
        body: formData,
      });
    }
    return this.request<SubmissionSuccessResponse>(`/public/codes/${encodeURIComponent(token)}/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async getBootstrapStatus(): Promise<ApiResponse<BootstrapStatusDTO>> {
    return this.request<BootstrapStatusDTO>("/auth/bootstrap/status");
  }

  async setupBootstrap(input: BootstrapSetupInput): Promise<ApiResponse<{ user: AdminUserDTO; token?: string; refreshToken?: string }>> {
    return this.request("/auth/bootstrap/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  async login(input: AdminLoginInput): Promise<ApiResponse<{ user: AdminUserDTO; token?: string; refreshToken?: string }>> {
    return this.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  async refresh(): Promise<ApiResponse<{ user: AdminUserDTO; token?: string; refreshToken?: string }>> {
    const refreshToken = await this.getRefreshToken?.();
    return this.request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(refreshToken ? { body: JSON.stringify({ refreshToken }) } : {}),
    }, false);
  }

  async logout(): Promise<ApiResponse<{ message: string }>> {
    const refreshToken = await this.getRefreshToken?.();
    return this.request("/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    }, false);
  }

  async getMe(): Promise<ApiResponse<{ user: AdminUserDTO }>> {
    return this.request("/auth/me");
  }

  async getDashboard(): Promise<ApiResponse<DashboardMetrics>> {
    return this.request("/admin/dashboard");
  }

  async listCodes(params?: { page?: number; limit?: number; status?: string; search?: string }): Promise<ApiResponse<AccessCodeItem[]>> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request(`/admin/codes${qs ? `?${qs}` : ""}`);
  }

  async createCodes(params: { count?: number; label?: string; expiresAt?: string | null }): Promise<ApiResponse<{ count: number; codes: GeneratedCodeDetail[] } | GeneratedCodeDetail>> {
    return this.request("/admin/codes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.publicOrigin ? { "X-ConnectMe-Public-Origin": this.publicOrigin } : {}),
      },
      body: JSON.stringify(params),
    });
  }

  async revokeCode(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/admin/codes/${encodeURIComponent(id)}/revoke`, { method: "POST" });
  }

  async listContacts(params?: { page?: number; limit?: number; status?: string; search?: string }): Promise<ApiResponse<ContactItem[]>> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request(`/admin/contacts${qs ? `?${qs}` : ""}`);
  }

  async getContact(id: string): Promise<ApiResponse<ContactItem>> {
    return this.request(`/admin/contacts/${encodeURIComponent(id)}`);
  }

  async updateContact(id: string, input: UpdateContactInput): Promise<ApiResponse<ContactItem>> {
    return this.request(`/admin/contacts/${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
  }

  async deleteContactImage(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/admin/contacts/${encodeURIComponent(id)}/image`, { method: "DELETE" });
  }

  async getSettings(): Promise<ApiResponse<AppSettings>> {
    return this.request("/admin/settings");
  }

  async updateSettings(input: UpdateSettingsInput): Promise<ApiResponse<AppSettings>> {
    return this.request("/admin/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
  }
}
