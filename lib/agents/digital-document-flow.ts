import { CUSTOMER_HEADER, CUSTOMER_NATURAL_CLOSE } from "@/lib/agents/types"
import type { HistoryMessage } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import { isValidIsraeliMobilePhone } from "@/lib/agents/phone-for-api"
import { callPriorityWebhook } from "@/lib/agents/priority-webhook"
import {
  buildAlternatePhoneRequestPrompt,
  buildDigitalDocumentLookupFailureReply,
  buildDigitalDocumentNotFoundReply,
  buildDigitalDocumentReply,
  buildPhoneLookupDeclinedReply,
  extractPhoneFromText,
  formatDisplayPhone,
  isOrderConfirmationNo,
  isPurePhoneLookupConfirmYes,
  resolveLookupPhoneFromHistory,
  userProvidedPhone,
} from "@/lib/agents/order-lookup"

/** Courier delivery → receipt + tax invoice. Branch pickup → tax invoice receipt only. */
export type DocumentPurchaseChannel = "website" | "store"

export const DOCUMENT_TYPE_RECEIPT = "קבלה"
export const DOCUMENT_TYPE_TAX_INVOICE = "חשבונית מס"
export const DOCUMENT_TYPE_TAX_INVOICE_RECEIPT = "חשבונית מס קבלה"

export type DocumentType =
  | typeof DOCUMENT_TYPE_RECEIPT
  | typeof DOCUMENT_TYPE_TAX_INVOICE
  | typeof DOCUMENT_TYPE_TAX_INVOICE_RECEIPT

export type DocumentIntent = "invoice" | "receipt" | "generic"

const CHANNEL_QUESTION_MARKER =
  /(?:סופק(?:ו)?\s+מהסניף|באמצעות\s+שליח|מלאי(?:\s+ה)?סניף|אתר(?:\s+ה)?אינטרנט(?:\s+עם\s+שליח)?)/i
const PURCHASE_LOCATION_QUESTION_MARKER =
  /האם\s+ה(?:ה)?זמנה\s+בוצעה\s+מ(?:ה)?(?:אינטרנט|הסניף)|מהאינטרנט\s+או\s+בסניף/i
const TYPE_QUESTION_MARKER = /איזה\s+סוג\s+(?:חשבונית|מסמך)/i
const LEGACY_TYPE_QUESTION_MARKER = /איזה\s+סוג\s+מסמך/i
const PHONE_QUESTION_MARKER =
  /(?:האם\s+(?:העסקה|היא)\s+רשומה\s+על\s+המספר|האם\s+היא\s+רשומה\s+על\s+המספר|האם\s+ההזמנה\s+(?:היא\s+)?על\s+טלפון|האם\s+ההזמנה\s+על\s+המספר)/i
const ALTERNATE_PHONE_QUESTION_MARKER = /מה מספר הטלפון שבוצעה עליו ההזמנה/i
const DOCUMENT_MISUNDERSTANDING_MARKER =
  /נראה\s+ש(?:ה)?הודעה\s+לא\s+עברה|לא\s+ה(?:בנ|צל)(?:תי)?\s+—\s+האם/i

type DocumentQuestionKind =
  | "type"
  | "channel"
  | "purchase_location"
  | "phone"
  | "alternate_phone"

type DocumentFlowState = {
  active: boolean
  intent: DocumentIntent | null
  selectedType: DocumentType | null
  channel: DocumentPurchaseChannel | null
  typeQuestionSent: boolean
  channelQuestionSent: boolean
  purchaseLocationQuestionSent: boolean
  phoneQuestionSent: boolean
  alternatePhoneQuestionSent: boolean
  phoneConfirmed: boolean
  lastQuestionKind: DocumentQuestionKind | null
  misunderstandingSinceLastQuestion: boolean
}

const LEADING_GREETING_RE =
  /^(?:שלום|היי|הי|אהלן|בוקר\s+טוב|ערב\s+טוב|מה\s+נשמע|מה\s+קורה|מה\s+שלומ(?:ך|כם)|hello|hi|hey|good\s+(?:morning|evening))(?:[\s,!?.]+)*/iu

const DOCUMENT_TYPE_FALLBACKS: Record<DocumentType, DocumentType[]> = {
  [DOCUMENT_TYPE_TAX_INVOICE]: [
    DOCUMENT_TYPE_TAX_INVOICE,
    DOCUMENT_TYPE_TAX_INVOICE_RECEIPT,
  ],
  [DOCUMENT_TYPE_TAX_INVOICE_RECEIPT]: [
    DOCUMENT_TYPE_TAX_INVOICE_RECEIPT,
    DOCUMENT_TYPE_TAX_INVOICE,
  ],
  [DOCUMENT_TYPE_RECEIPT]: [DOCUMENT_TYPE_RECEIPT],
}

function stripLeadingGreetings(text: string) {
  let body = text.trim()
  for (let i = 0; i < 3; i++) {
    const next = body.replace(LEADING_GREETING_RE, "").trim()
    if (next === body) break
    body = next
  }
  return body
}

