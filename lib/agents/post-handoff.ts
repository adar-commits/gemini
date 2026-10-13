import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import { isOpenRefundCreditFollowUpThread } from "@/lib/agents/service-intake"
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

/** Live rep promised callback / manager assign — thread stays open (530313226). */
const LIVE_REP_PENDING_CALLBACK_RE =
  /שייכ(?:תי|ו)[^\n]{0,64}(?:מנהל|נציג)|נעדכן\s+(?:אות(?:ך|כם)|בהקדם)|(?:ניצור|יצר[uw]|נחזור)\s+(?:אית(?:ך|כם)\s+)?(?:קשר|אליך)/i

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
export function hasLiveRepPendingCallbackCommitment(history: HistoryMessage[]) {
  return history.some(
    (m) =>
      m.role === "assistant" &&
      isLiveRepAssistantMessage(m.content) &&
      LIVE_REP_PENDING_CALLBACK_RE.test(m.content)
  )
}

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

function assistantBodyWithoutHeader(content: string) {
  return content.replace(/\*הום בוט\s:\)\*/gi, "").trim()
}

function isBotHandoffCommitmentContent(content: string) {
  const body = assistantBodyWithoutHeader(content)
  if (!body) return false
  return (
    HANDOFF_CONFIRMED_RE.test(body) ||
    hasDeclarativeHandoffTransferInText(body) ||
    isBotHandoffAssistantMessage(content)
  )
}

/** Past-tense CRM assign — future «אני מעביר» alone is not executed (533540551). */
export function assistantTextIndicatesHandoffExecuted(text: string) {
  const body = assistantBodyWithoutHeader(text)
  if (!body) return false
  return (
    HANDOFF_CONFIRMED_RE.test(body) ||
    /מעולה,\s+העברתי/i.test(body) ||
    SALES_HANDOFF_COMMITTED_RE.test(body)
  )
}

/** Past-tense handoff prose in thread — not merely «נציג יבדוק» without transfer executed. */
export function hasExecutedBotHandoffInHistory(history: HistoryMessage[]) {
  return history.some(
    (message) =>
      message.role === "assistant" &&
      isHomBotAssistantMessage(message.content) &&
      assistantTextIndicatesHandoffExecuted(message.content)
  )
}

/** Prior transfer prose/commit in thread — still post-handoff after thanks-close (533540551). */
function hasBotHandoffCommitmentInHistory(history: HistoryMessage[]) {
  return history.some(
    (message) =>
      message.role === "assistant" &&
      !isInactivityAssistantMessage(message.content) &&
      !isVoiceClosureTemplateMessage({ body: message.content }) &&
      isBotHandoffCommitmentContent(message.content)
  )
}

export function isPostHumanHandoff(lastAction: string | null, history: HistoryMessage[]) {
  if (lastAction === "human_sales" || lastAction === "human_service") return true
  if (hasLiveRepPendingCallbackCommitment(history)) return true
  if (hasBotHandoffCommitmentInHistory(history)) return true
  const last = lastMeaningfulAssistantText(history)
  if (!last) return false
  return isBotHandoffCommitmentContent(last)
}

export function postHandoffKind(
  lastAction: string | null,
  history: HistoryMessage[]
): "human_sales" | "human_service" | null {
  if (lastAction === "human_sales") return "human_sales"
  if (lastAction === "human_service") return "human_service"
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (isVoiceClosureTemplateMessage({ body: message.content })) continue
    const body = assistantBodyWithoutHeader(message.content)
    if (/יועץ\s+מכירות|מחלקת\s+מכירות/i.test(body)) return "human_sales"
    if (/נציג\s+שירות|שירות\s+לקוחות/i.test(body)) return "human_service"
    if (isBotHandoffCommitmentContent(message.content)) break
  }
  if (hasLiveRepPendingCallbackCommitment(history)) return "human_service"
  return null
}

const SHIPPING_DELAY_THREAD_RE =
  /(?:מועד\s+האספקה|ע(?:יכוב|בר)\s+(?:משלוח|מועד)|לא\s+(?:הגיע|קיבל)|אמור\s+להגיע|ימ(?:י|ים)\s+!!!!|סטטוס\s+ומועד\s+הגעה)/i

const SERVICE_SHIPPING_HANDOFF_RE =
  /(?:העבר(?:תי|נו)\s+א(?:ת|ת)\s+ה(?:שיחה|פנייה)|מעביר(?:ים|ה|א)?[^\n]{0,96}נציג\s+שירות|סימנ(?:תי|ו)[^\n]{0,72}(?:דחופ|נציג))/i

