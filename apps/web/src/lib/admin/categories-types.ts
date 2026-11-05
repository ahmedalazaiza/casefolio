import type { ProjectType } from "@casefolio/db";
import { z } from "zod";

const CATEGORY_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyCategory(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required.").max(60),
  slug: z
    .string()
    .trim()
    .regex(CATEGORY_SLUG_REGEX, "Slug must use lowercase letters, numbers, and hyphens.")
    .max(60)
    .optional(),
  sort: z.number().int().min(0).max(9999).optional(),
});

export const updateCategorySchema = z.object({
  id: z.string().uuid("Invalid category ID."),
  name: z.string().trim().min(1, "Category name is required.").max(60),
  slug: z
    .string()
    .trim()
    .regex(CATEGORY_SLUG_REGEX, "Slug must use lowercase letters, numbers, and hyphens.")
    .max(60),
  sort: z.number().int().min(0).max(9999),
});

export const reorderCategoriesSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1, "At least one category ID is required."),
});

export const deleteCategorySchema = z.object({
  id: z.string().uuid("Invalid category ID."),
});

export interface AdminCategoryItem {
  id: string;
  name: string;
  slug: string;
  sort: number;
  templateCount: number;
  publishedTemplateCount: number;
  createdAtIso: string;
}

export interface AdminTypeSummaryItem {
  type: ProjectType;
  label: string;
  description: string;
  templateCount: number;
  projectCount: number;
  order: number;
}

export interface AdminCategoriesOverview {
  types: AdminTypeSummaryItem[];
  categories: AdminCategoryItem[];
}