function documentQuestionKind(content: string): DocumentQuestionKind | null {
  if (TYPE_QUESTION_MARKER.test(content) || LEGACY_TYPE_QUESTION_MARKER.test(content)) {
    return "type"
  }
  if (PURCHASE_LOCATION_QUESTION_MARKER.test(content)) return "purchase_location"
  if (CHANNEL_QUESTION_MARKER.test(content)) return "channel"
  if (ALTERNATE_PHONE_QUESTION_MARKER.test(content)) return "alternate_phone"
  if (PHONE_QUESTION_MARKER.test(content)) return "phone"
  return null
}

function isDocumentFlowMisunderstandingReply(content: string) {
  return DOCUMENT_MISUNDERSTANDING_MARKER.test(content)
}

function typeOptionsForIntent(intent: DocumentIntent | null): DocumentType[] {
  if (intent === "invoice") {
    return [DOCUMENT_TYPE_TAX_INVOICE, DOCUMENT_TYPE_TAX_INVOICE_RECEIPT]
  }
  if (intent === "receipt") return [DOCUMENT_TYPE_RECEIPT]
  return [
    DOCUMENT_TYPE_TAX_INVOICE,
    DOCUMENT_TYPE_TAX_INVOICE_RECEIPT,
    DOCUMENT_TYPE_RECEIPT,
  ]
}

function typeOptionsFromQuestion(content: string): DocumentType[] {
  if (/איזה\s+סוג\s+חשבונית/i.test(content)) {
    return [DOCUMENT_TYPE_TAX_INVOICE, DOCUMENT_TYPE_TAX_INVOICE_RECEIPT]
  }
  if (/^[\s\S]*\n\s*3\.\s*קבלה/m.test(content)) {
    return [
      DOCUMENT_TYPE_TAX_INVOICE,
      DOCUMENT_TYPE_TAX_INVOICE_RECEIPT,
      DOCUMENT_TYPE_RECEIPT,
    ]
  }
  if (/^[\s\S]*\n\s*2\.\s*חשבונית\s+מס\s+קבלה/m.test(content)) {
    return [DOCUMENT_TYPE_TAX_INVOICE, DOCUMENT_TYPE_TAX_INVOICE_RECEIPT]
  }
  return [
    DOCUMENT_TYPE_TAX_INVOICE,
    DOCUMENT_TYPE_TAX_INVOICE_RECEIPT,
    DOCUMENT_TYPE_RECEIPT,
  ]
}

function lastTypeQuestionOptions(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    if (
      TYPE_QUESTION_MARKER.test(message.content) ||
      LEGACY_TYPE_QUESTION_MARKER.test(message.content)
    ) {
      return typeOptionsFromQuestion(message.content)
    }
  }
  return null
}

/** Consecutive document-flow questions at the end of the thread (accidental double-reply). */
export function trailingDocumentAssistantBurst(history: HistoryMessage[]) {
  const burst: HistoryMessage[] = []
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") break
    if (isInactivityAssistantMessage(message.content)) continue
    if (isDocumentFlowMisunderstandingReply(message.content)) {
      if (burst.length > 0) break
      continue
    }
    const kind = documentQuestionKind(message.content)
    if (!kind) {
      if (burst.length > 0) break
      break
    }
    burst.unshift(message)
  }
  return burst
}

function isBranchFulfillmentUncertainty(text: string) {
  return /(?:לא\s+(?:זוכר(?:ת|ים|ות)?|יודע(?:ת|ים|ות)?|בטוח(?:ה|ים|ות)?)|(?:א|ב)יזה\s+סניף|איזה\s+סניף)/i.test(
    text
  )
}

export function isDocumentChannelUncertaintyAnswer(body: string) {
  return isBranchFulfillmentUncertainty(body.trim())
}

function isShortAmbiguousAnswer(text: string) {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > 24) return false
  return /^(?:כן|לא|אוקיי|סבבה|נכון|בטח|yes|👍)(?:[\s,.!?]*|$)/iu.test(trimmed)
}

