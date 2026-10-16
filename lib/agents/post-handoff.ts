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

const PAST_DECLARATIVE_HANDOFF_RE =
  /(?:מעולה,\s*)?העבר(?:תי|נו)\s+א(?:ת|ת(?:כם|))?\s*(?:ה)?(?:שיחה|פנייה)/iu

/** Rep bullet recap + transfer wording but action stayed reply (295276261). */
function isLlmHandoffRecapWithoutCrmAssign(body: string) {
  if (!/(?:העבר(?:תי|נו)|מעביר(?:ים|ה|א)?).{0,120}נציג/i.test(body)) return false
  if (/מעולה,\s+העבר(?:תי|נו)/i.test(body)) return false
  return /(?:•\s|בירור\s+סטטוס|טלפון:\s*\d|מטרת\s+הפנייה)/i.test(body)
}

export function hasDeclarativeHandoffTransferInText(text: string) {
  const body = assistantBodyWithoutHeader(text) || text.trim()
  if (DECLARATIVE_HANDOFF_TRANSFER_RE.test(body)) return true
  return PAST_DECLARATIVE_HANDOFF_RE.test(body)
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
    SERVICE_OOO_QUEUE_HANDOFF_RE.test(body) ||
    isBotHandoffAssistantMessage(content)
  )
}

/** Past-tense CRM assign — future «מעביר ליועץ» alone is not executed (530164166 vs 498385542). */
export function hasPastTenseHandoffExecutedInText(text: string) {
  const body = assistantBodyWithoutHeader(text)
  if (!body) return false
  if (isLlmHandoffRecapWithoutCrmAssign(body)) return false
  return HANDOFF_CONFIRMED_RE.test(body) || /מעולה,\s+העברתי/i.test(body)
}

