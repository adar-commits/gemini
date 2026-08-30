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
  buildPhoneLookupConfirmPrompt,
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

const CHANNEL_QUESTION_MARKER =
  /(?:סופק(?:ו)?\s+מהסניף|באמצעות\s+שליח|מלאי(?:\s+ה)?סניף|אתר(?:\s+ה)?אינטרנט(?:\s+עם\s+שליח)?)/i
const PURCHASE_LOCATION_QUESTION_MARKER =
  /האם\s+ה(?:ה)?זמנה\s+בוצעה\s+מ(?:ה)?(?:אינטרנט|הסניף)|מהאינטרנט\s+או\s+בסניף/i
const LEGACY_TYPE_QUESTION_MARKER = /איזה\s+סוג\s+מסמך/i
const PHONE_QUESTION_MARKER =
  /האם היא רשומה על המספר|האם ההזמנה (?:היא )?על טלפון|האם ההזמנה על המספר/i
const ALTERNATE_PHONE_QUESTION_MARKER = /מה מספר הטלפון שבוצעה עליו ההזמנה/i
const DOCUMENT_MISUNDERSTANDING_MARKER =
  /נראה\s+ש(?:ה)?הודעה\s+לא\s+עברה|לא\s+ה(?:בנ|צל)(?:תי)?\s+—\s+האם/i

type DocumentQuestionKind = "channel" | "purchase_location" | "phone" | "alternate_phone"

type DocumentFlowState = {
  active: boolean
  channel: DocumentPurchaseChannel | null
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
  if (PURCHASE_LOCATION_QUESTION_MARKER.test(content)) return "purchase_location"
  if (CHANNEL_QUESTION_MARKER.test(content)) return "channel"
  if (ALTERNATE_PHONE_QUESTION_MARKER.test(content)) return "alternate_phone"
  if (PHONE_QUESTION_MARKER.test(content)) return "phone"
  return null
}

