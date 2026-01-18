/**
 * @fileoverview Admin utilities exports
 *
 * Re-exports admin utilities from @sudobility/types for backwards compatibility.
 * These utilities are now defined in @sudobility/types to be shared between
 * frontend (auth_lib) and backend (auth_service) packages.
 */

export {
  parseAdminEmails,
  isAdminEmail,
  createAdminChecker,
} from '@sudobility/types';
