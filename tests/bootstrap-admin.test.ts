import { describe, expect, it, vi } from "vitest";
import { bootstrapAdmin, BootstrapError, validateInput } from "../scripts/bootstrap-admin.mjs";

const input = {
  email: "Admin@Falcon.Example.Test",
  name: "Fictional Admin",
  password: "a-long-test-passphrase-1",
  organisationName: "Falcon Carers",
  organisationSlug: "falcon-carers",
};

function makeDb(overrides: Record<string, unknown> = {}) {
  const tx = {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "user-1" }),
    },
    organisation: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "org-1", name: "Falcon Carers" }),
    },
    membership: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "membership-1" }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    ...overrides,
  };
  return { tx, db: { $transaction: vi.fn(async (run: (t: typeof tx) => unknown) => run(tx)) } };
}

const hasher = vi.fn(async (value: string) => `hashed:${value.length}`);

describe("administrator bootstrap", () => {
  it("creates the organisation, user, ORG_ADMIN membership and audit event", async () => {
    const { db, tx } = makeDb();
    const result = await bootstrapAdmin(db, input, hasher);

    expect(result).toEqual({ organisationName: "Falcon Carers", reusedOrganisation: false });
    expect(tx.user.create.mock.calls[0][0].data).toMatchObject({
      email: "admin@falcon.example.test",
      passwordHash: "hashed:24",
    });
    expect(JSON.stringify(tx.user.create.mock.calls[0][0].data)).not.toContain(input.password);
    expect(tx.membership.create.mock.calls[0][0].data).toMatchObject({
      organisationId: "org-1",
      role: "ORG_ADMIN",
    });
    const audit = JSON.stringify(tx.auditLog.create.mock.calls[0][0]);
    expect(audit).not.toContain(input.password);
    expect(audit).not.toContain("admin@falcon");
  });

  it("links to an existing organisation without modifying it", async () => {
    const { db, tx } = makeDb();
    tx.organisation.findUnique.mockResolvedValue({ id: "org-9", name: "Falcon Carers" });
    const result = await bootstrapAdmin(db, input, hasher);

    expect(result.reusedOrganisation).toBe(true);
    expect(tx.organisation.create).not.toHaveBeenCalled();
    expect(tx.membership.create.mock.calls[0][0].data.organisationId).toBe("org-9");
  });

  it("refuses to touch an existing user", async () => {
    const { db, tx } = makeDb();
    tx.user.findUnique.mockResolvedValue({ id: "existing" });

    await expect(bootstrapAdmin(db, input, hasher)).rejects.toBeInstanceOf(BootstrapError);
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.membership.create).not.toHaveBeenCalled();
  });

  it("is one-time: refuses when the organisation already has an administrator", async () => {
    const { db, tx } = makeDb();
    tx.organisation.findUnique.mockResolvedValue({ id: "org-9", name: "Falcon Carers" });
    tx.membership.findFirst.mockResolvedValue({ id: "membership-existing" });

    await expect(bootstrapAdmin(db, input, hasher)).rejects.toThrow(/already has an administrator/);
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(hasher).not.toHaveBeenCalled();
  });

  it("rejects weak or malformed input before touching the database", async () => {
    expect(() => validateInput({ ...input, password: "short" })).toThrow(BootstrapError);
    expect(() => validateInput({ ...input, email: "not-an-email" })).toThrow(BootstrapError);
    expect(() => validateInput({ ...input, organisationSlug: "Bad Slug!" })).toThrow(BootstrapError);
    const { db } = makeDb();
    await expect(bootstrapAdmin(db, { ...input, password: "short" }, hasher)).rejects.toBeInstanceOf(
      BootstrapError,
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