const SERVICE_OOO_QUEUE_HANDOFF_RE =
  /אין\s+נציגי\s+שירות[^\n]{0,220}קיבלנו\s+את\s+הפנייה/i

const PARTIAL_DELIVERY_THREAD_RE =
  /(?:מדבקות|פריט\s+חסר|אספקה\s+חלקית|רק[^\n]{0,48}הגיע|לא\s+קיבלתי[^\n]{0,48}שטיח|הגיע[^\n]{0,32}בלי\s+השטיח)/i

const SHIPPING_CASE_ASSISTANT_CONTEXT_RE =
  /(?:משלוח|אספקה|מועד|סטטוס|פופ|שטיח|מדבקות|פרטים\s+לטיפול|הזמנה)/i

function hasLoggedServiceHandoffForShippingCase(history: HistoryMessage[]) {
  return history.some(
    (message) =>
      message.role === "assistant" &&
      isHomBotAssistantMessage(message.content) &&
      SHIPPING_CASE_ASSISTANT_CONTEXT_RE.test(message.content) &&
      (SERVICE_SHIPPING_HANDOFF_RE.test(message.content) ||
        SERVICE_OOO_QUEUE_HANDOFF_RE.test(message.content) ||
        /פרטים\s+לטיפול/i.test(message.content))
  )
}

function hasAfterHoursServiceQueueHandoffInHistory(history: HistoryMessage[]) {
  return history.some(
    (message) =>
      message.role === "assistant" &&
      isHomBotAssistantMessage(message.content) &&
      SERVICE_OOO_QUEUE_HANDOFF_RE.test(message.content)
  )
}

function isOpenShippingOrPartialDeliveryServiceHandoffThread(history: HistoryMessage[]) {
  if (!isPostHumanHandoff(null, history) && !hasAfterHoursServiceQueueHandoffInHistory(history)) {
    return false
  }
  const corpus = history.map((message) => message.content).join("\n")
  const openCase =
    (SHIPPING_DELAY_THREAD_RE.test(corpus) || PARTIAL_DELIVERY_THREAD_RE.test(corpus)) &&
    /(?:משלוח|אספקה|פופ|הזמנה|שטיח)/i.test(corpus)
  if (!openCase) return false
  return hasLoggedServiceHandoffForShippingCase(history)
}

/** human_service already logged on a shipping-delay case — customer may chase rep response (528863688). */
export function isOpenShippingDelayServiceHandoffThread(history: HistoryMessage[]) {
  return isOpenShippingOrPartialDeliveryServiceHandoffThread(history)
}

/** Partial delivery / missing line after service handoff — customer may ping or chase callback (532010096). */
export function isPartialDeliveryServiceHandoffAwaitingCallback(history: HistoryMessage[]) {
  if (!isOpenShippingOrPartialDeliveryServiceHandoffThread(history)) return false
  const corpus = history.map((message) => message.content).join("\n")
  return PARTIAL_DELIVERY_THREAD_RE.test(corpus)
}

const POST_HANDOFF_RESPONSE_WAIT_RE =
  /(?:עיכוב\s+בתשובה|זלזול|זילזול|אין\s+(?:לי\s+)?מענה|לא\s+מעדכ(?:ן|נ)|אף\s+אחד\s+לא\s+מעדכן|(?:עדיין\s+)?לא\s+חזר(?:ו|ה|ת)[^\n]{0,24}אלי|ש(?:לא|עדיין\s+לא)\s+חזרו)/i

/** After shipping-delay handoff — complaint about slow human response, not a fresh transfer ask. */
export function isShippingDelayHandoffResponseWaitFollowUp(
  history: HistoryMessage[],
  body: string
) {
  if (!isOpenShippingOrPartialDeliveryServiceHandoffThread(history)) return false
  const text = body.trim()
  if (!text || text.length > 520) return false
  return POST_HANDOFF_RESPONSE_WAIT_RE.test(text)
}

const SHIPPING_DELAY_ANSWER_WAIT_RE =
  /(?:ממתינ(?:ה|ים|ות)?|מחכ(?:ה|ים))[^\n]{0,40}(?:ל)?(?:תשובה|התייחסות|מענה)/i

/** Shipping-delay service handoff — gentle wait for rep answer (534103691), not a complaint chase. */
export function isShippingDelayHandoffAnswerWaitFollowUp(
  history: HistoryMessage[],
  body: string
) {
  if (!isOpenShippingDelayServiceHandoffThread(history)) return false
  if (isPartialDeliveryServiceHandoffAwaitingCallback(history)) return false
  const text = body.trim()
  if (!text || text.length > 160) return false
  if (isShippingDelayHandoffResponseWaitFollowUp(history, body)) return false
  return SHIPPING_DELAY_ANSWER_WAIT_RE.test(text)
}

