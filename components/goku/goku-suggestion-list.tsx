"use client"

import { useTransition } from "react"
import { approveGokuSuggestionAction } from "@/app/dashboard/goku/actions"
import { Button } from "@/components/ui/button"
import type { GokuSuggestion } from "@/lib/agents/goku-trainer"
import { cn } from "@/lib/utils"

function typeLabel(type: GokuSuggestion["type"]) {
  switch (type) {
    case "learned_rule":
      return "כלל"
    case "kb_edit":
      return "ידע"
    case "prompt_edit":
      return "פרומPT"
    default:
      return type
  }
}

function StatusPill({ status }: { status: GokuSuggestion["status"] }) {
  const config =
    status === "applied"
      ? { label: "פעיל", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" }
      : status === "rejected"
        ? { label: "נדחה", className: "bg-red-50 text-red-700 ring-red-600/15" }
        : { label: "ממתין", className: "bg-amber-50 text-amber-800 ring-amber-600/15" }

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
        config.className
      )}
    >
      {config.label}
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
    <div className="flex items-start justify-between gap-3 rounded-xl bg-zinc-50/80 px-3.5 py-3 ring-1 ring-black/[0.04]">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium leading-snug">{suggestion.title}</p>
          <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 ring-black/[0.06]">
            {typeLabel(suggestion.type)}
          </span>
        </div>
        {suggestion.status === "proposed" ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {suggestion.description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusPill status={suggestion.status} />
        {canApprove ? (
          <Button
            size="sm"
            disabled={pending}
            className="h-7 px-3 text-xs"
            onClick={() => {
              startTransition(async () => {
                await approveGokuSuggestionAction({
                  reportId,
                  suggestionId: suggestion.id,
                })
              })
            }}
          >
            {pending ? "…" : "אשר"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function GokuSuggestionList({
  reportId,
  suggestions,
}: {
  reportId: string
  suggestions: GokuSuggestion[]
}) {
  if (!suggestions.length) return null

  const pending = suggestions.filter((item) => item.status === "proposed")
  const applied = suggestions.filter((item) => item.status === "applied")

  return (
    <div className="space-y-2">
      {pending.map((suggestion) => (
        <SuggestionRow
          key={suggestion.id}
          reportId={reportId}
          suggestion={suggestion}
        />
      ))}
      {applied.length > 0 ? (
        <p className="pt-1 text-xs text-muted-foreground">
          {applied.length} כללים הופעלו אוטומטית
        </p>
      ) : null}
    </div>
  )
}
