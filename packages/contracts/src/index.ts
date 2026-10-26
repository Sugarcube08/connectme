export * from "@connectme/validation";

// --- Enums ---
export type CodeStatus = "ACTIVE" | "CONSUMED" | "REVOKED" | "EXPIRED";
export type FollowUpStatus = "NEW" | "CONTACTED" | "REPLIED" | "OPPORTUNITY" | "ARCHIVED";

// --- DTOs ---

export interface AdminUserDTO {
  id: string;
  username: string;
  displayName: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  isActive: boolean;
  isInitialAdmin?: boolean | null;
  isBootstrapPending: boolean;
  createdAt: string;
  createdById?: string | null;
  createdBy?: {
    id: string;
    username: string;
    displayName: string | null;
  } | null;
}

export interface CheckUsernameDTO {
  exists: boolean;
  isInitialAdmin?: boolean;
  needsSetup?: boolean;
  displayName?: string;
}

export interface BootstrapStatusDTO {
  isBootstrapPending: boolean;
  hasExpired?: boolean;
}

export interface AccessCodeItem {
  id: string;
  label: string | null;
  status: CodeStatus;
  createdAt: string;
  expiresAt: string | null;
  consumedAt: string | null;
  revokedAt: string | null;
  hasSubmission: boolean;
  contactName?: string | null;
  token?: string | null;
  url?: string | null;
  canPrint?: boolean;
}

export interface GeneratedCodeDetail extends AccessCodeItem {
  token: string;
  url: string;
  qrDataUrl: string;
}

export interface ContactItem {
  id: string;
  accessCodeId: string;
  accessCodeLabel: string | null;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  organization: string | null;
  role: string | null;
  profileUrl: string | null;
  discussionNotes: string | null;
  hasImage: boolean;
  imageMime: string | null;
  imageSize: number | null;
  imageUrl?: string | null;
  submittedAt: string;
  followUpStatus: FollowUpStatus;
}

export interface DashboardMetrics {
  totalCodes: number;
  activeCodes: number;
  consumedCodes: number;
  revokedCodes: number;
  expiredCodes: number;
  totalSubmissions: number;
  recentSubmissions: ContactItem[];
  statusDistribution: Record<FollowUpStatus, number>;
}

export interface AppSettings {
  brandName: string;
  privacyNotice: string;
  defaultExpiryDays: number | null;
}

export interface AdminSmsSettingsDTO {
  smsEnabled: boolean;
  smsGatewayUrl: string | null;
  smsGatewayUsername: string | null;
  hasPassword: boolean;
  smsTemplate: string | null;
  smsSenderPhone: string | null;
  smsSenderEmail: string | null;
}

export interface PublicCodeVerificationResponse {
  eligible: boolean;
  codeStatus: CodeStatus;
  brandName?: string;
  message?: string;
  requiresSmsNotice?: boolean;
  smsNotice?: string;
  smsConfigured?: boolean;
  smsGatewayUrl?: string | null;
  smsStartupHeartbeatUrl?: string | null;
}

export interface StartupHeartbeatResponse {
  ready: boolean;
  status?: number;
  message?: string;
}

export interface SubmissionSuccessResponse {
  success: boolean;
  message: string;
  submittedAt: string;
}

// --- API Standard Envelope ---

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