function mentionsAlternatePhoneIntent(body: string) {
  return /טלפון|מס(?:'|׳|פר)?|אחר|אח(?:י|ות)?|בעל|אשה|של/i.test(body)
}

function buildPhoneLookupClarify(whatsappPhone: string) {
  return `${CUSTOMER_HEADER}
לא הבנתי — האם העסקה רשומה על המספר ממנו אני מתכתב כרגע? ${formatDisplayPhone(whatsappPhone)}
אם לא, אשמח לציון המספר הנכון.`
}

function mentionsReceipt(text: string) {
  if (/^קבלה$/i.test(text.trim())) return true
  return /(?:^|[\s,.!?])קבלה(?:[\s,.!?]|$)/i.test(text)
}

export function inferDocumentIntent(body: string): DocumentIntent | null {
  const text = stripLeadingGreetings(body.trim())
  if (!text) return null
  if (/חשבונית/i.test(text)) return "invoice"
  if (mentionsReceipt(text)) return "receipt"
  if (isDigitalDocumentRequest(text)) return "generic"
  return null
}

export function parseDocumentTypeFromText(body: string): DocumentType | null {
  const text = body.trim()
  if (!text) return null
  if (/חשבונית\s+מס\s+קבלה/i.test(text)) return DOCUMENT_TYPE_TAX_INVOICE_RECEIPT
  if (/חשבונית\s+מס/i.test(text)) return DOCUMENT_TYPE_TAX_INVOICE
  if (/^חשבונית$/i.test(text)) return null
  if (mentionsReceipt(text) && !/חשבונית/i.test(text)) return DOCUMENT_TYPE_RECEIPT
  return null
}

export function parseDocumentTypeSelection(
  body: string,
  history: HistoryMessage[] = []
): DocumentType | null {
  const fromText = parseDocumentTypeFromText(body)
  if (fromText) return fromText

  const trimmed = body.trim()
  if (!/^[123]$/.test(trimmed)) return null

  const options = lastTypeQuestionOptions(history) ?? typeOptionsForIntent(null)
  const index = Number.parseInt(trimmed, 10) - 1
  return options[index] ?? null
}

function selectedTypeFromRequest(body: string, intent: DocumentIntent | null): DocumentType | null {
  const parsed = parseDocumentTypeFromText(body)
  if (parsed) return parsed
  if (intent === "receipt") return DOCUMENT_TYPE_RECEIPT
  return null
}

function computeDocumentFlowState(history: HistoryMessage[]): DocumentFlowState {
  const state: DocumentFlowState = {
    active: false,
    intent: null,
    selectedType: null,
    channel: null,
    typeQuestionSent: false,
    channelQuestionSent: false,
    purchaseLocationQuestionSent: false,
    phoneQuestionSent: false,
    alternatePhoneQuestionSent: false,
    phoneConfirmed: false,
    lastQuestionKind: null,
    misunderstandingSinceLastQuestion: false,
  }

  for (let index = 0; index < history.length; index += 1) {
    const message = history[index]!
    const priorHistory = history.slice(0, index)

    if (message.role === "user") {
      if (isDigitalDocumentRequest(message.content)) {
        state.active = true
        state.intent = inferDocumentIntent(message.content) ?? state.intent ?? "generic"
        state.selectedType =
          state.selectedType ?? selectedTypeFromRequest(message.content, state.intent)
        continue
      }
      if (!state.active) continue

      const parsedType = parseDocumentTypeSelection(message.content, priorHistory)
      if (parsedType && (state.typeQuestionSent || state.lastQuestionKind === "type")) {
        state.selectedType = parsedType
      }

      const parsedChannel = parseDocumentPurchaseChannel(message.content)
      if (parsedChannel && state.channelQuestionSent) {
        state.channel = parsedChannel
      }

      if (
        state.phoneQuestionSent &&
        (isPurePhoneLookupConfirmYes(message.content) ||
          Boolean(extractPhoneFromText(message.content)))
      ) {
        state.phoneConfirmed = true
      }
      continue
    }

    if (message.role !== "assistant" || isInactivityAssistantMessage(message.content)) continue

    const kind = documentQuestionKind(message.content)
    if (kind) {
      state.active = true
      state.lastQuestionKind = kind
      state.misunderstandingSinceLastQuestion = false
      if (kind === "type") state.typeQuestionSent = true
      if (kind === "channel") state.channelQuestionSent = true
      if (kind === "purchase_location") state.purchaseLocationQuestionSent = true
      if (kind === "phone") state.phoneQuestionSent = true
      if (kind === "alternate_phone") state.alternatePhoneQuestionSent = true
      continue
    }

    if (isDocumentFlowMisunderstandingReply(message.content) && state.active) {
      state.misunderstandingSinceLastQuestion = true
    }
  }

  if (activeDigitalDocumentRequest(history)) state.active = true
  return state
}

function buildDocumentRecoveryPrefix(input: {
  history: HistoryMessage[]
  body: string
  selectedTypeFromBody: DocumentType | null
  phoneConfirmYes: boolean
  phoneFromBody: string | null
}) {
  const burst = trailingDocumentAssistantBurst(input.history)
  const answeredPending =
    Boolean(input.selectedTypeFromBody) ||
    input.phoneConfirmYes ||
    Boolean(input.phoneFromBody)
  if (!answeredPending) return ""

  if (burst.length >= 2) return "אוקיי, קיבלתי.\n"
  if (computeDocumentFlowState(input.history).misunderstandingSinceLastQuestion) {
    return "אוקיי, קיבלתי.\n"
  }
  return ""
}

function mentionsDocumentNoun(text: string) {
  return /(?:קבלה|חשבונית(?:\s+מס)?(?:\s+קבלה)?)/i.test(text)
}

function mentionsDocumentRequestIntent(text: string) {
  return (
    /(?:של(?:ח|וח|חו|לח|וף)|(?:ל)?של(?:ח|וח|חו)|ה(?:ביא|וציא)|(?:ל)?קב(?:ל|ל(?:ה|ו|י)?)|(?:ה)?עתק|עותק)/i.test(
      text
    ) ||
    /(?:צריך|רוצ(?:ה|ים|ות)|(?:ת(?:וכל|בדוק)?|(?:א)?(?:פשר|וכל)))/i.test(text) ||
    /בבקשה/i.test(text)
  )
}

/** Verify what was ordered (color, size, model) — send order document, not shipping status. */
export function isOrderLineItemVerificationRequest(body: string) {
  const text = stripLeadingGreetings(body.trim())
  if (!text) return false
  if (isShippingStatusQuestion(text)) return false
  if (/^(?:איך|מה\s+(?:ה)?(?:מדיניות|דרך))/i.test(text)) return false
  if (
    /(?:צבע|מידה|דגם|מק(?:״|"|')?ט|פרטי\s+(?:ה)?הזמנה).*(?:לא\s+תואם|שונה|דהוי|נראה\s+שונה|שונה\s+בפועל)/i.test(
      text
    )
  ) {
    return false
  }
  return (
    /(?:רק\s+)?(?:רוצ(?:ה|ים|ות)|צריך(?:ים)?)\s+(?:ל)?(?:וודא|לבדוק|לראות|לאמת).*(?:צבע|מידה|דגם|מק(?:״|"|')?ט|(?:ה)?הזמנ(?:ה|תי))/i.test(
      text
    ) ||
    /(?:ל)?(?:וודא|בדוק|א(?:מת|שר)|לראות).*(?:צבע|מידה|דגם|מק(?:״|"|')?ט|מה\s+הזמנ(?:תי|ת)|פרטי\s+(?:ה)?הזמנה)/i.test(
      text
    ) ||
    /(?:צבע|מידה|דגם|מה\s+הזמנ(?:תי|ת)|פרטי\s+(?:ה)?הזמנה).*(?:ל)?(?:וודא|בדוק|נכון|מ(?:ה)?(?:הזמנ(?:תי|ת)))/i.test(
      text
    )
  )
}

function isShippingStatusQuestion(text: string) {
  return (
    /איפה\s+(?:ה)?(?:משלוח|הזמנה|חבילה)/i.test(text) ||
    /סטטוס\s+(?:ה)?(?:משלוח|הזמנה)/i.test(text) ||
    /מעקב\s+(?:אחרי\s+)?(?:ה)?(?:משלוח|חבילה|הזמנה)/i.test(text) ||
    /(?:ה)?(?:משלוח|הזמנה|חבילה)\s+שלי/i.test(text) ||
    /מתי\s+(?:זה\s+)?(?:יגיע|מגיע|אמור\s+ל(?:הגיע|הגיע))/i.test(text)
  )
}

export function activeOrderLineItemVerificationRequest(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "user") continue
    if (isOrderLineItemVerificationRequest(message.content)) return true
  }
  return false
}

/** Customer wants a digital receipt / invoice copy (קבלה = receipt, not admission). */
export function isDigitalDocumentRequest(body: string) {
  const text = stripLeadingGreetings(body.trim())
  if (!text) return false
  if (/^(?:איך|מה\s+(?:ה)?(?:מדיניות|דרך))/i.test(text)) return false
  if (mentionsDocumentNoun(text) && mentionsDocumentRequestIntent(text)) return true
  return (
    /(?:של(?:ח|וח|חו|לח|וף)|(?:ל)?של(?:ח|וח|חו)|ה(?:ביא|וציא)|(?:ל)?קב(?:ל|ל(?:ה|ו|י)?))(?:\s+לי|\s+ל|\s+בבקשה)?\s*(?:א(?:ת|ת)?\s+)?(?:ה)?(?:קבלה|חשבונית)/i.test(
      text
    ) ||
    /(?:העתק|עותק)(?:\s+של)?\s*(?:ה)?(?:קבלה|חשבונית)/i.test(text) ||
    /(?:קבלה|חשבונית(?:\s+מס)?(?:\s+קבלה)?)\s+(?:של|ע(?:ל|בור)|ל)/i.test(text) ||
    /(?:צריך|רוצ(?:ה|ים|ות)|(?:ת(?:וכל|בדוק)?|(?:א)?(?:פשר|וכל)))(?:\s+\S+){0,5}\s*(?:בבקשה\s+)?(?:א(?:ת|ת)?\s+)?(?:ה)?(?:העתק|עותק|קבלה|חשבונית)/i.test(
      text
    ) ||
    /(?:ה)?קבלה(?:\s+שלי|\s+של)?/i.test(text) ||
    /receipt|invoice\s+copy|copy\s+of\s+(?:my\s+)?(?:receipt|invoice)/i.test(text)
  )
}

export function isDocumentTypeSelection(body: string) {
  const text = body.trim()
  if (!text || text.length > 40) return false
  return (
    /^[123]$/i.test(text) ||
    /^קבלה$/i.test(text) ||
    /^חשבונית(?:\s+מס)?(?:\s+קבלה)?$/i.test(text) ||
    Boolean(parseDocumentTypeFromText(text))
  )
}

export function activeDigitalDocumentRequest(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "user") continue
    if (isDigitalDocumentRequest(message.content)) return true
  }
  return false
}

