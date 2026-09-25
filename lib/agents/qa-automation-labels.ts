import type { QaAutomationOutcome, QaAutomationPhase } from "@/lib/agents/qa-automation-log"

export function qaOutcomeLabel(outcome: QaAutomationOutcome) {
  const labels: Record<QaAutomationOutcome, string> = {
    triggered: "נשלח לניתוח",
    webhook_failed: "Webhook נכשל",
    false_alarm: "אזעקת שווא",
    real_failure: "כשל אמיתי",
    ask_operator: "ממתין למפעיל",
    too_risky: "מסוכן מדי",
    already_covered: "כבר טופל",
    chained: "נשלח ליישום",
    implemented: "יושם",
    ignored: "התעלמות",
    no_action: "ללא פעולה",
    failed_guard: "נחסם ע״י guard",
    vanished: "בוטל (revert)",
  }
  return labels[outcome] ?? outcome
}

export function qaOutcomeTone(outcome: QaAutomationOutcome) {
  switch (outcome) {
    case "implemented":
      return "emerald"
    case "false_alarm":
    case "already_covered":
    case "no_action":
      return "zinc"
    case "triggered":
    case "chained":
    case "real_failure":
      return "sky"
    case "webhook_failed":
      return "rose"
    case "ask_operator":
      return "amber"
    case "too_risky":
    case "failed_guard":
      return "orange"
    case "vanished":
    case "ignored":
      return "rose"
    default:
      return "zinc"
  }
}

export function qaPhaseLabel(phase: QaAutomationPhase) {
  return phase === "analyze" ? "ניתוח" : "יישום"
}

export function qaTriggerLabel(trigger: string) {
  switch (trigger) {
    case "human_assign":
      return "העברה לנציג"
    case "bot_failure":
      return "never-stuck"
    case "manual":
      return "בדיקה ידנית"
    case "violation":
      return "זיהוי אוטומטי"
    default:
      return trigger
  }
}

export function qaRiskTone(score: number | null) {
  if (score == null) return "zinc"
  if (score <= 3) return "emerald"
  if (score <= 6) return "amber"
  return "rose"
}