/** Replacement carpet delivery / coordination after defect — human_service already logged (533162865). */
export function isOpenReplacementDeliveryServiceHandoffThread(history: HistoryMessage[]) {
  if (!isPostHumanHandoff(null, history)) return false
  const corpus = history.map((message) => message.content).join("\n")
  if (
    !/(?:שטיח\s+חלופ|החלפ(?:ה|ת)\s+לשטיח|ת(?:יאום|אום)\s+(?:ה)?אספק(?:ה|ת))/i.test(
      corpus
    )
  ) {
    return false
  }
  if (!/(?:פג(?:ם|ום|מים)|חלופ|החלפ|ביטול\s+עסקה)/i.test(corpus)) return false
  return history.some(
    (message) =>
      message.role === "assistant" &&
      isHomBotAssistantMessage(message.content) &&
      SERVICE_SHIPPING_HANDOFF_RE.test(message.content)
  )
}

/** After replacement-delivery handoff — nobody called back yet (533162865). */
export function isReplacementDeliveryCallbackWaitFollowUp(
  history: HistoryMessage[],
  body: string
) {
  if (!isOpenReplacementDeliveryServiceHandoffThread(history)) return false
  const text = body.trim()
  if (!text || text.length > 160) return false
  return (
    /טרם\s+חזר(?:ו|ה)?(?:\s+אלי(?:י|ך)?)?/i.test(text) ||
    /(?:עדיין\s+)?לא\s+חזר(?:ו|ה|ת)(?:\s+אלי(?:י|ך)?)?/i.test(text) ||
    /(?:אין\s+מענה|לא\s+עונ(?:ים|ה))/i.test(text)
  )
}

/** After shipping-delay handoff — short «יש חדש?» / greeting + news ask (534083795). */
export function isShippingDelayHandoffNewsFollowUp(
  history: HistoryMessage[],
  body: string
) {
  if (!isPostHumanHandoff(null, history)) return false
  const corpus = history.map((message) => message.content).join("\n")
  if (!SHIPPING_DELAY_THREAD_RE.test(corpus)) return false
  if (!/(?:משלוח|אספקה|פופ|הזמנה)/i.test(corpus)) return false
  const hasServiceShippingHandoff = history.some(
    (message) =>
      message.role === "assistant" &&
      isHomBotAssistantMessage(message.content) &&
      SERVICE_SHIPPING_HANDOFF_RE.test(message.content)
  )
  if (!hasServiceShippingHandoff) return false
  const text = body.trim()
  if (!text || text.length > 220) return false
  return /יש\s*חדש/i.test(text)
}

/** Branch/store refund credit already handed off — customer chases status (532600018). */
export function isRefundCreditPostHandoffStatusFollowUp(
  history: HistoryMessage[],
  body: string
) {
  if (!isOpenRefundCreditFollowUpThread(history)) return false
  if (!isPostHumanHandoff(null, history)) return false
  const text = body.trim()
  if (!text || text.length > 120) return false
  if (/^מה\s+קורה\s+ע/i.test(text)) return true
  if (/^מה\s+ע(?:ם|im)\s+(?:ה)?(?:החזר|זיכוי)/i.test(text)) return true
  return false
}

/** Gentle reminder on the last FAQ answer after handoff — not on every bubble. */
export function buildPostHandoffFooter(kind: "human_sales" | "human_service") {
  return kind === "human_sales"
    ? "היועץ כבר קיבל את הפנייה ויצור קשר — בינתיים שמח לעזור."
    : "הנציג כבר קיבל את הפנייה ויצור קשר — בינתיים שמח לעזור."
}

/** Product-inquiry sales intake recap already sent to יועץ מכירות (349121914). */
export function isSalesProductInquiryHandoffCompleteInHistory(history: HistoryMessage[]) {
  return history.some(
    (message) =>
      message.role === "assistant" &&
      /בשביל\s+יועץ\s+המכירות/i.test(message.content) &&
      /(?:•\s*מוצר:|מידות\s+החלל)/i.test(message.content) &&
      /(?:העבר(?:תי|נו)\s+א(?:ת|ת)\s+ה(?:שיחה|פנייה)|קיבלנו\s+את\s+הפנייה|יועצ(?:י|)\s+מכירות|אין\s+יועצי\s+מכירות)/i.test(
        message.content
      ) &&
      !/(?:סוג\s+החלפה|דגם\s+אחר\s+לגמרי)/i.test(message.content)
  )
}
