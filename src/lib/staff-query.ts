import { EmploymentStatus, Prisma, Role } from "@prisma/client";

export const STAFF_PAGE_SIZE = 20;

export function createStaffListQuery(input: {
  organisationId: string;
  role: Role;
  userId: string;
  query: string;
  status?: EmploymentStatus;
  page: number;
}) {
  const where: Prisma.StaffProfileWhereInput = {
    organisationId: input.organisationId,
    ...(input.role === "CARE_WORKER" ? { membershipUserId: input.userId } : {}),
    ...(input.status ? { employmentStatus: input.status } : {}),
    ...(input.query
      ? {
          OR: [
            { firstName: { contains: input.query, mode: "insensitive" } },
            { lastName: { contains: input.query, mode: "insensitive" } },
            { employeeNumber: { contains: input.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return {
    where,
    skip: (input.page - 1) * STAFF_PAGE_SIZE,
    take: STAFF_PAGE_SIZE,
  };
}
