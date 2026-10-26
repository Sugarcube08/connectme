import { z } from "zod";

export const ContactSubmissionSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(100, "Full name must be under 100 characters"),
  phoneNumber: z
    .string()
    .trim()
    .min(5, "Phone number is required")
    .max(30, "Phone number must be under 30 characters")
    .regex(/^[+0-9\s\-().]{5,30}$/, "Invalid phone number format"),
  email: z.string().trim().email("Invalid email address").max(150).optional().or(z.literal("")),
  organization: z.string().trim().max(100).optional().or(z.literal("")),
  role: z.string().trim().max(100).optional().or(z.literal("")),
  profileUrl: z.string().trim().max(250).optional().or(z.literal("")),
  discussionNotes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const RegisterSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(100, "Name must be under 100 characters"),
    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .max(150, "Email must be under 150 characters"),
    number: z
      .string()
      .trim()
      .min(5, "Phone number is required")
      .max(30, "Phone number must be under 30 characters")
      .optional(),
    phoneNumber: z
      .string()
      .trim()
      .min(5, "Phone number is required")
      .max(30, "Phone number must be under 30 characters")
      .optional(),
    username: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[a-z0-9][a-z0-9._-]*$/i, "Username must contain only letters, numbers, dots, hyphens, or underscores")
      .optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128)
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
  })
  .refine((data) => Boolean((data.number && data.number.length >= 5) || (data.phoneNumber && data.phoneNumber.length >= 5)), {
    message: "Phone number is required",
    path: ["number"],
  });

export const AdminLoginSchema = z.object({
  username: z.string().trim().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

export const CreateAdminSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  displayName: z.string().trim().max(100).optional(),
  password: z.string().min(8).max(128).regex(/[A-Z]/).regex(/[0-9]/),
});

export const CheckUsernameSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
});

export const BootstrapSetupSchema = z.object({
  token: z.string().trim().min(10, "Bootstrap setup token is required").optional(),
  username: z.string().trim().min(3, "Username must be at least 3 characters"),
  displayName: z.string().trim().max(100).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const GenerateCodeSchema = z.object({
  label: z.string().trim().max(100).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const BatchGenerateCodeSchema = z.object({
  count: z.number().int().min(1).max(100),
  label: z.string().trim().max(100).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const UpdateContactSchema = z.object({
  followUpStatus: z.enum(["NEW", "CONTACTED", "REPLIED", "OPPORTUNITY", "ARCHIVED"]).optional(),
  discussionNotes: z.string().trim().max(1000).optional(),
});

export const UpdateSettingsSchema = z.object({
  brandName: z.string().trim().min(1).max(50).optional(),
  privacyNotice: z.string().trim().max(2000).optional(),
  defaultExpiryDays: z.number().int().min(0).max(365).optional().nullable(),
});

export const UpdateAdminSmsSettingsSchema = z.object({
  smsEnabled: z.boolean().default(false),
  smsGatewayUrl: z
    .string()
    .trim()
    .url("SMS Gateway URL must be a valid URL")
    .optional()
    .or(z.literal("")),
  smsGatewayUsername: z.string().trim().max(100).optional().or(z.literal("")),
  smsGatewayPassword: z.string().max(250).optional().or(z.literal("")),
  smsTemplate: z.string().trim().max(1000).optional().or(z.literal("")),
  smsSenderPhone: z.string().trim().max(50).optional().or(z.literal("")),
  smsSenderEmail: z.string().trim().email("Invalid email address").max(150).optional().or(z.literal("")),
}).refine(
  (data) => {
    if (data.smsGatewayUrl && data.smsGatewayUrl.length > 0) {
      if (!data.smsGatewayUsername || data.smsGatewayUsername.length === 0) {
        return false;
      }
    }
    return true;
  },
  {
    message: "SMS Gateway Username is required when Gateway URL is configured.",
    path: ["smsGatewayUsername"],
  }
);

export type ContactSubmissionInput = z.infer<typeof ContactSubmissionSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;
export type CheckUsernameInput = z.infer<typeof CheckUsernameSchema>;
export type CreateAdminInput = z.infer<typeof CreateAdminSchema>;
export type BootstrapSetupInput = z.infer<typeof BootstrapSetupSchema>;
export type GenerateCodeInput = z.infer<typeof GenerateCodeSchema>;
export type BatchGenerateCodeInput = z.infer<typeof BatchGenerateCodeSchema>;
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>;
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;
export type UpdateAdminSmsSettingsInput = z.infer<typeof UpdateAdminSmsSettingsSchema>;
