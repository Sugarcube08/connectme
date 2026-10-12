export * from "@connectme/validation";

// --- Enums ---
export type CodeStatus = "ACTIVE" | "CONSUMED" | "REVOKED" | "EXPIRED";
export type FollowUpStatus = "NEW" | "CONTACTED" | "REPLIED" | "OPPORTUNITY" | "ARCHIVED";

// --- DTOs ---

export interface AdminUserDTO {
  id: string;
  username: string;
  displayName: string | null;
  isActive: boolean;
  isBootstrapPending: boolean;
  createdAt: string;
}

export interface BootstrapStatusDTO {
  isBootstrapPending: boolean;
  username?: string;
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

export interface PublicCodeVerificationResponse {
  eligible: boolean;
  codeStatus: CodeStatus;
  brandName?: string;
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
