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
