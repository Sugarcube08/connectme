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
  onUnauthorized?: () => void;
}

export class ConnectMeApiClient {
  private baseUrl: string;
  private getToken?: () => string | null | Promise<string | null>;
  private onUnauthorized?: () => void;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.getToken = config.getToken;
    this.onUnauthorized = config.onUnauthorized;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: "include", // For web session cookies
      });

      if (response.status === 401 && this.onUnauthorized) {
        this.onUnauthorized();
      }

      const json = await response.json();
      return json as ApiResponse<T>;
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: err.message || "Failed to communicate with API server.",
        },
      };
    }
  }

  // --- Public Endpoints ---

  async verifyCode(token: string): Promise<ApiResponse<PublicCodeVerificationResponse>> {
    return this.request<PublicCodeVerificationResponse>(`/public/codes/${token}`);
  }

  async redeemCode(
    token: string,
    data: ContactSubmissionInput,
    image?: any
  ): Promise<ApiResponse<SubmissionSuccessResponse>> {
    if (image) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          formData.append(key, String(val));
        }
      });
      formData.append("profileImage", image);

      return this.request<SubmissionSuccessResponse>(`/public/codes/${token}/redeem`, {
        method: "POST",
        body: formData,
      });
    }

    return this.request<SubmissionSuccessResponse>(`/public/codes/${token}/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  // --- Auth & Bootstrap ---

  async getBootstrapStatus(): Promise<ApiResponse<BootstrapStatusDTO>> {
    return this.request<BootstrapStatusDTO>("/auth/bootstrap/status");
  }

  async setupBootstrap(
    input: BootstrapSetupInput
  ): Promise<ApiResponse<{ user: AdminUserDTO; token: string }>> {
    return this.request<{ user: AdminUserDTO; token: string }>("/auth/bootstrap/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  async login(
    input: AdminLoginInput
  ): Promise<ApiResponse<{ user: AdminUserDTO; token: string }>> {
    return this.request<{ user: AdminUserDTO; token: string }>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  async logout(): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>("/auth/logout", {
      method: "POST",
    });
  }

  async getMe(): Promise<ApiResponse<{ user: AdminUserDTO }>> {
    return this.request<{ user: AdminUserDTO }>("/auth/me");
  }

  // --- Admin Dashboard & Codes ---

  async getDashboard(): Promise<ApiResponse<DashboardMetrics>> {
    return this.request<DashboardMetrics>("/admin/dashboard");
  }

  async listCodes(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<ApiResponse<AccessCodeItem[]>> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);

    const qs = query.toString();
    return this.request<AccessCodeItem[]>(`/admin/codes${qs ? `?${qs}` : ""}`);
  }

  async createCodes(params: {
    count?: number;
    label?: string;
    expiresAt?: string | null;
  }): Promise<ApiResponse<{ count: number; codes: GeneratedCodeDetail[] } | GeneratedCodeDetail>> {
    return this.request("/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  async revokeCode(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/admin/codes/${id}/revoke`, {
      method: "POST",
    });
  }

  // --- Admin Contacts ---

  async listContacts(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<ApiResponse<ContactItem[]>> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);

    const qs = query.toString();
    return this.request<ContactItem[]>(`/admin/contacts${qs ? `?${qs}` : ""}`);
  }

  async getContact(id: string): Promise<ApiResponse<ContactItem>> {
    return this.request<ContactItem>(`/admin/contacts/${id}`);
  }

  async updateContact(
    id: string,
    input: UpdateContactInput
  ): Promise<ApiResponse<ContactItem>> {
    return this.request<ContactItem>(`/admin/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  async deleteContactImage(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/admin/contacts/${id}/image`, {
      method: "DELETE",
    });
  }

  // --- Settings ---

  async getSettings(): Promise<ApiResponse<AppSettings>> {
    return this.request<AppSettings>("/admin/settings");
  }

  async updateSettings(input: UpdateSettingsInput): Promise<ApiResponse<AppSettings>> {
    return this.request<AppSettings>("/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }
}
