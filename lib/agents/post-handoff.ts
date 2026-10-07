import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import { isVoiceClosureTemplateMessage } from "@/lib/landbot/voice-closure-template"

const HANDOFF_CONFIRMED_RE =
  /העבר(?:תי|נו)\s+א(?:ת|ת)\s+ה(?:שיחה|פנייה)|הפנייה\s+הועברה|ניצור\s+קשר\s+בהקדם/i

/** Bot committed to transfer — "אני מעביר אותך לנציג" (534249637), not only "מעביר את". */
const DECLARATIVE_HANDOFF_TRANSFER_RE =
  /(?:אני|אנחנו|בינתיים אני)\s+מעביר(?:ים|ה|א)?(?:\s+א(?:ות(?:ך|כם|ה)|ת(?:כם|)?))?/iu

export function hasDeclarativeHandoffTransferInText(text: string) {
  return DECLARATIVE_HANDOFF_TRANSFER_RE.test(text.trim())
}

const SALES_HANDOFF_COMMITTED_RE =
  /מעביר(?:ים|ה|א)?[^\n]{0,48}יועץ\s+מכירות/i

const PROACTIVE_RECEIPT_OR_TRACKING_RE =
  /תודה על רכישתך בשטיח האדום|documents\.carpetshop\.co\.il|tracking\.carpetshop\.co\.il/i

export function isHomBotAssistantMessage(content: string) {
  const trimmed = content.trim()
  if (!trimmed) return false
  return trimmed.startsWith(CUSTOMER_HEADER) || /^\*?\s*הום\s+בוט\s/mi.test(trimmed)
}

function isBotHandoffAssistantMessage(content: string) {
  if (!isHomBotAssistantMessage(content)) return false
  const body = content.replace(/\*הום בוט\s:\)\*/gi, "").trim()
  return (
    HANDOFF_CONFIRMED_RE.test(body) ||
    hasDeclarativeHandoffTransferInText(body) ||
    SALES_HANDOFF_COMMITTED_RE.test(body) ||
    /נציג\s+שירות|יועץ\s+מכירות/i.test(body)
  )
}

/** Live rep wrote in chat — not HoM bot or automated receipt/tracking templates. */
export function isLiveRepAssistantMessage(content: string) {
  const trimmed = content.trim()
  if (!trimmed) return false
  if (isInactivityAssistantMessage(content)) return false
  if (isVoiceClosureTemplateMessage({ body: content })) return false
  if (PROACTIVE_RECEIPT_OR_TRACKING_RE.test(trimmed)) return false
  return !isHomBotAssistantMessage(content)
}

/** Bot handoff executed, then a human rep answered — thanks must warm-close (534366103). */
export function hasLiveRepReplyAfterBotHandoff(history: HistoryMessage[]) {
  let lastHandoffIdx = -1
  for (let index = 0; index < history.length; index += 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isBotHandoffAssistantMessage(message.content)) {
      lastHandoffIdx = index
    }
  }
  if (lastHandoffIdx === -1) return false
  for (let index = lastHandoffIdx + 1; index < history.length; index += 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isLiveRepAssistantMessage(message.content)) return true
  }
  return false
}

function lastMeaningfulAssistantText(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (isVoiceClosureTemplateMessage({ body: message.content })) continue
    return message.content
  }
  return ""
}

export function isPostHumanHandoff(lastAction: string | null, history: HistoryMessage[]) {
  if (lastAction === "human_sales" || lastAction === "human_service") return true
  const last = lastMeaningfulAssistantText(history)
  if (HANDOFF_CONFIRMED_RE.test(last)) return true
  return hasDeclarativeHandoffTransferInText(last)
}

export function postHandoffKind(
  lastAction: string | null,
  history: HistoryMessage[]
): "human_sales" | "human_service" | null {
  if (lastAction === "human_sales") return "human_sales"
  if (lastAction === "human_service") return "human_service"
  const last = lastMeaningfulAssistantText(history)
  if (/יועץ\s+מכירות|מחלקת\s+מכירות/i.test(last)) return "human_sales"
  if (/נציג\s+שירות|שירות\s+לקוחות/i.test(last)) return "human_service"
  return null
}

/** Gentle reminder on the last FAQ answer after handoff — not on every bubble. */
export function buildPostHandoffFooter(kind: "human_sales" | "human_service") {
  return kind === "human_sales"
    ? "היועץ כבר קיבל את הפנייה ויצור קשר — בינתיים שמח לעזור."
    : "הנציג כבר קיבל את הפנייה ויצור קשר — בינתיים שמח לעזור."
}