function hasDocumentFlowContext(history: HistoryMessage[]) {
  const state = computeDocumentFlowState(history)
  return (
    state.active ||
    activeDigitalDocumentRequest(history) ||
    state.typeQuestionSent ||
    state.channelQuestionSent ||
    state.phoneQuestionSent ||
    state.alternatePhoneQuestionSent
  )
}

export function isDocumentTypeQuestionPending(history: HistoryMessage[]) {
  if (!hasDocumentFlowContext(history)) return false
  const state = computeDocumentFlowState(history)
  return state.typeQuestionSent && !state.selectedType && !state.channel
}

export function isDocumentPurchaseLocationQuestionPending(history: HistoryMessage[]) {
  if (!hasDocumentFlowContext(history)) return false
  const state = computeDocumentFlowState(history)
  return state.purchaseLocationQuestionSent && !state.channel
}

export function isDocumentChannelQuestionPending(history: HistoryMessage[]) {
  if (!hasDocumentFlowContext(history)) return false
  const state = computeDocumentFlowState(history)
  return state.channelQuestionSent && !state.channel
}

export function isLegacyDocumentTypeQuestionPending(history: HistoryMessage[]) {
  return isDocumentTypeQuestionPending(history)
}

export function isDocumentPhoneLookupPending(history: HistoryMessage[]) {
  if (!hasDocumentFlowContext(history)) return false
  const state = computeDocumentFlowState(history)
  return (
    state.phoneQuestionSent &&
    !state.phoneConfirmed &&
    !state.alternatePhoneQuestionSent &&
    Boolean(state.selectedType || state.channel)
  )
}

