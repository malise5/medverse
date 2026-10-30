"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { z } from "zod";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api/client";
import type { User } from "@/lib/api/types";

import { loginSchema, registerSchema, safeNext } from "./schemas";

type Mode = "login" | "register";

const LEVELS = [
  ["basic", "Basic anatomy"],
  ["undergraduate", "Undergraduate (MBChB / MBBS)"],
  ["clinical", "Clinical"],
  ["postgraduate", "Postgraduate"],
  ["specialist", "Specialist"],
] as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const schema: z.ZodType = mode === "login" ? loginSchema : registerSchema;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await api<{ user: User }>(`/auth/${mode}`, { method: "POST", json: parsed.data });
      const next = new URLSearchParams(window.location.search).get("next");
      // Full navigation so every cache starts clean for the new session.
      window.location.assign(safeNext(next));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Unable to reach the server");
      setPending(false);
    }
  }

  const field = (name: string, label: string, props: React.ComponentProps<typeof Input>) => (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        {...props}
      />
      {errors[name] && (
        <p id={`${name}-error`} className="text-xs text-destructive">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo className="text-lg" />
        <h1 className="text-xl font-semibold">
          {mode === "login" ? "Sign in to your workspace" : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Interactive anatomy, physiology and pathology for medical education.
        </p>
      </div>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {mode === "register" &&
          field("full_name", "Full name", { autoComplete: "name", required: true })}
        {field("email", "Email", { type: "email", autoComplete: "email", required: true })}
        {field("password", "Password", {
          type: "password",
          autoComplete: mode === "login" ? "current-password" : "new-password",
          required: true,
        })}
        {mode === "register" && (
          <div className="grid gap-1.5">
            <Label htmlFor="educational_level">Educational level</Label>
            <select
              id="educational_level"
              name="educational_level"
              defaultValue="undergraduate"
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
            >
              {LEVELS.map(([v, l]) => (
                <option key={v} value={v} className="bg-popover">
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}
        {formError && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New to MEDVERSE?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
