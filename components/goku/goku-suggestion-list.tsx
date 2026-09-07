"use client"

import { useTransition } from "react"
import { approveGokuSuggestionAction } from "@/app/dashboard/goku/actions"
import { Button } from "@/components/ui/button"
import type { GokuSuggestion } from "@/lib/agents/goku-trainer"
import { cn } from "@/lib/utils"

function suggestionTypeLabel(type: GokuSuggestion["type"]) {
  switch (type) {
    case "learned_rule":
      return "Runtime rule"
    case "kb_edit":
      return "KB edit"
    case "prompt_edit":
      return "Prompt edit"
    default:
      return type
  }
}

function StatusBadge({ status }: { status: GokuSuggestion["status"] }) {
  const styles =
    status === "applied"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "rejected"
        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
        : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"

  const label =
    status === "applied"
      ? "Applied"
      : status === "rejected"
        ? "Rejected"
        : "Needs approval"

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles
      )}
    >
      {label}
    </span>
  )
}

function SuggestionRow({
  reportId,
  suggestion,
}: {
  reportId: string
  suggestion: GokuSuggestion
}) {
  const [pending, startTransition] = useTransition()

  const canApprove =
    suggestion.status === "proposed" && suggestion.type === "learned_rule"

  return (
    <li className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-sm">{suggestion.title}</p>
            <span className="rounded-md bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
              {suggestionTypeLabel(suggestion.type)}
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {Math.round(suggestion.confidence * 100)}% confidence
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {suggestion.description}
          </p>
          {suggestion.rule_text ? (
            <p className="rounded-md bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground/80">
              {suggestion.rule_text}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge status={suggestion.status} />
          {canApprove ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await approveGokuSuggestionAction({
                    reportId,
                    suggestionId: suggestion.id,
                  })
                })
              }}
            >
              {pending ? "Applying…" : "Approve"}
            </Button>
          ) : suggestion.status === "proposed" &&
            suggestion.type !== "learned_rule" ? (
            <span className="text-xs text-muted-foreground">Manual edit</span>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function GokuSuggestionList({
  reportId,
  suggestions,
}: {
  reportId: string
  suggestions: GokuSuggestion[]
}) {
  if (!suggestions.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No retraining suggestions for this conversation.
      </p>
    )
  }

  const pendingCount = suggestions.filter((item) => item.status === "proposed").length
  const appliedCount = suggestions.filter((item) => item.status === "applied").length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{appliedCount} auto-applied</span>
        <span>{pendingCount} awaiting review</span>
      </div>
      <ul className="space-y-3">
        {suggestions.map((suggestion) => (
          <SuggestionRow
            key={suggestion.id}
            reportId={reportId}
            suggestion={suggestion}
          />
        ))}
      </ul>
    </div>
  )
}