export function isAlternateDocumentPhonePending(history: HistoryMessage[]) {
  if (!hasDocumentFlowContext(history)) return false
  const state = computeDocumentFlowState(history)
  return state.alternatePhoneQuestionSent && !state.phoneConfirmed
}

export function isDocumentFlowMisunderstandingPending(history: HistoryMessage[]) {
  if (!hasDocumentFlowContext(history)) return false
  return computeDocumentFlowState(history).misunderstandingSinceLastQuestion
}

/** Deterministic document copy flow — any step after the first ask. */
export function isActiveDigitalDocumentFlow(
  history: HistoryMessage[] = [],
  body = ""
) {
  if (isDigitalDocumentRequest(body)) return true
  if (
    parseDocumentTypeFromText(body) &&
    (mentionsDocumentRequestIntent(body) || isDocumentTypeSelection(body))
  ) {
    return true
  }
  if (activeDigitalDocumentRequest(history)) return true
  if (isDocumentTypeQuestionPending(history)) return true
  if (isDocumentChannelQuestionPending(history)) return true
  if (isDocumentPurchaseLocationQuestionPending(history)) return true
  if (isDocumentPhoneLookupPending(history)) return true
  if (isAlternateDocumentPhonePending(history)) return true
  if (isDocumentFlowMisunderstandingPending(history)) return true
  if (isDocumentTypeSelection(body) && activeDigitalDocumentRequest(history)) return true
  return false
}

export function shouldHandleDigitalDocumentFlow(
  body: string,
  history: HistoryMessage[] = []
) {
  return isActiveDigitalDocumentFlow(history, body)
}

function phoneForOrderApi(phone: string) {
  let digits = phone.replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith("972")) digits = `0${digits.slice(3)}`
  if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`
  return digits
}

function parseDocumentLink(data: unknown) {
  if (data == null) return null
  if (typeof data === "object" && "result" in data) {
    const link = String((data as { result: unknown }).result ?? "").trim()
    return link || null
  }
  return null
}

async function fetchGetDocumentLink(input: { value: string; documentType: string }) {
  const value = input.value.trim()
  if (!value) return { link: null as string | null, sawResponse: false }

  const data = await callPriorityWebhook({
    actionType: "getDocument",
    value,
    documentType: input.documentType,
  })

  return {
    link: parseDocumentLink(data),
    sawResponse: data != null,
  }
}

/** Store POS lookup — API expects the customer's phone in `value`. */
function storeDocumentRequestValue(phone: string) {
  return phoneForOrderApi(phone)
}

function uniqueLinks(links: Array<string | null | undefined>) {
  return [...new Set(links.map((link) => link?.trim()).filter(Boolean))] as string[]
}

export async function lookupDigitalDocumentsByType(phone: string, documentType: DocumentType) {
  if (!isValidIsraeliMobilePhone(phone)) {
    return { ok: false as const, reason: "invalid_phone" as const, links: [] as string[] }
  }
  const lookupPhone = phoneForOrderApi(phone)
  if (!lookupPhone) {
    return { ok: false as const, reason: "invalid_phone" as const, links: [] as string[] }
  }

  const links: string[] = []
  let sawResponse = false
  for (const type of DOCUMENT_TYPE_FALLBACKS[documentType]) {
    const doc = await fetchGetDocumentLink({ value: lookupPhone, documentType: type })
    sawResponse = sawResponse || doc.sawResponse
    if (doc.link) links.push(doc.link)
  }

  const unique = uniqueLinks(links)
  if (unique.length > 0) return { ok: true as const, links: unique }

  return {
    ok: false as const,
    reason: sawResponse ? ("not_found" as const) : ("api_failed" as const),
    links: [] as string[],
  }
}

export async function lookupDigitalDocumentsForChannel(
  phone: string,
  channel: DocumentPurchaseChannel
) {
  if (!isValidIsraeliMobilePhone(phone)) {
    return { ok: false as const, reason: "invalid_phone" as const, links: [] as string[] }
  }
  const lookupPhone = phoneForOrderApi(phone)
  if (!lookupPhone) {
    return { ok: false as const, reason: "invalid_phone" as const, links: [] as string[] }
  }

  if (channel === "store") {
    const value = storeDocumentRequestValue(lookupPhone)
    const doc = await fetchGetDocumentLink({
      value,
      documentType: DOCUMENT_TYPE_TAX_INVOICE_RECEIPT,
    })
    if (doc.link) return { ok: true as const, links: [doc.link] }
    return {
      ok: false as const,
      reason: doc.sawResponse ? ("not_found" as const) : ("api_failed" as const),
      links: [] as string[],
    }
  }

  const [receipt, invoice] = await Promise.all([
    fetchGetDocumentLink({ value: lookupPhone, documentType: DOCUMENT_TYPE_RECEIPT }),
    fetchGetDocumentLink({ value: lookupPhone, documentType: DOCUMENT_TYPE_TAX_INVOICE }),
  ])

  const links = uniqueLinks([receipt.link, invoice.link])
  if (links.length > 0) return { ok: true as const, links }

  const sawResponse = receipt.sawResponse || invoice.sawResponse
  return {
    ok: false as const,
    reason: sawResponse ? ("not_found" as const) : ("api_failed" as const),
    links: [] as string[],
  }
}

export function buildDocumentTypeQuestion(intent: DocumentIntent | null) {
  if (intent === "invoice") {
    return `${CUSTOMER_HEADER}
