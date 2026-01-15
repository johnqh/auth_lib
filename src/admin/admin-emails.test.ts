import { describe, expect, it } from 'vitest';
import {
  parseAdminEmails,
  isAdminEmail,
  createAdminChecker,
} from './admin-emails';

describe('parseAdminEmails', () => {
  it('parses single email', () => {
    expect(parseAdminEmails('admin@example.com')).toEqual([
      'admin@example.com',
    ]);
  });

  it('parses multiple emails', () => {
    expect(parseAdminEmails('admin@example.com,other@example.com')).toEqual([
      'admin@example.com',
      'other@example.com',
    ]);
  });

  it('trims whitespace around emails', () => {
    expect(
      parseAdminEmails('  admin@example.com , other@example.com  ')
    ).toEqual(['admin@example.com', 'other@example.com']);
  });

  it('converts emails to lowercase', () => {
    expect(parseAdminEmails('ADMIN@Example.COM')).toEqual([
      'admin@example.com',
    ]);
  });

  it('filters out empty strings', () => {
    expect(parseAdminEmails('admin@example.com,,other@example.com')).toEqual([
      'admin@example.com',
      'other@example.com',
    ]);
  });

  it('filters out strings without @', () => {
    expect(
      parseAdminEmails('admin@example.com,notanemail,other@example.com')
    ).toEqual(['admin@example.com', 'other@example.com']);
  });

  it('returns empty array for empty string', () => {
    expect(parseAdminEmails('')).toEqual([]);
  });

  it('returns empty array for null', () => {
    expect(parseAdminEmails(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
  });

  it('handles whitespace-only input', () => {
    expect(parseAdminEmails('   ')).toEqual([]);
  });

  it('handles commas with no valid emails', () => {
    expect(parseAdminEmails(',,,')).toEqual([]);
  });
});

describe('isAdminEmail', () => {
  const adminEmails = ['admin@example.com', 'other@example.com'];

  it('returns true for admin email', () => {
    expect(isAdminEmail('admin@example.com', adminEmails)).toBe(true);
  });

  it('returns true for case-insensitive match', () => {
    expect(isAdminEmail('ADMIN@Example.COM', adminEmails)).toBe(true);
  });

  it('returns false for non-admin email', () => {
    expect(isAdminEmail('user@example.com', adminEmails)).toBe(false);
  });

  it('returns false for null email', () => {
    expect(isAdminEmail(null, adminEmails)).toBe(false);
  });

  it('returns false for undefined email', () => {
    expect(isAdminEmail(undefined, adminEmails)).toBe(false);
  });

  it('returns false for empty string email', () => {
    expect(isAdminEmail('', adminEmails)).toBe(false);
  });

  it('returns false when admin list is empty', () => {
    expect(isAdminEmail('admin@example.com', [])).toBe(false);
  });
});

describe('createAdminChecker', () => {
  it('creates checker that returns true for admin', () => {
    const isAdmin = createAdminChecker('admin@example.com,other@example.com');
    expect(isAdmin('admin@example.com')).toBe(true);
    expect(isAdmin('other@example.com')).toBe(true);
  });

  it('creates checker that returns false for non-admin', () => {
    const isAdmin = createAdminChecker('admin@example.com');
    expect(isAdmin('user@example.com')).toBe(false);
  });

  it('creates checker that handles case-insensitive matching', () => {
    const isAdmin = createAdminChecker('admin@example.com');
    expect(isAdmin('ADMIN@Example.COM')).toBe(true);
  });

  it('creates checker that handles null input', () => {
    const isAdmin = createAdminChecker(null);
    expect(isAdmin('admin@example.com')).toBe(false);
  });

  it('creates checker that handles undefined input', () => {
    const isAdmin = createAdminChecker(undefined);
    expect(isAdmin('admin@example.com')).toBe(false);
  });

  it('creates checker that handles empty string input', () => {
    const isAdmin = createAdminChecker('');
    expect(isAdmin('admin@example.com')).toBe(false);
  });

  it('creates checker that returns false for null email', () => {
    const isAdmin = createAdminChecker('admin@example.com');
    expect(isAdmin(null)).toBe(false);
  });

  it('creates checker that returns false for undefined email', () => {
    const isAdmin = createAdminChecker('admin@example.com');
    expect(isAdmin(undefined)).toBe(false);
  });
});