/** Past-tense CRM assign — future «אני מעביר» alone is not executed (533540551). */
export function assistantTextIndicatesHandoffExecuted(text: string) {
  const body = assistantBodyWithoutHeader(text)
  if (!body) return false
  return (
    hasPastTenseHandoffExecutedInText(text) ||
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

const PRE_DELIVERY_CANCEL_THREAD_RE =
  /(?:ביטול\s+(?:ה)?(?:הזמנה|עסקה)|לבטל\s+א(?:ת)?\s+(?:ה)?(?:עסקה|הזמנה)|BUYME|ביימי|עסקה\s+מחדש)/i

const PRE_DELIVERY_CANCEL_HANDOFF_CONTEXT_RE =
  /(?:ביטול[^\n]{0,96}(?:BUYME|ביימי)|(?:BUYME|ביימי)[^\n]{0,96}ביטול|לפני\s+ש(?:היא|)[^\n]{0,48}(?:מחסן|יוצא)|נארז)/i

function isOpenPreDeliveryCancelServiceHandoffThread(history: HistoryMessage[]) {
  if (!isPostHumanHandoff(null, history) && !hasAfterHoursServiceQueueHandoffInHistory(history)) {
    return false
  }
  const corpus = history.map((message) => message.content).join("\n")
  if (!PRE_DELIVERY_CANCEL_THREAD_RE.test(corpus)) return false
  if (!PRE_DELIVERY_CANCEL_HANDOFF_CONTEXT_RE.test(corpus) && !/ביטול/i.test(corpus)) {
    return false
  }
  return history.some(
    (message) =>
      message.role === "assistant" &&
      isHomBotAssistantMessage(message.content) &&
      (SERVICE_SHIPPING_HANDOFF_RE.test(message.content) ||
        SERVICE_OOO_QUEUE_HANDOFF_RE.test(message.content) ||
        PRE_DELIVERY_CANCEL_HANDOFF_CONTEXT_RE.test(message.content) ||
        /העבר(?:תי|נו)\s+א(?:ת|ת)\s+ה(?:שיחה|פנייה)|קיבלנו\s+את\s+הפנייה/i.test(
          message.content
        ))
  )
}

/** Pre-delivery cancel + BUYME reorder already handed off — customer may chase rep (534579658). */
export function isPreDeliveryCancelServiceHandoffAwaitingCallback(history: HistoryMessage[]) {
  return isOpenPreDeliveryCancelServiceHandoffThread(history)
}

const PRE_DELIVERY_CANCEL_RESPONSE_WAIT_RE =
  /(?:אין\s+(?:לי\s+)?מענה|לא\s+עונ(?:ים|ה)?(?:\s+אלי(?:י|ך))?|אף\s+אחד\s+לא(?:\s+עונ(?:ה|ים))?|(?:עדיין\s+)?לא\s+ח(?:זר|וזר)(?:ו|ה|ת|ים)(?:\s+אלי(?:י|ך))?|עיכוב\s+בתשובה|זלזול|זילזול|(?:למה|מדוע)[^\n]{0,48}לא\s+מעביר(?:ים|)?\s+(?:זיכוי|החזר)|שירות[^\n]{0,32}מזעז)/i

/** After pre-delivery cancel handoff — nobody answered yet (534579658). */
export function isPreDeliveryCancelHandoffResponseWaitFollowUp(
  history: HistoryMessage[],
  body: string
) {
  if (!isOpenPreDeliveryCancelServiceHandoffThread(history)) return false
  const text = body.trim()
  if (!text || text.length > 520) return false
  if (/^(?:\?{1,3}|!{2,})$/.test(text)) return true
  return PRE_DELIVERY_CANCEL_RESPONSE_WAIT_RE.test(text)
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

/** Replacement courier arrived but binding/cant still wrong — recap must not say «עדיין לא הגיע» (533162865). */
export function isReplacementDeliveredStillWrongThread(history: HistoryMessage[]) {
  if (!isOpenReplacementDeliveryServiceHandoffThread(history)) return false
  const userCorpus = history
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n")
  if (!/(?:הגיע\s+שליח|שליח\s+הגיע|הבוקר\s+הגיע)/i.test(userCorpus)) return false
  if (!/(?:שטיח\s+חלופ|החלופ)/i.test(userCorpus)) return false
  return /(?:סיומת|קאנט|קנט|לא\s+כמו\s+שמופיע|ביקורת\s+איכות|פגם)/i.test(userCorpus)
}

const REPLACEMENT_DELIVERED_WRONG_PROGRESS_CHASE_RE =
  /(?:ממתינ(?:ה|ים|ות)?|מחכ(?:ה|ים))[^\n]{0,56}(?:ל)?(?:תשובה|תגובה|התייחסות|מענה)|איך\s+מתקדמ|דחוף\s+עם\s+פתרון/i

/** Progress / callback chase after replacement arrived but still wrong (533162865 Oct 15). */
export function isReplacementDeliveredWrongProgressChaseFollowUp(
  history: HistoryMessage[],
  body: string
) {
  if (!isReplacementDeliveredStillWrongThread(history)) return false
  const text = body.trim()
  if (!text || text.length > 520) return false
  return REPLACEMENT_DELIVERED_WRONG_PROGRESS_CHASE_RE.test(text)
}

const PREORDER_RESTOCK_THREAD_RE =
  /(?:הזמנה\s+מוקדמת|חידוש\s+(?:ה)?מלאי|Pre\s+Order|מוקדמת)/i

/** Pre-order restock ETA check already handed to service (529931531). */
export function isOpenPreorderRestockServiceHandoffThread(history: HistoryMessage[]) {
  if (!isPostHumanHandoff(null, history)) return false
  const corpus = history.map((message) => message.content).join("\n")
  if (!PREORDER_RESTOCK_THREAD_RE.test(corpus)) return false
  if (!/(?:SO\d|צפוי\s+חידוש|בדיק(?:ה|ת)\s+מתי)/i.test(corpus)) return false
  return history.some(
    (message) =>
      message.role === "assistant" &&
      isHomBotAssistantMessage(message.content) &&
      SERVICE_SHIPPING_HANDOFF_RE.test(message.content)
  )
}

const PREORDER_RESTOCK_CALLBACK_WAIT_RE =
  /(?:מחכ(?:ה|ים)[^\n]{0,56}(?:ל)?(?:טלפון|קשר|ש(?:ת)?(?:ענ|צר)|תשובה)|מתי\s+(?:ת)?(?:יצר(?:ו|ה)|תחז(?:ר|ו)|תתקשר))/i

/** After preorder restock service handoff — waiting for callback (529931531). */
export function isPreorderRestockCallbackWaitFollowUp(
  history: HistoryMessage[],
  body: string
) {
  if (!isOpenPreorderRestockServiceHandoffThread(history)) return false
  const text = body.trim()
  if (!text || text.length > 160) return false
  return PREORDER_RESTOCK_CALLBACK_WAIT_RE.test(text)
}

const DELIVERY_COORDINATION_THREAD_RE =
  /(?:ת(?:יאום|אום)[^\n]{0,56}(?:מסירה|אספקה|הובלה)|שע(?:ת)?\s+מסירה|חבר(?:ת)?\s+(?:ה)?(?:הובלה|שליח))/i

/** Purchase delivery coordination with carrier — human_service already logged (313407519). */
export function isOpenDeliveryCoordinationServiceHandoffThread(
  history: HistoryMessage[]
) {
  if (!isPostHumanHandoff(null, history)) return false
  if (isOpenReplacementDeliveryServiceHandoffThread(history)) return false
  const corpus = history.map((message) => message.content).join("\n")
  if (!DELIVERY_COORDINATION_THREAD_RE.test(corpus)) return false
  if (!/(?:משלוח|אספקה|שטיח|הובלה)/i.test(corpus)) return false
  const botCoordinationHandoff = history.some(
    (message) =>
      message.role === "assistant" &&
      isHomBotAssistantMessage(message.content) &&
      /(?:חבר(?:ת)?\s+(?:ה)?הובלה|ת(?:יאום|אום)\s+(?:מסירה|אספקה))/i.test(
        message.content
      ) &&
      (assistantTextIndicatesHandoffExecuted(message.content) ||
        hasDeclarativeHandoffTransferInText(message.content))
  )
  return botCoordinationHandoff || hasLoggedServiceHandoffForShippingCase(history)
}

/** Same-day / slot timing ask on open coordination case after handoff (313407519). */
export function isDeliveryCoordinationTimingFollowUp(
  history: HistoryMessage[],
  body: string
) {
  if (!isOpenDeliveryCoordinationServiceHandoffThread(history)) return false
  const text = body.trim()
  if (!text || text.length > 320) return false
  if (isShippingDelayHandoffResponseWaitFollowUp(history, body)) return false
  if (isReplacementDeliveryCallbackWaitFollowUp(history, body)) return false
  return (
    /(?:סיכוי|אפשר|מתי|האם)[^\n]{0,96}(?:היום|לקבל|יגיע|מסיר|עד\s+\d)/i.test(
      text
    ) ||
    (/היום/i.test(text) &&
      /(?:שטיח|משלוח|מסיר|18|קבל)/i.test(text))
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

const EXTRA_RUG_PICKUP_THREAD_RE =
  /(?:ש(?:לח(?:ו|ת(?:ם|)?)|הגיע)\s+)?שטיח\s*(?:ה)?נוסף|שטיח\s+נוסף\s+בטעות|אותו\s+שטיח\s+פעמיים|שטיח\s+כפול/i

/** Wrong/extra rug pickup + optional salon recommendation — service handoff already logged (533672658). */
export function isOpenExtraRugPickupServiceHandoffThread(history: HistoryMessage[]) {
  if (!isPostHumanHandoff(null, history) && !hasAfterHoursServiceQueueHandoffInHistory(history)) {
    return false
  }
  const corpus = history.map((message) => message.content).join("\n")
  if (!EXTRA_RUG_PICKUP_THREAD_RE.test(corpus)) return false
  return (
    hasExecutedBotHandoffInHistory(history) ||
    history.some(
      (message) =>
        message.role === "assistant" &&
        isHomBotAssistantMessage(message.content) &&
        /שטיח\s*(?:ה)?נוסף/i.test(message.content) &&
        /(?:איסוף|מתנה|לא\s+נשאר|קיבלנו\s+את\s+הפנייה|העבר(?:תי|נו))/i.test(
          message.content
        )
    )
  )
}

const EXTRA_RUG_PICKUP_WAIT_BODY_RE =
  /(?:ימכר|למכור|נמכר|מתנה|לא\s+למכור|תודה)/i

/** After extra-rug service handoff — thanks, sale intent, or gift policy ping (533672658). */
export function isExtraRugPickupHandoffWaitFollowUp(
  history: HistoryMessage[],
  body: string
) {
  if (!isOpenExtraRugPickupServiceHandoffThread(history)) return false
  const text = body.trim()
  if (!text || text.length > 220) return false
  return EXTRA_RUG_PICKUP_WAIT_BODY_RE.test(text)
}