איזה סוג חשבונית נדרש?
1. ${DOCUMENT_TYPE_TAX_INVOICE}
2. ${DOCUMENT_TYPE_TAX_INVOICE_RECEIPT}`
  }

  return `${CUSTOMER_HEADER}
איזה סוג מסמך נדרש?
1. ${DOCUMENT_TYPE_TAX_INVOICE}
2. ${DOCUMENT_TYPE_TAX_INVOICE_RECEIPT}
3. ${DOCUMENT_TYPE_RECEIPT}`
}

export function buildDocumentPhoneConfirmPrompt(whatsappPhone: string) {
  return `${CUSTOMER_HEADER}
האם העסקה רשומה על המספר ממנו אני מתכתב כרגע? ${formatDisplayPhone(whatsappPhone)}
אם לא, אשמח לקבל את המספר הנכון.`
}

export function buildDocumentChannelQuestion() {
  return `${CUSTOMER_HEADER}
אין בעיה, האם המוצרים סופקו מהסניף או באמצעות שליח?`
}

export function buildDocumentPurchaseLocationQuestion() {
  return `${CUSTOMER_HEADER}
אין בעיה — האם ההזמנה בוצעה מהאינטרנט או בסניף?`
}

export function buildDocumentChannelClarify() {
  return `${CUSTOMER_HEADER}
לא הבנתי — האם המוצרים סופקו מהסניף, או באמצעות שליח?`
}

export function buildDocumentPurchaseLocationClarify() {
  return `${CUSTOMER_HEADER}
לא הבנתי — האם ההזמנה בוצעה מהאינטרנט, או בסניף?`
}

/**
 * Fulfillment method — not purchase location.
 * Online/internet orders are always courier → website docs.
 * Branch pickup → חשבונית מס קבלה only.
 */
export function parseDocumentPurchaseChannel(body: string): DocumentPurchaseChannel | null {
  const text = body.trim()
  if (!text || isBranchFulfillmentUncertainty(text)) return null

  if (parseCourierFulfillment(text)) return "website"
  if (parseBranchFulfillment(text)) return "store"
  if (parsePurchaseLocationChannel(text)) return parsePurchaseLocationChannel(text)

  return null
}

/** After "אינטרנט או בסניף?" — online always means courier docs. */
function parsePurchaseLocationChannel(text: string): DocumentPurchaseChannel | null {
  if (
    /^(?:אינטרנט|online|website|מהאינטרנט|באתר|מהאתר)$/i.test(text) ||
    /(?:הזמנ(?:תי|ת|נ(?:ו|תם|תן)?)|קנ(?:יתי|ית(?:ם|ן)?)|רכש(?:תי|ת(?:ם|ן)?)).*(?:ב(?:ה)?|מ(?:ה)?|דרך\s*(?:ה)?)?(?:אינטרנט|אתר)/i.test(
      text
    )
  ) {
    return "website"
  }

  if (
    /^(?:סניף|בסניף|מהסניף|בחנות|מהחנות|חנות)$/i.test(text) ||
    /(?:הזמנ(?:תי|ת|נ(?:ו|תם|תן)?)|קנ(?:יתי|ית(?:ם|ן)?)|רכש(?:תי|ת(?:ם|ן)?)).*(?:ב(?:ה)?|מ(?:ה)?)?(?:סניף|חנות)/i.test(
      text
    )
  ) {
    return "store"
  }

  return null
}

function parseCourierFulfillment(text: string) {
  if (
    /(?:שליח|משלוח|נשלח|הובל(?:ה|ת)|courier|delivery|נשלח(?:ו)?\s+(?:אלי|ע(?:ד|ל)|ב(?:מש|)?))/i.test(
      text
    )
  ) {
    return true
  }

  if (
    /(?:^|[\s,.!?-])?(?:אינטרנט|online|website)(?:[\s,.!?]|$)/i.test(text) ||
    /(?:ב|מ|דרך)\s*(?:ה)?(?:אינטרנט|אתר(?:\s+ה(?:אינטרנט|חברה))?)\b/i.test(text) ||
    /(?:הזמנ(?:תי|ת|נ(?:ו|תם|תן)?)|קנ(?:יתי|ית(?:ם|ן)?)|רכש(?:תי|ת(?:ם|ן)?)).*(?:ב(?:ה)?|מ(?:ה)?|דרך\s*(?:ה)?)?(?:אינטרנט|אתר)/i.test(
      text
    )
  ) {
    return true
  }

  return false
}

function parseBranchFulfillment(text: string) {
  return /(?:מהסניף|מ(?:ה)?(?:חנות|מלאי\s+(?:ה)?סניף)|נ(?:לקח|אס(?:ף|פ)|מס(?:ר|ר))(?:ו)?\s+(?:מה)?(?:סניף|חנות)|אס(?:פתי|פ(?:תי|נו))|לקחתי\s+(?:מה)?(?:סניף|חנות)|(?:סופק(?:ו)?|נמס(?:ר|ר)(?:ו)?)\s+(?:מה)?(?:סניף|חנות))/i.test(
    text
  )
}

function buildMultiDocumentReply(links: string[]) {
  if (links.length === 1) return buildDigitalDocumentReply(links[0]!)
  const lines = links.map((link, index) => `${index + 1}. ${link}`)
  return `${CUSTOMER_HEADER}
