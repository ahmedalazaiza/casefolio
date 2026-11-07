import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name (at least 2 characters).").max(80),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the Terms and Privacy Policy." }),
  }),
});

export const signInPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  rememberMe: z.boolean().default(true),
});

export const magicLinkSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const verifyEmailOtpSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit verification code."),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Missing reset token."),
    newPassword: z.string().min(8, "Password must be at least 8 characters.").max(128),
    confirmPassword: z.string().min(8, "Confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Workspace name must be at least 2 characters.").max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug may only contain lowercase letters, numbers, and hyphens.",
    )
    .min(2, "Slug must be at least 2 characters.")
    .max(48),
});

export const inviteTeamMemberSchema = z.object({
  organizationId: z.string().uuid("Select a valid team workspace."),
  email: z.string().trim().email("Enter a valid teammate email address."),
  role: z
    .enum(["admin", "member", "editor", "viewer"])
    .transform((val): "admin" | "member" =>
      val === "admin" || val === "editor" ? "admin" : "member",
    ),
});

export const DESIGNER_ROLE_IDS = [
  "ui-ux",
  "web",
  "exhibition",
  "brand",
  "student",
  "other",
] as const;

export type DesignerRoleId = (typeof DESIGNER_ROLE_IDS)[number];

export const completeOnboardingSchema = z.object({
  name: z.string().trim().min(2, "Display name must be at least 2 characters.").max(80),
  jobTitle: z.string().trim().min(2, "Enter a short headline or role.").max(100),
  designFocus: z.enum(["mobile", "web", "both"]),
  image: z
    .string()
    .trim()
    .max(500_000, "Avatar image is too large.")
    .refine(
      (val) =>
        val === "" ||
        val.startsWith("https://") ||
        val.startsWith("http://") ||
        val.startsWith("data:image/"),
      "Avatar must be a valid image URL or uploaded photo.",
    )
    .optional()
    .nullable(),
});
