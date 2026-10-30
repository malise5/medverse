import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const classes = (v: string) =>
  [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(v)).length;

export const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(200),
  email: z.email("Enter a valid email address"),
  password: z
    .string()
    .min(12, "Use at least 12 characters")
    .refine((v) => classes(v) >= 3, "Use at least three of: lowercase, uppercase, digit, symbol"),
  educational_level: z.enum(["basic", "undergraduate", "clinical", "postgraduate", "specialist"]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

/** Only allow same-origin relative redirects after login. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}
