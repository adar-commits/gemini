import { CUSTOMER_HEADER } from "@/lib/agents/types"
import type { HistoryMessage } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
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
} from "@/lib/agents/order-lookup"

export type DocumentPurchaseChannel = "website" | "store"

export const DOCUMENT_TYPE_RECEIPT = "קבלה"
export const DOCUMENT_TYPE_TAX_INVOICE = "חשבונית מס"
export const DOCUMENT_TYPE_TAX_INVOICE_RECEIPT = "חשבונית מס קבלה"

const CHANNEL_QUESTION_MARKER = /מלאי(?:\s+ה)?סניף|אתר(?:\s+ה)?אינטרנט(?:\s+עם\s+שליח)?/i
const LEGACY_TYPE_QUESTION_MARKER = /איזה\s+סוג\s+מסמך/i

/** Customer wants a digital receipt / invoice copy. */
export function isDigitalDocumentRequest(body: string) {
  const text = body.trim()
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
    )
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

export function isDocumentChannelQuestionPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return CHANNEL_QUESTION_MARKER.test(message.content)
  }
  return false
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
  if (!isActiveDigitalDocumentFlow(history)) return false
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return /האם היא רשומה על המספר|האם ההזמנה (?:היא )?על טלפון/i.test(message.content)
  }
  return false
}

export function isAlternateDocumentPhonePending(history: HistoryMessage[]) {
  if (!isActiveDigitalDocumentFlow(history)) return false
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return /מה מספר הטלפון שבוצעה עליו ההזמנה/i.test(message.content)
  }
  return false
}

/** Deterministic document copy flow — any step after the first ask. */
export function isActiveDigitalDocumentFlow(
  history: HistoryMessage[] = [],
  body = ""
) {
  if (isDigitalDocumentRequest(body)) return true
  if (activeDigitalDocumentRequest(history)) return true
  if (isDocumentChannelQuestionPending(history)) return true
  if (isLegacyDocumentTypeQuestionPending(history)) return true
  if (isDocumentPhoneLookupPending(history)) return true
  if (isAlternateDocumentPhonePending(history)) return true
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
כדי להוציא את המסמך הנכון — האם המוצר נרכש מתוך מלאי הסניף או באמצעות אתר האינטרנט עם שליח?`
}

export function buildDocumentChannelClarify() {
  return `${CUSTOMER_HEADER}
לא הבנתי — האם הרכישה הייתה בסניף או דרך אתר האינטרנט (עם משלוח)?`
}

export function parseDocumentPurchaseChannel(body: string): DocumentPurchaseChannel | null {
  const text = body.trim()
  if (!text) return null

  if (
    /(?:אינטרנט|אתר|משלוח|שליח|online|website|ד(?:רך|״רך)\s+(?:ה)?א(?:תר|ינטרנט))/i.test(
      text
    )
  ) {
    return "website"
  }

  if (/(?:מלאי\s+(?:ה)?סניף|בסניף|מהסניף|בחנות|מהחנות|ברשת|סניף)/i.test(text)) {
    return "store"
  }

  return null
}

function activeDocumentPurchaseChannel(history: HistoryMessage[]): DocumentPurchaseChannel | null {
  let sawChannelQuestion = false
  for (const message of history) {
    if (message.role === "assistant" && CHANNEL_QUESTION_MARKER.test(message.content)) {
      sawChannelQuestion = true
      continue
    }
    if (!sawChannelQuestion || message.role !== "user") continue
    const channel = parseDocumentPurchaseChannel(message.content)
    if (channel) return channel
  }
  return null
}

function mentionsAlternatePhoneIntent(body: string) {
  return /טלפון|מס(?:'|׳|פר)?|אחר|אח(?:י|ות)?|בעל|אשה|של/i.test(body)
}

function buildMultiDocumentReply(links: string[]) {
  if (links.length === 1) return buildDigitalDocumentReply(links[0]!)
  const lines = links.map((link, index) => `${index + 1}. ${link}`)
  return `${CUSTOMER_HEADER}
הנה הקישורים למסמכים הדיגיטליים:
${lines.join("\n")}

אם צריך עוד משהו — כאן.`
}

async function deliverDocumentsForPhone(phone: string, channel: DocumentPurchaseChannel) {
  const result = await lookupDigitalDocumentsForChannel(phone, channel)
  if (result.ok) return buildMultiDocumentReply(result.links)
  if (result.reason === "not_found") return buildDigitalDocumentNotFoundReply()
  return buildDigitalDocumentLookupFailureReply()
}

export async function resolveDigitalDocumentFlowReply(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
}) {
  const history = input.history ?? []
  const body = input.body.trim()
  const whatsappPhone = input.phone?.trim()

  const channelFromBody = parseDocumentPurchaseChannel(body)
  const channelFromHistory = activeDocumentPurchaseChannel(history)
  const channel = channelFromBody ?? channelFromHistory

  if (
    isDocumentChannelQuestionPending(history) ||
    isLegacyDocumentTypeQuestionPending(history)
  ) {
    if (!channel) {
      if (isDocumentTypeSelection(body)) {
        return buildDocumentChannelQuestion()
      }
      return buildDocumentChannelClarify()
    }
  } else if (isDigitalDocumentRequest(body) || isDocumentTypeSelection(body)) {
    if (!channel) return buildDocumentChannelQuestion()
  } else if (!channel) {
    return buildDocumentChannelQuestion()
  }

  const resolvedChannel = channel!
  const lookupPhone = resolveDocumentLookupPhone(body, history, whatsappPhone)

  if (isAlternateDocumentPhonePending(history)) {
    if (lookupPhone) return deliverDocumentsForPhone(lookupPhone, resolvedChannel)
    return `${CUSTOMER_HEADER}
לא זיהיתי מספר טלפון — שלח/i את המספר (למשל 050-1234567).`
  }

  if (isDocumentPhoneLookupPending(history)) {
    if (lookupPhone && !isPurePhoneLookupConfirmYes(body)) {
      return deliverDocumentsForPhone(lookupPhone, resolvedChannel)
    }

    if (isPurePhoneLookupConfirmYes(body)) {
      const confirmedPhone = resolveDocumentLookupPhone(body, history, whatsappPhone)
      if (!confirmedPhone) return buildPhoneLookupDeclinedReply()
      return deliverDocumentsForPhone(confirmedPhone, resolvedChannel)
    }

    if (isOrderConfirmationNo(body) && mentionsAlternatePhoneIntent(body)) {
      return buildAlternatePhoneRequestPrompt()
    }

    if (isOrderConfirmationNo(body)) {
      return buildPhoneLookupDeclinedReply()
    }

    if (whatsappPhone) {
      return `${CUSTOMER_HEADER}
לא הבנתי — האם היא רשומה על המספר ממנו אנחנו מתכתבים כרגע? (${formatDisplayPhone(whatsappPhone)})
אם לא, אשמח לציון המספר הנכון.`
    }

    return buildPhoneLookupDeclinedReply()
  }

  if (lookupPhone && extractPhoneFromText(body)) {
    return deliverDocumentsForPhone(lookupPhone, resolvedChannel)
  }

  if (whatsappPhone) {
    return buildPhoneLookupConfirmPrompt(whatsappPhone)
  }

  return buildPhoneLookupDeclinedReply()
}

function resolveDocumentLookupPhone(
  body: string,
  history: HistoryMessage[],
  whatsappPhone?: string
) {
  return (
    extractPhoneFromText(body) ||
    resolveLookupPhoneFromHistory(history, whatsappPhone) ||
    null
  )
}
