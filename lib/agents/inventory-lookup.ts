import { buildApiFailureReply } from "@/lib/agent-core/fallbacks"
import { CUSTOMER_HEADER, CUSTOMER_NATURAL_CLOSE } from "@/lib/agents/types"
import type { HistoryMessage } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import { isProductDefectComplaint } from "@/lib/agents/inquiry-intent"
import { isServiceTopicSwitch } from "@/lib/agents/topic-switch"
import { isValidInventorySku } from "@/lib/agents/phone-for-api"
import { callPriorityWebhook } from "@/lib/agents/priority-webhook"
import {
  extractBranchCityFromInventoryQuery,
  normalizeBranchCityHint,
} from "@/lib/agents/branches"

const STORE_RE =
  /סניפ|סניף|חנויות|רשת(?:\s+הסניפ|\s+הסניף)?|stores?|branches/i

const STOCK_RE =
  /במלאי|מלאי|זמינות|זמין(?:\s+ב)?(?:מלאי|חנות|סניפ|סניף)?|in\s+stock|(?:ת)?(?:וכל|בדוק)(?:\s+לי|\s+ל)?(?:\s+את)?\s*(?:ה)?מלאי|(?:ת)?בדוק(?:\s+לי|\s+ל)?\s*(?:את\s+)?(?:ה)?מלאי|בדיק(?:ת|ה)\s+(?:מלאי|זמינות)/i

const HAVE_PRODUCT_RE =
  /יש\s+(?:ל(?:כם|נו)|אצל(?:כם|נו)|את(?:\s+זה|\s+הדגם)?)|האם\s+יש/i