function isDocumentFlowMisunderstandingReply(content: string) {
  return DOCUMENT_MISUNDERSTANDING_MARKER.test(content)
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
לא הבנתי — האם היא רשומה על המספר ממנו אנחנו מתכתבים כרגע? ${formatDisplayPhone(whatsappPhone)}
אם לא, אשמח לציון המספר הנכון.`
}

function computeDocumentFlowState(history: HistoryMessage[]): DocumentFlowState {
  const state: DocumentFlowState = {
    active: false,
    channel: null,
    channelQuestionSent: false,
    purchaseLocationQuestionSent: false,
    phoneQuestionSent: false,
    alternatePhoneQuestionSent: false,
    phoneConfirmed: false,
    lastQuestionKind: null,
    misunderstandingSinceLastQuestion: false,
  }

  for (const message of history) {
    if (message.role === "user") {
      if (isDigitalDocumentRequest(message.content)) {
        state.active = true
        continue
      }
      if (!state.active) continue

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
  channelFromBody: DocumentPurchaseChannel | null
  phoneConfirmYes: boolean
  phoneFromBody: string | null
}) {
  const burst = trailingDocumentAssistantBurst(input.history)
  const answeredPending =
    Boolean(input.channelFromBody) ||
    input.phoneConfirmYes ||
    Boolean(input.phoneFromBody)
  if (!answeredPending) return ""

  if (burst.length >= 2) return "אוקיי, קיבלתי.\n"
  if (computeDocumentFlowState(input.history).misunderstandingSinceLastQuestion) {
    return "אוקיי, קיבלתי.\n"
  }
  return ""
}

/** Customer wants a digital receipt / invoice copy (קבלה = receipt, not admission). */
export function isDigitalDocumentRequest(body: string) {
  const text = stripLeadingGreetings(body.trim())
  if (!text) return false
  if (/^(?:איך|מה\s+(?:ה)?(?:מדיניות|דרך))/i.test(text)) return false
  return (
    /(?:של(?:ח|וף|לח)|ה(?:ביא|וציא))(?:\s+לי|\s+ל)?\s*(?:א(?:ת|ת)?\s+)?(?:ה)?(?:קבלה|חשבונית)/i.test(
      text
    ) ||
    /(?:העתק|עותק)(?:\s+של)?\s*(?:ה)?(?:קבלה|חשבונית)/i.test(text) ||
    /(?:קבלה|חשבונית(?:\s+מס)?(?:\s+קבלה)?)\s+(?:של|ע(?:ל|בור)|ל)/i.test(text) ||
    /(?:צריך|רוצ(?:ה|ים|ות)|(?:ת(?:וכל|בדוק)?|(?:א)?(?:פשר|וכל)))\s+(?:לי\s+)?(?:בבקשה\s+)?(?:א(?:ת|ת)?\s+)?(?:ה)?(?:העתק|עותק|קבלה|חשבונית)/i.test(
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
    /^(?:1|2|3)$/i.test(text) ||
    /^קבלה$/i.test(text) ||
    /^חשבונית(?:\s+מס)?(?:\s+קבלה)?$/i.test(text)
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
    state.channelQuestionSent ||
    state.phoneQuestionSent ||
    state.alternatePhoneQuestionSent
  )
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
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return LEGACY_TYPE_QUESTION_MARKER.test(message.content)
  }
  return false
}

export function isDocumentPhoneLookupPending(history: HistoryMessage[]) {
  if (!hasDocumentFlowContext(history)) return false
  const state = computeDocumentFlowState(history)
  return (
    state.phoneQuestionSent &&
    !state.phoneConfirmed &&
    !state.alternatePhoneQuestionSent &&
    Boolean(state.channel)
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
  if (activeDigitalDocumentRequest(history)) return true
  if (isDocumentChannelQuestionPending(history)) return true
  if (isDocumentPurchaseLocationQuestionPending(history)) return true
  if (isLegacyDocumentTypeQuestionPending(history)) return true
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

  // Online = always courier (there is no physical "internet" pickup point).
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

async function deliverDocumentsForPhone(phone: string, channel: DocumentPurchaseChannel) {
  const result = await lookupDigitalDocumentsForChannel(phone, channel)
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

export async function resolveDigitalDocumentFlowReply(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
}) {
  const history = input.history ?? []
  const body = input.body.trim()
  const whatsappPhone = input.phone?.trim()
  const state = computeDocumentFlowState(history)
  const channelFromBody = parseDocumentPurchaseChannel(body)
  const channel = channelFromBody ?? state.channel
  const phoneFromBody = extractPhoneFromText(body)
  const phoneConfirmYes = isPurePhoneLookupConfirmYes(body)
  const recoveryPrefix = buildDocumentRecoveryPrefix({
    history,
    body,
    channelFromBody,
    phoneConfirmYes,
    phoneFromBody,
  })

  if (isAlternateDocumentPhonePending(history)) {
    const typed = userProvidedPhone(body)
    if (typed && channel) {
      return withRecoveryPrefix(
        recoveryPrefix,
        await deliverDocumentsForPhone(typed, channel)
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
    Boolean(channel) &&
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
        await deliverDocumentsForPhone(typed, channel!)
      )
    }

    if (phoneConfirmYes) {
      const confirmedPhone = resolveDocumentLookupPhone(body, history, whatsappPhone)
      if (!confirmedPhone) return buildPhoneLookupDeclinedReply()
      return withRecoveryPrefix(
        recoveryPrefix,
        await deliverDocumentsForPhone(confirmedPhone, channel!)
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

  if (!channel) {
    if (isDocumentPurchaseLocationQuestionPending(history)) {
      if (body && !isBranchFulfillmentUncertainty(body)) {
        return withRecoveryPrefix(
          recoveryPrefix,
          buildDocumentPurchaseLocationClarify()
        )
      }
      return withRecoveryPrefix(recoveryPrefix, buildDocumentPurchaseLocationQuestion())
    }

    if (
      isDocumentChannelQuestionPending(history) ||
      isLegacyDocumentTypeQuestionPending(history) ||
      state.channelQuestionSent
    ) {
      if (body && isBranchFulfillmentUncertainty(body)) {
        return withRecoveryPrefix(recoveryPrefix, buildDocumentPurchaseLocationQuestion())
      }

      if (body && !phoneConfirmYes && !isShortAmbiguousAnswer(body)) {
        return withRecoveryPrefix(recoveryPrefix, buildDocumentChannelClarify())
      }
      return withRecoveryPrefix(recoveryPrefix, buildDocumentChannelQuestion())
    }

    if (isDigitalDocumentRequest(body) || isDocumentTypeSelection(body)) {
      return buildDocumentChannelQuestion()
    }

    return buildDocumentChannelQuestion()
  }

  if (phoneFromBody) {
    const typed = userProvidedPhone(body)
    if (!typed) return buildPhoneLookupDeclinedReply()
    return withRecoveryPrefix(
      recoveryPrefix,
      await deliverDocumentsForPhone(typed, channel)
    )
  }

  if (whatsappPhone) {
    return buildPhoneLookupConfirmPrompt(whatsappPhone)
  }

  return buildPhoneLookupDeclinedReply()
}