הנה הקישורים למסמכים הדיגיטליים:
${lines.join("\n")}

${CUSTOMER_NATURAL_CLOSE}`
}

async function deliverDocumentsForPhone(
  phone: string,
  input: { channel?: DocumentPurchaseChannel; documentType?: DocumentType }
) {
  const result = input.channel
    ? await lookupDigitalDocumentsForChannel(phone, input.channel)
    : await lookupDigitalDocumentsByType(phone, input.documentType ?? DOCUMENT_TYPE_RECEIPT)
  if (result.ok) return buildMultiDocumentReply(result.links)
  if (result.reason === "not_found") return buildDigitalDocumentNotFoundReply()
  return buildDigitalDocumentLookupFailureReply()
}

function resolveDocumentLookupPhone(
  body: string,
  history: HistoryMessage[],
  whatsappPhone?: string
) {
  return resolveLookupPhoneFromHistory(history, whatsappPhone, body)
}

function withRecoveryPrefix(prefix: string, reply: string) {
  if (!prefix) return reply
  if (reply.startsWith(CUSTOMER_HEADER)) {
    return `${CUSTOMER_HEADER}\n${prefix}${reply.slice(CUSTOMER_HEADER.length).replace(/^\n+/, "")}`
  }
  return `${prefix}${reply}`
}

function resolveSelectedDocumentType(
  body: string,
  history: HistoryMessage[],
  state: DocumentFlowState
): DocumentType | null {
  return (
    parseDocumentTypeSelection(body, history) ??
    state.selectedType ??
    selectedTypeFromRequest(body, state.intent ?? inferDocumentIntent(body))
  )
}

function needsDocumentTypeQuestion(
  state: DocumentFlowState,
  selectedType: DocumentType | null
) {
  if (selectedType) return false
  if (state.channel) return false
  if (state.typeQuestionSent) return false
  const intent = state.intent ?? "generic"
  return intent !== "receipt"
}

/** Branch/courier only existed to infer doc type — never ask when type is already known. */
function isLegacyChannelContinuation(
  state: DocumentFlowState,
  selectedType: DocumentType | null
) {
  return state.channelQuestionSent && !state.channel && !selectedType
}

async function replyWithPhoneConfirmOrLookup(input: {
  body: string
  whatsappPhone?: string
  recoveryPrefix: string
  selectedType: DocumentType
  channel?: DocumentPurchaseChannel
}) {
  const phoneFromBody = extractPhoneFromText(input.body)
  if (phoneFromBody) {
    const typed = userProvidedPhone(input.body)
    if (!typed) return buildPhoneLookupDeclinedReply()
    return withRecoveryPrefix(
      input.recoveryPrefix,
      await deliverDocumentsForPhone(typed, {
        channel: input.channel,
        documentType: input.selectedType,
      })
    )
  }

  if (input.whatsappPhone) {
    return buildDocumentPhoneConfirmPrompt(input.whatsappPhone)
  }

  return buildPhoneLookupDeclinedReply()
}

export async function resolveDigitalDocumentFlowReply(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
}) {
  const history = input.history ?? []
  const body = input.body.trim()
  const whatsappPhone = input.phone?.trim()
  const state = computeDocumentFlowState(history)
  const selectedTypeFromBody = parseDocumentTypeSelection(body, history)
  const selectedType = resolveSelectedDocumentType(body, history, state)
  const channelFromBody = parseDocumentPurchaseChannel(body)
  const channel = channelFromBody ?? state.channel
  const phoneFromBody = extractPhoneFromText(body)
  const phoneConfirmYes = isPurePhoneLookupConfirmYes(body)
  const recoveryPrefix = buildDocumentRecoveryPrefix({
    history,
    body,
    selectedTypeFromBody,
    phoneConfirmYes,
    phoneFromBody,
  })

  if (isAlternateDocumentPhonePending(history)) {
    const typed = userProvidedPhone(body)
    if (typed) {
      return withRecoveryPrefix(
        recoveryPrefix,
        await deliverDocumentsForPhone(typed, {
          channel: channel ?? undefined,
          documentType: selectedType ?? undefined,
        })
      )
    }
    return withRecoveryPrefix(
      recoveryPrefix,
      `${CUSTOMER_HEADER}
