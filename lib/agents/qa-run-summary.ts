import type { QaAutomationRunRow } from "@/lib/agents/qa-automation-log"
import { buildHomServiceConversationUrl } from "@/lib/landbot/cursor-automation-qa"

function hasHebrew(text: string) {
  return /[\u0590-\u05FF]/.test(text)
}

const OPERATOR_NOTES_HE: Record<string, string> = {
  "Implement webhook accepted — Composer run started.":
    "נשלח ליישום — Composer מריץ את התיקון עכשיו.",
  "Reverted via qa:vanish": "בוטל ב-revert (qa:vanish)",
}

function localizeOperatorNotes(notes: string) {
  const trimmed = notes.trim()
  return OPERATOR_NOTES_HE[trimmed] ?? trimmed
}

function isSystemOperatorNote(notes: string) {
  const trimmed = notes.trim()
  if (!trimmed || trimmed.startsWith("HTTP")) return true
  if (/^Implement webhook (accepted|failed)/i.test(trimmed)) return true
  return trimmed in OPERATOR_NOTES_HE
}

function localizeWebhookFailureNotes(notes: string) {
  const lower = notes.toLowerCase()
  if (
    lower.includes("401") ||
    lower.includes("authorization") ||
    lower.includes("implement_token")
  ) {
    if (
      lower.includes("no authorization") ||
      lower.includes("missing authorization") ||
      lower.includes("inbound webhook had no authorization")
    ) {
      return (
        "התיקון אושר, אבל השליחה ליישום נכשלה — לא נשלח Authorization. " +
        "לחץ ↻ לניסיון חוזר (Vercel כבר מוגדר)."
      )
    }
    return "התיקון אושר, אבל השליחה ל-Composer נכשלה (401). לחץ ↻ לניסיון חוזר."
  }
  const httpMatch = notes.match(/Implement webhook failed: HTTP (\d+)/i)
  if (httpMatch) {
    return `שליחה ל-Composer נכשלה (HTTP ${httpMatch[1]}). לחץ ↻ לניסיון חוזר.`
  }
  return localizeOperatorNotes(notes)
}

/** Known English Grok summaries → easy Hebrew for the dashboard. */
function hebrewFallbackProblem(cause: string) {
  const lower = cause.toLowerCase()
  if (
    (lower.includes("order card") || lower.includes("confirmed the order")) &&
    (lower.includes("sizes") || lower.includes("other size"))
  ) {
    return (
      "הלקוח אישר את כרטיס ההזמנה ושאל גם על מידות נוספות. " +
      "הבוט שלח 'לא הצלחתי להבין' במקום סטטוס משלוח. " +
      "קודם 'לא' על אותו כרטיס נתפס כדחייה, ולכן האישור המאוחר לא נקשר."
    )
  }
  if (lower.includes("return") && lower.includes("sales advisor")) {
    return (
      "הלקוח בחר החזרה ואמר כן לנציג כי קוד ההחזרה לא הגיע. " +
      "הבוט אישר העברה — אבל במקום שירות הועבר למכירות, כי נסרקה אזכור ישנה של יועץ מכירות מהשיחה."
    )
  }
  if (lower.includes("exchange") && lower.includes("service") && lower.includes("sales")) {
    return (
      "אחרי בחירת החלפה ואישור הזמנה, הבוט המשיך לזרימת שירות במקום לשאול סוג החלפה ולהעביר למכירות."
    )
  }
  if (
    lower.includes("never-stuck") ||
    lower.includes("never stuck") ||
    lower.includes("didn't-understand") ||
    lower.includes("didn't understand") ||
    lower.includes("didnt understand")
  ) {
    return "הבוט שלח 'לא הצלחתי להבין' במקום להמשיך את הזרימה לפי מה שכבר ידוע בשיחה."
  }
  return cause
}

export function qaRunConversationUrl(run: QaAutomationRunRow) {
  const url = run.conversation_url?.trim()
  if (url && url.includes("service.hom-group.co.il")) return url
  return buildHomServiceConversationUrl(run.session_id)
}

export function qaRunProblem(run: QaAutomationRunRow) {
  if (run.root_cause?.trim()) {
    const cause = run.root_cause.trim()
    return hasHebrew(cause) ? cause : hebrewFallbackProblem(cause)
  }
  if (run.trigger === "human_assign") {
    return "הלקוח/ה הועבר/ה לנציג — נדרש אימות אם זו העברה תקינה או כשל."
  }
  if (run.trigger === "bot_failure") {
    return "הבוט שלח never-stuck במקום להמשיך את הזרימה."
  }
  return "—"
}

export function qaRunSolution(run: QaAutomationRunRow) {
  if (
    run.fix_plan[0]?.trim() &&
    run.outcome !== "false_alarm" &&
    run.outcome !== "ignored"
  ) {
    const plan = run.fix_plan[0].trim()
    return hasHebrew(plan) ? plan : `תיקון מתוכנן: ${plan}`
  }

  if (run.outcome === "webhook_failed" && run.operator_notes?.trim()) {
    return localizeWebhookFailureNotes(run.operator_notes.trim())
  }

  if (run.operator_notes?.trim()) {
    const notes = run.operator_notes.trim()
    if (!isSystemOperatorNote(notes)) {
      return localizeOperatorNotes(notes)
    }
  }

  if (run.outcome === "implemented" && run.commit_sha) {
    return `תוקן בקומיט ${run.commit_sha.slice(0, 7)}`
  }
  if (run.outcome === "false_alarm" || run.outcome === "ignored") {
    return "אין תיקון — אזעקת שווא / התנהגות תקינה."
  }
  if (run.outcome === "too_risky") {
    return "ממתין לאישור מפעיל לפני שינוי."
  }
  if (run.outcome === "webhook_failed") {
    return "שליחה ליישום נכשלה — לחץ ↻ לניסיון חוזר."
  }
  if (run.outcome === "triggered") {
    return "בתהליך review — טרם הוחלט."
  }
  if (run.outcome === "chained") {
    return "נשלח ליישום — Composer מריץ את התיקון עכשיו."
  }
  if (run.phase === "implement" && run.outcome !== "implemented") {
    return "יישום רץ — טרם נרשם קומיט."
  }
  return "—"
}

export function qaRunRiskLabel(run: QaAutomationRunRow) {
  if (run.risk_score == null) return "—"
  if (run.risk_score >= 8) return `${run.risk_score}/10 — מסוכן מדי`
  if (run.risk_score >= 5) return `${run.risk_score}/10 — בינוני`
  return `${run.risk_score}/10 — נמוך`
}

export function qaRunRiskScore(run: QaAutomationRunRow) {
  return run.risk_score
}