const SKU_REQUEST_RE =
  /מק(?:״|"|')?ט|מספר הדגם|כולל מקף/i

const RESTOCK_RE =
  /(?:חוזר(?:ים)?|יחז(?:ור|רו)|חזר(?:ה|ו))\s+(?:ל)?(?:מלאי|זמינות)|מתי\s+(?:יחזור|חוזר).*?(?:מלאי|זמינות)|תחז(?:ית|יות).*?(?:מלאי|זמינות)/i

const HOM_SKU_RE = /\b(\d{8}-\d{6})\b/

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

/** SKU always contains a hyphen (e.g. 40400025-200290). Prefer Hom 8-6 digit format. */
export function extractSku(text: string): string | null {
  const homMatch = text.match(HOM_SKU_RE)
  if (homMatch?.[1] && isValidInventorySku(homMatch[1])) return homMatch[1]

  const tokens = text.match(/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/g) ?? []
  for (const token of tokens) {
    if (DATE_SKU_RE.test(token)) continue
    if (isPhoneLikeSkuToken(token)) continue
    if (!isValidInventorySku(token)) continue
    return token
  }
  return null
}

export function looksLikeInventorySku(text: string) {
  return extractSku(text) != null
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
  if (
    mentionsStock &&
    /(?:ב(?:ל)?דוק|(?:י)?(?:וכל|בדוק))\s+(?:לי\s+)?(?:את\s+)?(?:ה)?מלאי|מלאי\s+של/i.test(text)
  ) {
    return true
  }
  return false
}

/** Any stock / availability / restock ask — ask for SKU first (not a product URL). */
export function isInventoryQuestion(body: string) {
  const text = body.trim()
  if (!text) return false
  if (isServiceTopicSwitch(text) || isProductDefectComplaint(text)) return false
  if (isBareSkuMessage(text)) return true
  if (isBranchInventoryQuestion(text)) return true
  return STOCK_RE.test(text) || RESTOCK_RE.test(text)
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
  if (isInventoryQuestion(body)) return true
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
  if (!value || !isValidInventorySku(value)) {
    console.warn("[inventory-lookup] blocked getInventoryBranch — invalid SKU", { sku })
    return undefined
  }

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

export function buildSkuRequestPrompt(context?: {
  branch?: string | null
  product?: string | null
}) {
  const branch = context?.branch ? normalizeBranchCityHint(context.branch) : null
  const product = context?.product?.trim()

  if (branch && product) {
    return `${CUSTOMER_HEADER}
כדי לבדוק מלאי של ${product} בסניף ${branch}, אצטרך את המק״ט של המוצר (מספר הדגם, כולל מקף).`
  }
  if (branch) {
    return `${CUSTOMER_HEADER}
כדי לבדוק מלאי בסניף ${branch}, אצטרך את המק״ט של המוצר (מספר הדגם, כולל מקף).`
  }
  if (product) {
    return `${CUSTOMER_HEADER}
כדי לבדוק מלאי של ${product} בסניפים, אצטרך את המק״ט (מספר הדגם, כולל מקף).`
  }

  return `${CUSTOMER_HEADER}
כדי לבדוק מלאי וזמינות, אצטרך את המק״ט של המוצר (מספר הדגם, כולל מקף).`
}

export function buildInventoryLookupFailureReply() {
  return buildApiFailureReply("sales")
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

function warehouseMatchesBranch(warehouseName: string, branchHint: string) {
  const name = formatLocationName(warehouseName)
  const city = normalizeBranchCityHint(branchHint)
  if (!name || !city) return false
  return name.includes(city) || city.includes(name)
}

function extractProductHintFromInventoryQuery(text: string) {
  const match =
    text.match(/(?:של|ע(?:ל|בור))\s+([א-תa-zA-Z0-9\s\-]{2,40}?)(?:\?|[\s,.]|$)/i) ||
    text.match(/(?:ל)?דגם\s+([א-תa-zA-Z0-9\s\-]{2,40}?)(?:\?|[\s,.]|$)/i)
  const product = match?.[1]?.trim()
  if (!product) return null
  if (/^(?:סניף|מלאי|המוצר|השטיח)$/i.test(product)) return null
  return product
}

export function buildInventoryAvailabilityReply(
  row: InventoryBranchRow,
  branchFilter?: string | null
) {
  const available: string[] = []
  const unavailable: string[] = []

  for (const location of row.warehouses_inventory) {
    const name = formatLocationName(location.warehouse)
    if (!name) continue
    if (branchFilter && !warehouseMatchesBranch(name, branchFilter)) continue
    if (Number(location.quantity) > 0) available.push(name)
    else unavailable.push(name)
  }

  const branchLabel = branchFilter ? normalizeBranchCityHint(branchFilter) : null

  if (branchFilter && available.length === 0 && unavailable.length === 0) {
    return `${CUSTOMER_HEADER}
בדקתי את הדגם ${row.sku} — לא מצאתי סניף ${branchLabel} ברשימת המלאי.
אפשר לשלוח שוב את המק״ט, או להעביר ליועץ מכירות שיבדוק עבורך?`
  }

  if (available.length === 0 && unavailable.length === 0) {
    return `${CUSTOMER_HEADER}
בדקתי את הדגם ${row.sku} — כרגע אין במלאי בסניפים.
אפשר להעביר ליועץ מכירות שיבדוק עבורך?`
  }

  const lines = [
    branchLabel
      ? `בדקתי זמינות לדגם ${row.sku} בסניף ${branchLabel}:`
      : `בדקתי זמינות לדגם ${row.sku}:`,
  ]

  if (available.length === 0) {
    lines.push(
      branchLabel
        ? `כרגע אין במלאי בסניף ${branchLabel}.`
        : "כרגע אין במלאי באף אחד מהסניפים שבדקתי."
    )
  } else {
    lines.push("", "*יש במלאי:*", ...available.map((name) => `• ${name}`))
    if (unavailable.length > 0) {
      lines.push("", "*אין במלאי כרגע:*", ...unavailable.map((name) => `• ${name}`))
    }
  }

  lines.push("", CUSTOMER_NATURAL_CLOSE)
  return `${CUSTOMER_HEADER}\n${lines.join("\n")}`
}

async function replyForSku(sku: string, branchFilter?: string | null) {
  try {
    const result = await lookupInventoryBySku(sku)
    if (result === undefined) return buildInventoryLookupFailureReply()
    if (result == null) return buildInventoryNotFoundReply(sku)
    return buildInventoryAvailabilityReply(result, branchFilter)
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
  const branch = extractBranchCityFromInventoryQuery(body)
  const product = extractProductHintFromInventoryQuery(body)
  const skuContext = { branch, product }

  if (isSkuRequestPending(history)) {
    if (sku) return replyForSku(sku, branch)
    if (/אין(?:\s+לי)?|לא\s+יודע|לא\s+יש/i.test(body)) {
      return buildSkuMissingHandoffReply()
    }
    return buildSkuRequestPrompt(skuContext)
  }

  if (sku) return replyForSku(sku, branch)
  return buildSkuRequestPrompt(skuContext)
}
