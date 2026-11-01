"use client";

import { CheckCircle2, Crosshair, Eye, Loader2, Undo2, X, XCircle } from "lucide-react";
import { Link, useT } from "@/lib/i18n/client";

import { Button } from "@/components/ui/button";
import { useAnswerQuestion } from "@/lib/api/queries";

import { useEmbedHost } from "../embed-context";
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
  // Inside a module's lab pane, "back" closes the pane instead of navigating.
  const embed = useEmbedHost();
  const { t } = useT();
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
  const leave = () => {
    useWorkspace.getState().setQuiz(null);
    embed?.onExit("quiz");
  };
  const backLink = (children: React.ReactNode, label?: string) =>
    embed ? (
      <button type="button" onClick={leave} aria-label={label}>
        {children}
      </button>
    ) : (
      <Link href={back} onClick={() => useWorkspace.getState().setQuiz(null)} aria-label={label}>
        {children}
      </Link>
    );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
      <section
        aria-label={t("explorer.quiz.aria")}
        aria-live="polite"
        className="pointer-events-auto grid w-full max-w-xl gap-2 rounded-xl border bg-background/90 p-3 shadow-lg backdrop-blur"
      >
        <header className="flex items-start gap-2">
          <Crosshair className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("explorer.quiz.find")}</p>
            <p className="text-sm font-medium">{quiz.stem}</p>
          </div>
          <Button size="icon-sm" variant="ghost" asChild>
            {backLink(<X />, t("explorer.quiz.leave"))}
          </Button>
        </header>

        {!result ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-xs text-muted-foreground">
              {selectedId
                ? t("explorer.quiz.selected")
                : t("explorer.quiz.instructions")}
            </p>
            <Button size="sm" onClick={check} disabled={!selectedId || answer.isPending}>
              {answer.isPending && <Loader2 className="animate-spin" />} {t("explorer.quiz.check")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <p className={result.correct ? "flex items-center gap-1.5 text-sm font-medium text-success" : "flex items-center gap-1.5 text-sm font-medium text-destructive"}>
              {result.correct ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              <span>
                {result.correct ? t("explorer.quiz.correct") : t("explorer.quiz.notQuite")}
                {!result.correct && result.accepted.length > 0 && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    {t("explorer.quiz.answerIs", { names: result.accepted.map((a) => a.name).join(t("explorer.quiz.or")) })}
                  </span>
                )}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{result.explanation}</p>
            <div className="flex flex-wrap gap-2">
              {!result.correct && result.accepted[0] && (
                <Button size="sm" variant="secondary" onClick={() => onShow(result.accepted[0].id)}>
                  <Eye /> {t("explorer.quiz.showMe")}
                </Button>
              )}
              {!result.correct && (
                <Button size="sm" variant="ghost" onClick={retry}>
                  <Undo2 /> {t("explorer.quiz.tryAgain")}
                </Button>
              )}
              <Button size="sm" variant={result.correct ? "default" : "ghost"} asChild>
                {backLink(t("explorer.quiz.back"))}
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
  const { t } = useT();
  return (
    <div className="grid gap-2 p-4 text-sm text-muted-foreground">
      <Crosshair className="size-5 text-primary" aria-hidden />
      <p>{t("explorer.quiz.inProgress")}</p>
    </div>
  );
}
