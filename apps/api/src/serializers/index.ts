import {
  AdminUserDTO,
  AccessCodeItem,
  ContactItem,
  CodeStatus,
  FollowUpStatus,
} from "@connectme/contracts";

export function serializeAdminUser(user: {
  id: string;
  username: string;
  displayName: string | null;
  isActive: boolean;
  isBootstrapPending: boolean;
  createdAt: Date;
}): AdminUserDTO {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    isActive: user.isActive,
    isBootstrapPending: user.isBootstrapPending,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeAccessCode(code: {
  id: string;
  label: string | null;
  status: string;
  createdAt: Date;
  expiresAt: Date | null;
  consumedAt: Date | null;
  revokedAt: Date | null;
  submission?: { id: string; fullName: string } | null;
}): AccessCodeItem {
  let effectiveStatus: CodeStatus = code.status as CodeStatus;
  if (effectiveStatus === "ACTIVE" && code.expiresAt && code.expiresAt < new Date()) {
    effectiveStatus = "EXPIRED";
  }

  return {
    id: code.id,
    label: code.label,
    status: effectiveStatus,
    createdAt: code.createdAt.toISOString(),
    expiresAt: code.expiresAt ? code.expiresAt.toISOString() : null,
    consumedAt: code.consumedAt ? code.consumedAt.toISOString() : null,
    revokedAt: code.revokedAt ? code.revokedAt.toISOString() : null,
    hasSubmission: !!code.submission,
    contactName: code.submission?.fullName || null,
  };
}

export function serializeContact(contact: {
  id: string;
  accessCodeId: string;
  accessCode?: { label: string | null } | null;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  organization: string | null;
  role: string | null;
  profileUrl: string | null;
  discussionNotes: string | null;
  submittedAt: Date;
  followUpStatus: string;
  image?: { id: string; mime: string; size: number } | null;
}): ContactItem {
  return {
    id: contact.id,
    accessCodeId: contact.accessCodeId,
    accessCodeLabel: contact.accessCode?.label || null,
    fullName: contact.fullName,
    phoneNumber: contact.phoneNumber,
    email: contact.email,
    organization: contact.organization,
    role: contact.role,
    profileUrl: contact.profileUrl,
    discussionNotes: contact.discussionNotes,
    hasImage: !!contact.image,
    imageMime: contact.image?.mime || null,
    imageSize: contact.image?.size || null,
    submittedAt: contact.submittedAt.toISOString(),
    followUpStatus: contact.followUpStatus as FollowUpStatus,
  };
}
