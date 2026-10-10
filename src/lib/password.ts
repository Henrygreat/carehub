import { hash, compare } from "bcryptjs";

const WORK_FACTOR = 12;

export function hashPassword(password: string) {
  return hash(password, WORK_FACTOR);
}

export function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}
