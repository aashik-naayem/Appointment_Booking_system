/**
 * Unit tests for the permission/role system.
 */

import { describe, it, expect } from "vitest";
import { hasRole, isSuperAdmin, isOwner, isAdmin, isStaff } from "@/lib/permissions";
import { UserRole } from "@bookflow/database";

describe("hasRole – role hierarchy", () => {
  it("SUPER_ADMIN has all roles", () => {
    expect(hasRole(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN)).toBe(true);
    expect(hasRole(UserRole.SUPER_ADMIN, UserRole.OWNER)).toBe(true);
    expect(hasRole(UserRole.SUPER_ADMIN, UserRole.ADMIN)).toBe(true);
    expect(hasRole(UserRole.SUPER_ADMIN, UserRole.STAFF)).toBe(true);
  });

  it("OWNER has OWNER, ADMIN, STAFF but not SUPER_ADMIN", () => {
    expect(hasRole(UserRole.OWNER, UserRole.SUPER_ADMIN)).toBe(false);
    expect(hasRole(UserRole.OWNER, UserRole.OWNER)).toBe(true);
    expect(hasRole(UserRole.OWNER, UserRole.ADMIN)).toBe(true);
    expect(hasRole(UserRole.OWNER, UserRole.STAFF)).toBe(true);
  });

  it("ADMIN has ADMIN, STAFF but not OWNER or SUPER_ADMIN", () => {
    expect(hasRole(UserRole.ADMIN, UserRole.SUPER_ADMIN)).toBe(false);
    expect(hasRole(UserRole.ADMIN, UserRole.OWNER)).toBe(false);
    expect(hasRole(UserRole.ADMIN, UserRole.ADMIN)).toBe(true);
    expect(hasRole(UserRole.ADMIN, UserRole.STAFF)).toBe(true);
  });

  it("STAFF only has STAFF role", () => {
    expect(hasRole(UserRole.STAFF, UserRole.SUPER_ADMIN)).toBe(false);
    expect(hasRole(UserRole.STAFF, UserRole.OWNER)).toBe(false);
    expect(hasRole(UserRole.STAFF, UserRole.ADMIN)).toBe(false);
    expect(hasRole(UserRole.STAFF, UserRole.STAFF)).toBe(true);
  });
});

describe("Role predicate helpers", () => {
  it("isSuperAdmin returns true only for SUPER_ADMIN", () => {
    expect(isSuperAdmin(UserRole.SUPER_ADMIN)).toBe(true);
    expect(isSuperAdmin(UserRole.OWNER)).toBe(false);
    expect(isSuperAdmin(UserRole.ADMIN)).toBe(false);
    expect(isSuperAdmin(UserRole.STAFF)).toBe(false);
  });

  it("isOwner returns true for OWNER and SUPER_ADMIN", () => {
    expect(isOwner(UserRole.SUPER_ADMIN)).toBe(true);
    expect(isOwner(UserRole.OWNER)).toBe(true);
    expect(isOwner(UserRole.ADMIN)).toBe(false);
    expect(isOwner(UserRole.STAFF)).toBe(false);
  });

  it("isAdmin returns true for ADMIN, OWNER, SUPER_ADMIN", () => {
    expect(isAdmin(UserRole.SUPER_ADMIN)).toBe(true);
    expect(isAdmin(UserRole.OWNER)).toBe(true);
    expect(isAdmin(UserRole.ADMIN)).toBe(true);
    expect(isAdmin(UserRole.STAFF)).toBe(false);
  });

  it("isStaff returns true for all roles", () => {
    expect(isStaff(UserRole.SUPER_ADMIN)).toBe(true);
    expect(isStaff(UserRole.OWNER)).toBe(true);
    expect(isStaff(UserRole.ADMIN)).toBe(true);
    expect(isStaff(UserRole.STAFF)).toBe(true);
  });
});
