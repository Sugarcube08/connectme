/**
 * Validates the URI shape Prisma 6's MySQL connector expects.
 *
 * Prisma requires reserved characters in URL components (especially credentials)
 * to be percent-encoded. Keep this check independent of Prisma Client so the same
 * validation can run at API startup and before destructive integration tests.
 */
export function isValidMySqlUrl(value: string): boolean {
  if (!value || value !== value.trim() || /\s/.test(value)) return false;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (
    parsed.protocol !== "mysql:" ||
    !parsed.hostname ||
    !parsed.username ||
    parsed.hash ||
    (parsed.port !== "" && (!Number.isInteger(Number(parsed.port)) || Number(parsed.port) < 1 || Number(parsed.port) > 65535))
  ) {
    return false;
  }

  // Credentials must be present as user:password@host. Empty passwords are
  // syntactically permitted by MySQL, but credentials should normally be set.
  const remainder = value.slice("mysql://".length);
  const authorityEnd = remainder.search(/[/?#]/);
  const authority = authorityEnd === -1 ? remainder : remainder.slice(0, authorityEnd);
  const at = authority.lastIndexOf("@");
  if (at <= 0) return false;

  const userInfo = authority.slice(0, at);
  const separator = userInfo.indexOf(":");
  if (separator <= 0) return false;

  const rawUsername = userInfo.slice(0, separator);
  const rawPassword = userInfo.slice(separator + 1);
  const safelyEncodedComponent = /^(?:[A-Za-z0-9._~-]|%[0-9A-Fa-f]{2})*$/;

  if (!safelyEncodedComponent.test(rawUsername) || !safelyEncodedComponent.test(rawPassword)) {
    return false;
  }

  try {
    // Reject malformed percent escapes in every URL component. Decode only to
    // validate structure; keep the original encoded URL for Prisma.
    decodeURIComponent(parsed.username);
    decodeURIComponent(parsed.password);
    decodeURIComponent(parsed.pathname);
    decodeURIComponent(parsed.search);

    const databaseName = decodeURIComponent(parsed.pathname.slice(1));
    if (!databaseName || databaseName.includes("/") || databaseName.includes("\\")) return false;
  } catch {
    return false;
  }

  return true;
}
