"use client";

import { CheckCircle2, Crosshair, Eye, Loader2, Undo2, X, XCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAnswerQuestion } from "@/lib/api/queries";

import { useWorkspace } from "../store";

/**
 * "Find it in 3D" question from a learning module. The learner selects a structure in
 * the viewer and checks it; the server grades the answer (a part of the target counts).
 * Structure names stay hidden in hover labels and the side panel until then.
 */
export function IdentifyQuizBanner({ onShow }: { onShow: (structureId: string) => void }) {
  const quiz = useWorkspace((s) => s.quiz);
  const selectedId = useWorkspace((s) => s.selectedId);
  const answer = useAnswerQuestion();
  if (!quiz) return null;

  const result = answer.data;
  const check = () => {
    if (!selectedId) return;
    answer.mutate(
      { questionId: quiz.questionId, response: selectedId },
      { onSuccess: () => useWorkspace.getState().setQuiz({ ...quiz, answered: true }) },
    );
  };
  const retry = () => {
    answer.reset();
    useWorkspace.getState().select(null);
    useWorkspace.getState().setQuiz({ ...quiz, answered: false });
  };
  const back = `/learn/${encodeURIComponent(quiz.moduleId)}#quiz`;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
      <section
        aria-label="3D identification question"
        aria-live="polite"
        className="pointer-events-auto grid w-full max-w-xl gap-2 rounded-xl border bg-background/90 p-3 shadow-lg backdrop-blur"
      >
        <header className="flex items-start gap-2">
          <Crosshair className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Find it in 3D</p>
            <p className="text-sm font-medium">{quiz.stem}</p>
          </div>
          <Button size="icon-sm" variant="ghost" aria-label="Leave the question" asChild>
            <Link href={back} onClick={() => useWorkspace.getState().setQuiz(null)}>
              <X />
            </Link>
          </Button>
        </header>

        {!result ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-xs text-muted-foreground">
              {selectedId
                ? "A structure is selected. Its name stays hidden until you check."
                : "Rotate and zoom the model, then click the structure. Use Layers or dissection to reach deep structures."}
            </p>
            <Button size="sm" onClick={check} disabled={!selectedId || answer.isPending}>
              {answer.isPending && <Loader2 className="animate-spin" />} Check answer
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <p className={result.correct ? "flex items-center gap-1.5 text-sm font-medium text-emerald-400" : "flex items-center gap-1.5 text-sm font-medium text-destructive"}>
              {result.correct ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              <span>
                {result.correct ? "Correct." : "Not quite."}
                {!result.correct && result.accepted.length > 0 && (
                  <span className="font-normal text-muted-foreground">
                    {" "}The answer is the {result.accepted.map((a) => a.name).join(" or the ")}.
                  </span>
                )}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{result.explanation}</p>
            <div className="flex flex-wrap gap-2">
              {!result.correct && result.accepted[0] && (
                <Button size="sm" variant="secondary" onClick={() => onShow(result.accepted[0].id)}>
                  <Eye /> Show me
                </Button>
              )}
              {!result.correct && (
                <Button size="sm" variant="ghost" onClick={retry}>
                  <Undo2 /> Try again
                </Button>
              )}
              <Button size="sm" variant={result.correct ? "default" : "ghost"} asChild>
                <Link href={back} onClick={() => useWorkspace.getState().setQuiz(null)}>
                  Back to the quiz
                </Link>
              </Button>
            </div>
          </div>
        )}
        {answer.error && (
          <p role="alert" className="text-xs text-destructive">
            {answer.error.message}
          </p>
        )}
      </section>
    </div>
  );
}

/** Shown in the side panel while a question is unanswered, so it does not reveal names. */
export function QuizPanelPlaceholder() {
  return (
    <div className="grid gap-2 p-4 text-sm text-muted-foreground">
      <Crosshair className="size-5 text-primary" aria-hidden />
      <p>Question in progress. Structure details appear after you check your answer.</p>
    </div>
  );
}
