import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"
import { qaFixLayerLabel, qaVerdictLabel } from "@/lib/agents/qa-run-display"

export type QaScorecard = {
  llmDominancy: number | null
  mainFault: string
}

function llmDominancyFromFixLayer(layer: string | null): number | null {
  switch (layer) {
    case "prompt":
      return 9
    case "hints":
      return 8
    case "pre_turn":
      return 5
    case "tool_guard":
      return 4
    case "runtime":
      return 3
    default:
      return null
  }
}

export function buildQaScorecard(run: QaAutomationRunRow): QaScorecard {
  const fromLayer = llmDominancyFromFixLayer(run.fix_layer)
  const llmDominancy =
    fromLayer ??
    (run.risk_score != null
      ? Math.min(10, Math.max(1, Math.round(run.risk_score)))
      : null)

  const faultParts: string[] = []
  if (run.fix_layer) faultParts.push(qaFixLayerLabel(run.fix_layer))
  if (run.verdict) faultParts.push(qaVerdictLabel(run.verdict))

  const mainFault =
    faultParts.length > 0
      ? faultParts.join(" · ")
      : run.outcome === "triggered" || run.outcome === "chained"
        ? "ממתין לניתוח"
        : "טרם נקבע"

  return { llmDominancy, mainFault }
}
