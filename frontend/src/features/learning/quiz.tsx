"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, Crosshair, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAnswerQuestion } from "@/lib/api/queries";
import type { AnswerResult, LearningLevel, ModuleDetail, QuizQuestion } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { ProgressBar } from "./learning-hub";
import { levelLabel, questionsForLevel } from "./levels";

interface Attempt {
  choice: number;
  result: AnswerResult;
}

function StatusDot({ q, current, attempt }: { q: QuizQuestion; current: boolean; attempt?: Attempt }) {
  const correct = attempt ? attempt.result.correct : q.last_correct;
  return (
    <span
      aria-hidden
      className={cn(
        "block size-2.5 rounded-full border",
        correct === true && "border-emerald-500 bg-emerald-500",
        correct === false && "border-destructive bg-destructive",
        correct === null || correct === undefined ? "border-muted-foreground/50" : "",
        current && "ring-2 ring-primary ring-offset-1 ring-offset-background",
      )}
    />
  );
}

function McqQuestion({ q, attempt, onAnswer, pending }: { q: QuizQuestion; attempt?: Attempt; onAnswer: (i: number) => void; pending: boolean }) {
  return (
    <div role="radiogroup" aria-label="Answer options" className="grid gap-2">
      {q.options!.map((opt, i) => {
        const chosen = attempt?.choice === i;
        const isRight = attempt?.result.correct_option === i;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={chosen}
            disabled={!!attempt || pending}
            onClick={() => onAnswer(i)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors enabled:hover:border-primary/60 enabled:hover:bg-primary/5",
              attempt && isRight && "border-emerald-500/70 bg-emerald-500/10",
              attempt && chosen && !isRight && "border-destructive/70 bg-destructive/10",
            )}
          >
            <span className="grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold text-muted-foreground">
              {String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1">{opt}</span>
            {attempt && isRight && <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-label="Correct answer" />}
            {attempt && chosen && !isRight && <XCircle className="size-4 shrink-0 text-destructive" aria-label="Your answer" />}
          </button>
        );
      })}
    </div>
  );
}

export function Quiz({ module, level }: { module: ModuleDetail; level: LearningLevel }) {
  const [allLevels, setAllLevels] = useState(false);
  const questions = useMemo(
    () => (allLevels ? module.questions : questionsForLevel(module.questions, level)),
    [module.questions, level, allLevels],
  );
  const [idx, setIdx] = useState(0);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const answer = useAnswerQuestion();
  const i = Math.min(idx, Math.max(0, questions.length - 1));
  const q = questions[i];
  const attempt = q ? attempts[q.id] : undefined;
  const p = module.progress;

  const submit = (choice: number) => {
    if (!q) return;
    answer.mutate(
      { questionId: q.id, response: String(choice) },
      { onSuccess: (result) => setAttempts((a) => ({ ...a, [q.id]: { choice, result } })) },
    );
  };

  return (
    <section id="quiz" aria-labelledby="quiz-h" className="grid scroll-mt-20 gap-4 rounded-xl border bg-card p-4 md:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 id="quiz-h" className="text-lg font-semibold">
            Check your understanding
          </h2>
          <p className="text-xs text-muted-foreground">
            {allLevels ? "All levels" : `Up to ${levelLabel(level)} level`} · {questions.length} questions · answers are
            checked and saved to your progress
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={allLevels} onChange={(e) => setAllLevels(e.target.checked)} className="accent-primary" />
          Include harder questions
        </label>
      </header>
      <ProgressBar answered={p.answered} correct={p.correct} total={p.questions} />

      {!q ? (
        <p className="text-sm text-muted-foreground">No questions at this level yet.</p>
      ) : (
        <>
          <nav aria-label="Questions" className="flex flex-wrap items-center gap-1.5">
            {questions.map((x, n) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setIdx(n)}
                aria-label={`Question ${n + 1}`}
                aria-current={n === i ? "step" : undefined}
                className="grid size-6 place-items-center rounded-full hover:bg-muted"
              >
                <StatusDot q={x} current={n === i} attempt={attempts[x.id]} />
              </button>
            ))}
          </nav>

          <article className="grid gap-3" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Question {i + 1} of {questions.length}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {levelLabel(q.level)}
              </Badge>
              {q.kind === "identify" && (
                <Badge variant="outline" className="text-[10px]">
                  3D identification
                </Badge>
              )}
              {q.last_correct !== null && !attempt && (
                <span className="text-[11px] text-muted-foreground">
                  Last time: {q.last_correct ? "correct" : "incorrect"}
                </span>
              )}
            </div>
            <p className="text-base font-medium">{q.stem}</p>

            {q.kind === "mcq" ? (
              <McqQuestion q={q} attempt={attempt} onAnswer={submit} pending={answer.isPending} />
            ) : (
              <div className="grid gap-2 rounded-lg border border-dashed p-3">
                <p className="text-sm text-muted-foreground">
                  Answer this one in the 3D explorer: find the structure, select it and check your answer. You will come
                  back here afterwards.
                </p>
                <Button size="sm" className="justify-self-start" asChild>
                  <Link href={`/anatomy?quiz=${encodeURIComponent(q.id)}&module=${encodeURIComponent(module.id)}`}>
                    <Crosshair /> Find it in 3D
                  </Link>
                </Button>
              </div>
            )}

            {answer.isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Checking" />}
            {answer.error && !attempt && (
              <p role="alert" className="text-xs text-destructive">
                {answer.error.message}
              </p>
            )}
            {attempt && (
              <div className={cn("grid gap-1.5 rounded-lg p-3 text-sm", attempt.result.correct ? "bg-emerald-500/10" : "bg-destructive/10")}>
                <p className="font-medium">{attempt.result.correct ? "Correct." : "Not quite."}</p>
                <p className="text-foreground/90">{attempt.result.explanation}</p>
                <p className="text-[11px] text-muted-foreground">
                  Source: {attempt.result.references.map((r) => r.citation).join(" ")}
                </p>
              </div>
            )}
          </article>

          <footer className="flex items-center justify-between gap-2">
            <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => setIdx(i - 1)}>
              <ChevronLeft /> Previous
            </Button>
            {attempt && !attempt.result.correct && q.kind === "mcq" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setAttempts((a) => {
                    const rest = { ...a };
                    delete rest[q.id];
                    return rest;
                  })
                }
              >
                Try again
              </Button>
            )}
            <Button size="sm" variant={attempt ? "default" : "secondary"} disabled={i >= questions.length - 1} onClick={() => setIdx(i + 1)}>
              Next <ChevronRight />
            </Button>
          </footer>
        </>
      )}
    </section>
  );
}
