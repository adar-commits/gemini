import { CUSTOMER_HEADER } from "@/lib/agents/types"
import type { HistoryMessage } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import { isProductDefectComplaint } from "@/lib/agents/inquiry-intent"
import { isServiceTopicSwitch } from "@/lib/agents/topic-switch"
import { callPriorityWebhook } from "@/lib/agents/priority-webhook"

const STORE_RE =
  /סניפ|סניף|חנויות|רשת(?:\s+הסניפ|\s+הסניף)?|stores?|branches/i

const STOCK_RE =
  /במלאי|מלאי|זמין(?:\s+ב)?(?:מלאי|חנות|סניפ|סניף)?|in\s+stock|תבדוק(?:ו)?\s+(?:מלאי|זמינות)|בדיקת\s+(?:מלאי|זמינות)/i

const HAVE_PRODUCT_RE =
  /יש\s+(?:ל(?:כם|נו)|אצל(?:כם|נו)|את(?:\s+זה|\s+הדגם)?)|האם\s+יש/i

const SKU_REQUEST_RE =
  /מק(?:״|"|')?ט|מספר הדגם|כולל מקף/i

const DATE_SKU_RE = /^\d{4}-\d{2}-\d{2}$/

export type WarehouseInventory = {
  warehouse: string
  warehouse_id: string
  quantity: number
}

export type InventoryBranchRow = {
  sku: string
  warehouses_inventory: WarehouseInventory[]
}

function isPhoneLikeSkuToken(token: string) {
  const digits = token.replace(/\D/g, "")
  if (/^0\d{9}$/.test(digits)) return true
  if (/^972\d{8,9}$/.test(digits)) return true
  return false
}

/** SKU always contains a hyphen (e.g. 31501090-200290). Not a phone or date. */
export function extractSku(text: string): string | null {
  const tokens = text.match(/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/g) ?? []
  for (const token of tokens) {
    if (DATE_SKU_RE.test(token)) continue
    if (isPhoneLikeSkuToken(token)) continue
    return token
  }
  return null
}

export function isBareSkuMessage(body: string) {
  const sku = extractSku(body)
  if (!sku) return false
  const rest = body
    .replace(sku, "")
    .replace(/מק(?:״|"|')?ט|sku|דגם/gi, "")
    .replace(/[\s,.:;?!״"'()\-]+/g, "")
  return rest.length === 0
}

function extractRecentSku(body: string, history: HistoryMessage[] = []) {
  const fromBody = extractSku(body)
  if (fromBody) return fromBody

  let userSeen = 0
  for (let index = history.length - 1; index >= 0 && userSeen < 4; index -= 1) {
    const message = history[index]
    if (message.role !== "user") continue
    userSeen += 1
    const sku = extractSku(message.content)
    if (sku) return sku
  }
  return null
}

/** Customer wants store/branch stock — not a general catalog/price handoff. */
export function isBranchInventoryQuestion(body: string) {
  const text = body.trim()
  if (!text) return false
  if (isServiceTopicSwitch(text) || isProductDefectComplaint(text)) return false

  const sku = extractSku(text)
  const mentionsStore = STORE_RE.test(text)
  const mentionsStock = STOCK_RE.test(text)
  const asksIfHave = HAVE_PRODUCT_RE.test(text)
  const whichStoreHas =
    /באיזה\s+סניף\s+יש|יש\s+את(?:\s+זה)?\s+בסניפ|זמין\s+בסניפ|זמין\s+בסניף/i.test(text)

  if (sku && (mentionsStock || mentionsStore || asksIfHave || whichStoreHas)) {
    return true
  }
  if (mentionsStore && (mentionsStock || whichStoreHas)) {
    return true
  }
  if (mentionsStore && /יש\s+את(?:\s+זה|\s+הדגם)?/.test(text)) {
    return true
  }
  return false
}

export function isSkuRequestPending(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return SKU_REQUEST_RE.test(message.content)
  }
  return false
}

export function shouldHandleBranchInventory(
  body: string,
  history: HistoryMessage[] = []
) {
  if (isSkuRequestPending(history)) return true
  if (isBranchInventoryQuestion(body)) return true
  if (isBareSkuMessage(body)) return true
  return false
}

export function isInventoryAvailabilityReply(reply: string) {
  return (
    /בדקתי זמינות/.test(reply) &&
    (/\*יש במלאי\*/.test(reply) ||
      /\*אין במלאי כרגע\*/.test(reply) ||
      /אין במלאי באף/.test(reply))
  )
}

function parseInventoryPayload(data: unknown): InventoryBranchRow | null {
  const rows = Array.isArray(data)
    ? data
    : data &&
        typeof data === "object" &&
        Array.isArray((data as { result?: unknown }).result)
      ? (data as { result: unknown[] }).result
      : []

  for (const row of rows) {
    if (typeof row !== "object" || row == null) continue
    const sku = String((row as InventoryBranchRow).sku ?? "").trim()
    const warehouses = (row as InventoryBranchRow).warehouses_inventory
    if (!sku || !Array.isArray(warehouses)) continue
    return {
      sku,
      warehouses_inventory: warehouses.filter(
        (item): item is WarehouseInventory =>
          typeof item === "object" &&
          item != null &&
          typeof item.warehouse === "string"
      ),
    }
  }

  return null
}

export async function lookupInventoryBySku(
  sku: string
): Promise<InventoryBranchRow | null | undefined> {
  const value = sku.trim()
  if (!value) return undefined

  const data = await callPriorityWebhook({
    actionType: "getInventoryBranch",
    value,
  })
  if (data == null) return undefined

  return parseInventoryPayload(data)
}

function formatLocationName(name: string) {
  return name.replace(/\\"/g, '"').trim()
}

export function buildSkuRequestPrompt() {
  return `${CUSTOMER_HEADER}
כדי לבדוק זמינות בסניפים אצטרך את המק״ט של המוצר (מספר הדגם, כולל מקף).`
}

export function buildInventoryLookupFailureReply() {
  return `${CUSTOMER_HEADER}
לא הצלחנו לבדוק את המלאי כרגע (ייתכן שהמערכת לא הגיבה תוך 15 שניות).
האם להעביר ליועץ מכירות שיבדוק עבורך?`
}

export function buildInventoryNotFoundReply(sku: string) {
  return `${CUSTOMER_HEADER}
לא מצאתי את הדגם ${sku} במערכת.
אפשר לשלוח שוב את המק״ט, או להעביר ליועץ מכירות שיבדוק עבורך?`
}

export function buildSkuMissingHandoffReply() {
  return `${CUSTOMER_HEADER}
בלי מק״ט לא אוכל לבדוק מלאי בסניפים.
אפשר לשלוח את המק״ט, או להעביר ליועץ מכירות שיבדוק עבורך?`
}

export function buildInventoryAvailabilityReply(row: InventoryBranchRow) {
  const available: string[] = []
  const unavailable: string[] = []

  for (const location of row.warehouses_inventory) {
    const name = formatLocationName(location.warehouse)
    if (!name) continue
    if (Number(location.quantity) > 0) available.push(name)
    else unavailable.push(name)
  }

  if (available.length === 0 && unavailable.length === 0) {
    return buildInventoryNotFoundReply(row.sku)
  }

  const lines = [`בדקתי זמינות לדגם ${row.sku}:`]

  if (available.length === 0) {
    lines.push("כרגע אין במלאי באף אחד מהסניפים שבדקתי.")
  } else {
    lines.push("", "*יש במלאי:*", ...available.map((name) => `• ${name}`))
    if (unavailable.length > 0) {
      lines.push("", "*אין במלאי כרגע:*", ...unavailable.map((name) => `• ${name}`))
    }
  }

  lines.push("", "אם צריך עוד משהו — כאן.")
  return `${CUSTOMER_HEADER}\n${lines.join("\n")}`
}

async function replyForSku(sku: string) {
  try {
    const result = await lookupInventoryBySku(sku)
    if (result === undefined) return buildInventoryLookupFailureReply()
    if (result == null) return buildInventoryNotFoundReply(sku)
    return buildInventoryAvailabilityReply(result)
  } catch {
    return buildInventoryLookupFailureReply()
  }
}

export async function resolveBranchInventoryReply(input: {
  body: string
  history?: HistoryMessage[]
}) {
  const history = input.history ?? []
  const body = input.body.trim()
  const sku = extractRecentSku(body, history)

  if (isSkuRequestPending(history)) {
    if (sku) return replyForSku(sku)
    if (/אין(?:\s+לי)?|לא\s+יודע|לא\s+יש/i.test(body)) {
      return buildSkuMissingHandoffReply()
    }
    return buildSkuRequestPrompt()
  }

  if (sku) return replyForSku(sku)
  return buildSkuRequestPrompt()
}
