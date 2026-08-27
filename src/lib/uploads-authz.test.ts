// Authorization tests for the document download route.
// Imports the actual production predicate so any change there must
// update these tests, not a separate mirror.

import { describe, it, expect } from "vitest";
import { canViewDocument } from "@/lib/document-authz";

describe("canViewDocument (mirrors /api/documents/[id])", () => {
  const userOwned = { ownerUserId: "user_abc", ownerClientId: null };
  const clientOwned = { ownerUserId: null, ownerClientId: "client_xyz" };

  it("owner can view their own user-owned document", () => {
    expect(canViewDocument(userOwned, { userId: "user_abc", roles: ["HEALER"] })).toBe(true);
  });

  it("a different healer cannot view someone else's user-owned document", () => {
    expect(canViewDocument(userOwned, { userId: "user_def", roles: ["HEALER"] })).toBe(false);
  });

  it("ADMIN can view any user-owned document", () => {
    expect(canViewDocument(userOwned, { userId: "admin_1", roles: ["ADMIN"] })).toBe(true);
  });

  it("SUPER_ADMIN can view any user-owned document", () => {
    expect(canViewDocument(userOwned, { userId: "sa_1", roles: ["SUPER_ADMIN"] })).toBe(true);
  });

  it("QUALITY_CONTROLLER can view any user-owned document", () => {
    expect(canViewDocument(userOwned, { userId: "qc_1", roles: ["QUALITY_CONTROLLER"] })).toBe(true);
  });

  it("COORDINATOR cannot view a user-owned document they don't own", () => {
    expect(canViewDocument(userOwned, { userId: "coord_1", roles: ["COORDINATOR"] })).toBe(false);
  });

  it("COUNSELLOR cannot view a user-owned document they don't own", () => {
    expect(canViewDocument(userOwned, { userId: "couns_1", roles: ["COUNSELLOR"] })).toBe(false);
  });

  it("client-owned documents have null ownerUserId — non-elevated user fails ownership check", () => {
    // ownerUserId is null; null === "user_x" is false; isOwner = false.
    // Non-elevated role → forbidden.
    expect(canViewDocument(clientOwned, { userId: "any_user", roles: ["HEALER"] })).toBe(false);
  });

  it("client-owned documents are visible to elevated roles", () => {
    expect(canViewDocument(clientOwned, { userId: "qc_1", roles: ["QUALITY_CONTROLLER"] })).toBe(true);
  });

  it("ownerUserId being empty string does not accidentally match", () => {
    // Defensive: an empty-string userId in the session shouldn't match
    // a null ownerUserId. (Should never happen in practice; here as a
    // regression check.)
    expect(canViewDocument(clientOwned, { userId: "", roles: ["HEALER"] })).toBe(false);
  });
});
