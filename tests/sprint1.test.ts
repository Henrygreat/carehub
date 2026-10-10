import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const model = () => ({
    create: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  });
  return {
    db: {
      user: model(),
      staffProfile: model(),
      employmentRecord: model(),
      auditLog: model(),
      membership: model(),
      invitation: model(),
      passwordResetToken: model(),
      rateLimitBucket: model(),
      $transaction: vi.fn(),
    },
    resolveTenantContext: vi.fn(),
    enforceRateLimit: vi.fn(),
    enforceRequestRateLimit: vi.fn(),
    verifyPassword: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/tenant", () => ({
  resolveTenantContext: mocks.resolveTenantContext,
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  TenantAccessError: class TenantAccessError extends Error {},
}));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  enforceRequestRateLimit: mocks.enforceRequestRateLimit,
  RateLimitError: class RateLimitError extends Error {},
}));
vi.mock("@/lib/password", () => ({ verifyPassword: mocks.verifyPassword }));

import { authenticateCredentials } from "@/lib/authenticate";
import { hasPermission } from "@/lib/permissions";
import { createStaffListQuery } from "@/lib/staff-query";
import { isSingleUseTokenUsable } from "@/lib/tokens";
import { POST as createStaff } from "@/app/api/v1/staff/route";
import { GET as getStaffMember, PATCH as updateStaff } from "@/app/api/v1/staff/[id]/route";
import { POST as deactivateStaff } from "@/app/api/v1/staff/[id]/deactivate/route";
import { POST as acceptInvitation } from "@/app/api/v1/auth/invitations/accept/route";
import { POST as confirmPasswordReset } from "@/app/api/v1/auth/password-reset/confirm/route";

const organisationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const staffId = "33333333-3333-4333-8333-333333333333";
const membershipId = "44444444-4444-4444-8444-444444444444";
const staffInput = {
  employeeNumber: "FC-101",
  firstName: "Morgan",
  lastName: "Example",
  email: "morgan@example.test",
  phone: "+447700900123",
  employmentStatus: "ACTIVE",
  employmentType: "FULL_TIME",
  jobTitle: "Care worker",
  startDate: "2025-01-01",
  contractedWeeklyHours: 37.5,
};

