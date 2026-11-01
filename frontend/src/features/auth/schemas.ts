import { z } from "zod";

// Messages are interface message keys, translated where the form shows them.

export const loginSchema = z.object({
  email: z.email("auth.validation.email"),
  password: z.string().min(1, "auth.validation.password"),
});

const classes = (v: string) =>
  [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(v)).length;

export const registerSchema = z.object({
  full_name: z.string().trim().min(2, "auth.validation.name").max(200),
  email: z.email("auth.validation.email"),
  password: z
    .string()
    .min(12, "auth.validation.passwordLength")
    .refine((v) => classes(v) >= 3, "auth.validation.passwordClasses"),
  educational_level: z.enum(["basic", "undergraduate", "clinical", "postgraduate", "specialist"]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

/** Only allow same-origin relative redirects after login. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}
