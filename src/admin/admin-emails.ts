/**
 * @fileoverview Admin email whitelist utilities
 *
 * Provides functions for parsing and checking admin email whitelists,
 * typically used for bypassing rate limits and subscription checks.
 */

/**
 * Parse admin emails from environment variable or string
 *
 * @param input - Comma-separated string of admin emails (e.g., "admin@example.com, other@example.com")
 * @returns Array of normalized (lowercase, trimmed) email addresses
 *
 * @example
 * ```typescript
 * const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS || "");
 * // Returns: ["admin@example.com", "other@example.com"]
 * ```
 */
export function parseAdminEmails(input: string | undefined | null): string[] {
  if (!input) {
    return [];
  }

  return input
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0 && email.includes('@'));
}

/**
 * Check if an email is in the admin whitelist
 *
 * @param email - Email address to check
 * @param adminEmails - Array of admin emails (from parseAdminEmails)
 * @returns True if the email is an admin
 *
 * @example
 * ```typescript
 * const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS || "");
 * if (isAdminEmail(user.email, adminEmails)) {
 *   // Skip rate limiting, subscription checks, etc.
 * }
 * ```
 */
export function isAdminEmail(
  email: string | undefined | null,
  adminEmails: string[]
): boolean {
  if (!email) {
    return false;
  }

  return adminEmails.includes(email.toLowerCase());
}

/**
 * Create a cached admin email checker
 *
 * Parses the admin emails once and returns a checker function.
 * Useful for middleware where you don't want to re-parse on every request.
 *
 * @param input - Comma-separated string of admin emails
 * @returns Function that checks if an email is an admin
 *
 * @example
 * ```typescript
 * const isAdmin = createAdminChecker(process.env.ADMIN_EMAILS);
 *
 * // In middleware:
 * if (isAdmin(user.email)) {
 *   // Bypass checks
 * }
 * ```
 */
export function createAdminChecker(
  input: string | undefined | null
): (email: string | undefined | null) => boolean {
  const adminEmails = parseAdminEmails(input);

  return (email: string | undefined | null): boolean => {
    return isAdminEmail(email, adminEmails);
  };
}