function request(url: string, method: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: {
      origin: "http://localhost",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const transactionModels = {
  staffProfile: { create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  employmentRecord: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  membership: { updateMany: vi.fn() },
  invitation: { updateMany: vi.fn() },
  passwordResetToken: { updateMany: vi.fn() },
  user: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
};

beforeEach(() => {
  vi.resetAllMocks();
  process.env.APP_URL = "http://localhost";
  mocks.resolveTenantContext.mockResolvedValue({
    userId,
    membership: { id: membershipId, role: "ORG_ADMIN", organisationId },
    organisation: { id: organisationId, name: "Falcon Carers" },
  });
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.enforceRequestRateLimit.mockResolvedValue(undefined);
  mocks.db.$transaction.mockImplementation(async (operation) =>
    typeof operation === "function"
      ? operation(transactionModels)
      : Promise.all(operation),
  );
  transactionModels.staffProfile.create.mockResolvedValue({
    id: staffId,
    ...staffInput,
    organisationId,
  });
  transactionModels.staffProfile.upsert.mockResolvedValue({});
  transactionModels.employmentRecord.create.mockResolvedValue({});
  transactionModels.auditLog.create.mockResolvedValue({});
  transactionModels.staffProfile.update.mockResolvedValue({ id: staffId, ...staffInput });
  transactionModels.membership.updateMany.mockResolvedValue({ count: 1 });
  transactionModels.invitation.updateMany.mockResolvedValue({ count: 1 });
  transactionModels.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
  transactionModels.user.update.mockResolvedValue({});
  mocks.db.staffProfile.findFirst.mockResolvedValue({
    id: staffId,
    membershipUserId: null,
    employmentStatus: "ACTIVE",
  });
});

describe("Sprint 1 security and staff API", () => {
  it("authenticates a valid organisation user", async () => {
    mocks.db.user.findUnique.mockResolvedValue({
      id: userId,
      name: "Morgan Example",
      email: "morgan@example.test",
      passwordHash: "stored-hash",
      disabledAt: null,
      memberships: [{ id: membershipId }],
    });
    mocks.verifyPassword.mockResolvedValue(true);

    await expect(
      authenticateCredentials(
        { email: "MORGAN@example.test", password: "valid-password" },
        "127.0.0.1",
      ),
    ).resolves.toEqual({ id: userId, email: "morgan@example.test", name: "Morgan Example" });
  });

  it("rejects an invalid login without disclosing the account", async () => {
    mocks.db.user.findUnique.mockResolvedValue(null);

    await expect(
      authenticateCredentials({ email: "unknown@example.test", password: "incorrect" }),
    ).resolves.toBeNull();
  });

  it("rejects an expired invitation", async () => {
    mocks.db.invitation.findUnique.mockResolvedValue({
      id: "invitation-id",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() - 1000),
      acceptedAt: null,
    });
    const response = await acceptInvitation(
      request("/api/v1/auth/invitations/accept", "POST", {
        token: "a".repeat(43),
        name: "Morgan Example",
        password: "a-long-password-that-is-valid",
      }),
    );

    expect(response.status).toBe(400);
    expect(transactionModels.invitation.updateMany).not.toHaveBeenCalled();
  });

  it("does not allow a password-reset token to be reused", async () => {
    mocks.db.passwordResetToken.findUnique.mockResolvedValue({
      id: "reset-id",
      userId,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
    });
    const response = await confirmPasswordReset(
      request("/api/v1/auth/password-reset/confirm", "POST", {
        token: "b".repeat(43),
        password: "a-long-password-that-is-valid",
      }),
    );

    expect(response.status).toBe(400);
    expect(transactionModels.passwordResetToken.updateMany).not.toHaveBeenCalled();
    expect(isSingleUseTokenUsable({ expiresAt: new Date(Date.now() + 1_000), consumedAt: new Date() })).toBe(false);
  });

  it("allows an organisation administrator to create staff with an audit record", async () => {
    const response = await createStaff(
      request("/api/v1/staff", "POST", staffInput),
    );

    expect(response.status).toBe(201);
    expect(transactionModels.staffProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organisationId }),
    });
    expect(transactionModels.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "staff.created", organisationId }),
    });
  });

  it("blocks a coordinator from editing staff", async () => {
    mocks.resolveTenantContext.mockResolvedValue({
      userId,
      membership: { id: membershipId, role: "COORDINATOR", organisationId },
      organisation: { id: organisationId, name: "Falcon Carers" },
    });
    const response = await updateStaff(
      request(`/api/v1/staff/${staffId}`, "PATCH", staffInput),
      { params: Promise.resolve({ id: staffId }) },
    );

    expect(response.status).toBe(403);
    expect(transactionModels.staffProfile.update).not.toHaveBeenCalled();
  });

  it("prevents a care worker from reading another worker's protected profile", async () => {
    mocks.resolveTenantContext.mockResolvedValue({
      userId,
      membership: { id: membershipId, role: "CARE_WORKER", organisationId },
      organisation: { id: organisationId, name: "Falcon Carers" },
    });
    mocks.db.staffProfile.findFirst.mockResolvedValue({
      id: staffId,
      organisationId,
      membershipUserId: "55555555-5555-4555-8555-555555555555",
    });
    const response = await getStaffMember(request(`/api/v1/staff/${staffId}`, "GET"), {
      params: Promise.resolve({ id: staffId }),
    });

    expect(response.status).toBe(404);
  });

  it("hides another worker's profile from care-worker edit attempts", async () => {
    mocks.resolveTenantContext.mockResolvedValue({
      userId,
      membership: { id: membershipId, role: "CARE_WORKER", organisationId },
      organisation: { id: organisationId, name: "Falcon Carers" },
    });
    mocks.db.staffProfile.findFirst.mockResolvedValue({
      id: staffId,
      membershipUserId: "55555555-5555-4555-8555-555555555555",
      employmentStatus: "ACTIVE",
    });
    const response = await updateStaff(
      request(`/api/v1/staff/${staffId}`, "PATCH", {}),
      { params: Promise.resolve({ id: staffId }) },
    );

    expect(response.status).toBe(404);
    expect(transactionModels.staffProfile.update).not.toHaveBeenCalled();
  });

  it("scopes staff access to the active tenant", async () => {
    mocks.db.staffProfile.findFirst.mockResolvedValue(null);
    const response = await getStaffMember(request(`/api/v1/staff/${staffId}`, "GET"), {
      params: Promise.resolve({ id: staffId }),
    });

    expect(response.status).toBe(404);
    expect(mocks.db.staffProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: staffId, organisationId } }),
    );
  });

  it("returns conflict for a duplicate employee number", async () => {
    mocks.db.$transaction.mockRejectedValue({ code: "P2002" });
    const response = await createStaff(request("/api/v1/staff", "POST", staffInput));

    expect(response.status).toBe(409);
  });

  it("deactivates staff without deleting their profile or employment history", async () => {
    const response = await deactivateStaff(
      request(`/api/v1/staff/${staffId}/deactivate`, "POST"),
      { params: Promise.resolve({ id: staffId }) },
    );

    expect(response.status).toBe(200);
    expect(transactionModels.staffProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_organisationId: { id: staffId, organisationId } },
        data: { employmentStatus: "INACTIVE" },
      }),
    );
    expect(transactionModels.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "staff.deactivated" }) }),
    );
    expect(hasPermission("COORDINATOR", "staff:deactivate")).toBe(false);
  });

  it("searches and paginates staff within the tenant", async () => {
    const query = createStaffListQuery({
      organisationId,
      role: "ORG_ADMIN",
      userId,
      query: "Jamie",
      status: "ACTIVE",
      page: 2,
    });

    expect(query.where).toMatchObject({
      organisationId,
      employmentStatus: "ACTIVE",
      OR: [
        { firstName: { contains: "Jamie", mode: "insensitive" } },
        { lastName: { contains: "Jamie", mode: "insensitive" } },
        { employeeNumber: { contains: "Jamie", mode: "insensitive" } },
      ],
    });
    expect(query).toMatchObject({ skip: 20, take: 20 });
  });

  it("returns a tenant-scoped search result with page metadata", async () => {
    mocks.db.staffProfile.count.mockResolvedValue(21);
    mocks.db.staffProfile.findMany.mockResolvedValue([
      {
        id: staffId,
        employeeNumber: "FC-101",
        firstName: "Jamie",
        lastName: "Taylor",
        employmentStatus: "ACTIVE",
        jobTitle: "Care worker",
      },
    ]);
    mocks.db.$transaction.mockImplementation(async (operations) =>
      Promise.all(operations as Promise<unknown>[]),
    );
    const response = await import("@/app/api/v1/staff/route").then(({ GET }) =>
      GET(new Request("http://localhost/api/v1/staff?q=Jamie&page=2")),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pagination).toEqual({ page: 2, pageSize: 20, total: 21, totalPages: 2 });
    expect(mocks.db.staffProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organisationId, OR: expect.any(Array) }),
        skip: 20,
        take: 20,
      }),
    );
  });

  it("defines tenant-composite foreign keys for staff and employment history", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toContain("@@unique([id, organisationId])");
    expect(schema).toContain("references: [id, organisationId]");
    expect(schema).toContain("@@unique([userId, organisationId])");
  });
});
