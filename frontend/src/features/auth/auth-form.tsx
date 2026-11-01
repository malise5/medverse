"use client";

import { Link, useLocalePath, useT } from "@/lib/i18n/client";
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

const LEVELS = ["basic", "undergraduate", "clinical", "postgraduate", "specialist"] as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const lp = useLocalePath();
  const { t } = useT();

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
      window.location.assign(lp(safeNext(next)));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("auth.serverUnreachable"));
      setPending(false);
    }
  }

  const field = (name: string, label: string, props: React.ComponentProps<typeof Input>) => (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        className="h-11 rounded-xl bg-card px-3.5"
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
      <div className="mb-8 grid gap-2">
        <Logo className="mb-4 lg:hidden" />
        <h1 className="text-2xl font-bold tracking-tight">
          {mode === "login" ? t("auth.signInTitle") : t("auth.registerTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("auth.tagline")}</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {mode === "register" &&
          field("full_name", t("auth.fullName"), { autoComplete: "name", required: true })}
        {field("email", t("auth.email"), { type: "email", autoComplete: "email", required: true })}
        {field("password", t("auth.password"), {
          type: "password",
          autoComplete: mode === "login" ? "current-password" : "new-password",
          required: true,
        })}
        {mode === "register" && (
          <div className="grid gap-1.5">
            <Label htmlFor="educational_level">{t("auth.educationalLevel")}</Label>
            <select
              id="educational_level"
              name="educational_level"
              defaultValue="undergraduate"
              className="h-11 rounded-xl border border-input bg-card px-3 text-sm"
            >
              {LEVELS.map((v) => (
                <option key={v} value={v} className="bg-popover">
                  {t(`auth.levels.${v}`)}
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
        <Button type="submit" size="lg" disabled={pending} className="mt-2 h-11 rounded-xl text-[15px] font-semibold">
          {pending ? t("common.pleaseWait") : mode === "login" ? t("auth.signIn") : t("auth.createAccount")}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            {t("auth.newHere")}{" "}
            <Link href="/register" className="text-primary hover:underline">
              {t("auth.createAnAccount")}
            </Link>
          </>
        ) : (
          <>
            {t("auth.alreadyRegistered")}{" "}
            <Link href="/login" className="text-primary hover:underline">
              {t("auth.signIn")}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
