import { db } from "@/lib/db";

/**
 * Generates a URL-safe slug from a string.
 * Converts to lowercase, replaces spaces with hyphens,
 * removes special characters, and ensures uniqueness in the database.
 */
export async function generateSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

  // Check if slug exists and add suffix if needed
  let slug = baseSlug;
  let suffix = 1;

  while (await slugExists(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  return slug;
}

/**
 * Checks if a slug already exists in the organisations table.
 */
async function slugExists(slug: string): Promise<boolean> {
  const existing = await db.organisation.findUnique({
    where: { slug },
    select: { id: true },
  });
  return existing !== null;
}