לא זיהיתי מספר טלפון — שלח/i את המספר (למשל 050-1234567).`
    )
  }

  const phoneStepOpen =
    state.phoneQuestionSent &&
    !state.phoneConfirmed &&
    Boolean(selectedType || channel) &&
    (isDocumentPhoneLookupPending(history) ||
      state.misunderstandingSinceLastQuestion ||
      trailingDocumentAssistantBurst(history).some(
        (message) => documentQuestionKind(message.content) === "phone"
      ))

  if (phoneStepOpen) {
    if (phoneFromBody && !phoneConfirmYes) {
      const typed = userProvidedPhone(body)
      if (!typed) return buildPhoneLookupDeclinedReply()
      return withRecoveryPrefix(
        recoveryPrefix,
        await deliverDocumentsForPhone(typed, {
          channel: channel ?? undefined,
          documentType: selectedType ?? undefined,
        })
      )
    }

    if (phoneConfirmYes) {
      const confirmedPhone = resolveDocumentLookupPhone(body, history, whatsappPhone)
      if (!confirmedPhone) return buildPhoneLookupDeclinedReply()
      return withRecoveryPrefix(
        recoveryPrefix,
        await deliverDocumentsForPhone(confirmedPhone, {
          channel: channel ?? undefined,
          documentType: selectedType ?? undefined,
        })
      )
    }

    if (isOrderConfirmationNo(body) && mentionsAlternatePhoneIntent(body)) {
      return buildAlternatePhoneRequestPrompt()
    }

    if (isOrderConfirmationNo(body)) {
      return buildPhoneLookupDeclinedReply()
    }

    if (body && !channelFromBody && whatsappPhone) {
      return withRecoveryPrefix(recoveryPrefix, buildPhoneLookupClarify(whatsappPhone))
    }

    return buildPhoneLookupDeclinedReply()
  }

  if (channel && !selectedType) {
    if (phoneFromBody) {
      const typed = userProvidedPhone(body)
      if (!typed) return buildPhoneLookupDeclinedReply()
      return withRecoveryPrefix(
        recoveryPrefix,
        await deliverDocumentsForPhone(typed, { channel })
      )
    }

    if (whatsappPhone) {
      return buildDocumentPhoneConfirmPrompt(whatsappPhone)
    }

    return buildPhoneLookupDeclinedReply()
  }

  if (needsDocumentTypeQuestion(state, selectedType)) {
    const intent = state.intent ?? inferDocumentIntent(body) ?? "generic"
    return buildDocumentTypeQuestion(intent)
  }

  if (selectedType) {
    return replyWithPhoneConfirmOrLookup({
      body,
      whatsappPhone,
      recoveryPrefix,
      selectedType,
      channel: channel ?? undefined,
    })
  }

  if (isLegacyChannelContinuation(state, selectedType)) {
    if (isDocumentPurchaseLocationQuestionPending(history)) {
      if (body && !isBranchFulfillmentUncertainty(body)) {
        return withRecoveryPrefix(
          recoveryPrefix,
          buildDocumentPurchaseLocationClarify()
        )
      }
      return withRecoveryPrefix(recoveryPrefix, buildDocumentPurchaseLocationQuestion())
    }

    if (isDocumentChannelQuestionPending(history)) {
      if (body && isBranchFulfillmentUncertainty(body)) {
        return withRecoveryPrefix(recoveryPrefix, buildDocumentPurchaseLocationQuestion())
      }

      if (body && !phoneConfirmYes && !isShortAmbiguousAnswer(body)) {
        return withRecoveryPrefix(recoveryPrefix, buildDocumentChannelClarify())
      }
      return withRecoveryPrefix(recoveryPrefix, buildDocumentChannelQuestion())
    }
  }

  if (isDigitalDocumentRequest(body)) {
    const intent = inferDocumentIntent(body) ?? "generic"
    const explicitType = parseDocumentTypeFromText(body)
    if (explicitType) {
      return replyWithPhoneConfirmOrLookup({
        body,
        whatsappPhone,
        recoveryPrefix,
        selectedType: explicitType,
      })
    }
    if (intent === "receipt") {
      return replyWithPhoneConfirmOrLookup({
        body,
        whatsappPhone,
        recoveryPrefix,
        selectedType: DOCUMENT_TYPE_RECEIPT,
      })
    }
    return buildDocumentTypeQuestion(intent)
  }

  if (whatsappPhone) {
    return buildDocumentPhoneConfirmPrompt(whatsappPhone)
  }

  return buildPhoneLookupDeclinedReply()
}
