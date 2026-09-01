import { buildApiFailureReply } from "@/lib/agent-core/fallbacks"
import { CUSTOMER_HEADER, CUSTOMER_NATURAL_CLOSE } from "@/lib/agents/types"
import type { HistoryMessage } from "@/lib/agents/types"
import { isInactivityAssistantMessage } from "@/lib/agents/inactivity"
import { isProductDefectComplaint } from "@/lib/agents/inquiry-intent"
import { isServiceTopicSwitch } from "@/lib/agents/topic-switch"
import { isValidInventorySku, INVENTORY_SKU_EXAMPLE_HINT } from "@/lib/agents/phone-for-api"
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

export type InventoryLocation = {
  branch_id: string
  quantity: number
  /** Legacy API rows only — prefer branch_id mapping when absent. */
  displayName?: string
}

export type PreorderInfo = {
  po_qty: number
  open_order_qty: number
  current_qty: number
  safe_qty: number
  req_date: string
}

export type InventoryBranchRow = {
  sku: string
  product_title?: string
  preorder: PreorderInfo | null
  inventory: InventoryLocation[]
}

/** Priority warehouse_id → customer-facing store name (getInventoryBranch). */
const INVENTORY_BRANCH_LABELS: Record<string, string> = {
  WMS: "מרלוג איירפורט סיטי",
  "3000": "אתר",
  "20": "איירפורט סיטי",
  "30": "קריית אתא",
  "40": "ראשון לציון",
  "60": "נתניה",
  "90": "בני ברק",
}

const WAREHOUSE_BRANCH_IDS = new Set(["WMS"])
const BACKOFFICE_WAREHOUSE_IDS = new Set(["120", "140"])

function resolveInventoryBranchLabel(branchId: string) {
  const key = branchId.trim()
  const mapped = INVENTORY_BRANCH_LABELS[key] ?? INVENTORY_BRANCH_LABELS[key.toUpperCase()]
  return mapped ?? key
}

function isRetailBranch(branchId: string) {
  return !WAREHOUSE_BRANCH_IDS.has(branchId.trim().toUpperCase())
}

/** Showroom branches only — exclude central warehouses (מחסן / מרלוג). */
function isCustomerStoreBranch(location: InventoryLocation) {
  const id = location.branch_id.trim()
  if (BACKOFFICE_WAREHOUSE_IDS.has(id)) return false
  if (!isRetailBranch(id)) return false
  const name = locationDisplayName(location)
  if (/מחסן|מרלוג/i.test(name)) return false
  return true
}

function parsePreorder(value: unknown): PreorderInfo | null {
  if (typeof value !== "object" || value == null) return null
  const row = value as Record<string, unknown>
  return {
    po_qty: Number(row.po_qty ?? 0),
    open_order_qty: Number(row.open_order_qty ?? 0),
    current_qty: Number(row.current_qty ?? 0),
    safe_qty: Number(row.safe_qty ?? 0),
    req_date: String(row.req_date ?? "").trim(),
  }
}

function parseInventoryLocations(value: unknown): InventoryLocation[] {
  if (!Array.isArray(value)) return []
  const locations: InventoryLocation[] = []
  for (const item of value) {
    if (typeof item !== "object" || item == null) continue
    const row = item as Record<string, unknown>
    const branchId = String(row.branch_id ?? row.warehouse_id ?? "").trim()
    if (!branchId) continue
    locations.push({
      branch_id: branchId,
      quantity: Number(row.quantity ?? 0),
      displayName:
        typeof row.warehouse === "string" ? row.warehouse.trim() : undefined,
    })
  }
  return locations
}

export function isPreorderSku(row: InventoryBranchRow) {
  return row.preorder != null
}

function isPhoneLikeSkuToken(token: string) {
  const digits = token.replace(/\D/g, "")
  if (/^0\d{9}$/.test(digits)) return true
  if (/^972\d{8,9}$/.test(digits)) return true
  return false
}

const PRODUCT_URL_STRIP_RE =
  /https?:\/\/(?:www\.)?(?:carpetshop|pozitiveshop)\.co\.il\/products\/[^\s]+/gi

function hasProductUrlInText(text: string) {
  return PRODUCT_URL_STRIP_RE.test(text)
}

function textWithoutProductUrls(text: string) {
  return text.replace(PRODUCT_URL_STRIP_RE, " ").trim()
}

/** SKU always contains a hyphen (e.g. 40400025-200290). Prefer Hom 8-6 digit format. */
export function extractSku(text: string): string | null {
  const scoped = textWithoutProductUrls(text)
  const homMatch = scoped.match(HOM_SKU_RE)
  if (homMatch?.[1] && isValidInventorySku(homMatch[1])) return homMatch[1]

  const tokens = scoped.match(/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/g) ?? []
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

const BRANCH_HAS_RE =
  /באיזה\s+סניף(?:\s+\S+){0,4}?\s+יש|יש\s+א(?:ת|ותו)(?:\s+זה|\s+הדגם)?\s+בסניפ|זמין\s+בסניפ|זמין\s+בסניף|יש\s+א(?:ותו|ת)\s+ל(?:תצוגה|ראות)/i

const DISPLAY_AT_BRANCH_RE = /ל(?:תצוגה|ראות|מגע|הרגיש)|בתצוגה/i

/** Last N user messages including the current turn — for routing, not debounce merge. */
export function recentUserTexts(
  body: string,
  history: HistoryMessage[] = [],
  limit = 5
) {
  return [
    body,
    ...history
      .filter((message) => message.role === "user")
      .slice(-limit)
      .map((message) => message.content),
  ]
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
  const whichStoreHas = BRANCH_HAS_RE.test(text)
  const displayAtBranch = mentionsStore && DISPLAY_AT_BRANCH_RE.test(text)

  if (sku && (mentionsStock || mentionsStore || asksIfHave || whichStoreHas || displayAtBranch)) {
    return true
  }
  if (mentionsStore && (mentionsStock || whichStoreHas || displayAtBranch)) {
    return true
  }
  if (mentionsStore && /יש\s+א(?:ת|ותו)(?:\s+זה|\s+הדגם)?/.test(text)) {
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

/** Inventory intent using recent user turns — avoids treating follow-ups in isolation. */
export function isInventoryQuestionWithContext(
  body: string,
  history: HistoryMessage[] = [],
  extraContext: string[] = []
) {
  const texts = [...extraContext, ...recentUserTexts(body, history, 5)]
  if (texts.some((text) => isInventoryQuestion(text))) return true
  if (!isSkuRequestPending(history) && !isActiveInventoryThread(history)) return false

  const text = body.trim()
  if (!text) return false
  if (hasProductUrlInText(text)) return true
  if (/סניף|תצוגה|לתצוגה|אותו|בצפון|במרכז|בדרום|במרכז/i.test(text)) return true
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

/** Recent branch stock lookup — follow-up SKUs should reuse inventory flow, not FAQ/sales LLM. */
export function isActiveInventoryThread(history: HistoryMessage[] = []) {
  const recent = history.slice(-10)
  return recent.some(
    (message) =>
      message.role === "assistant" &&
      !isInactivityAssistantMessage(message.content) &&
      (isInventoryAvailabilityReply(message.content) ||
        SKU_REQUEST_RE.test(message.content) ||
        /בדקתי(?:\s+את|\s+זמינות)|לא מצאתי את הדגם/i.test(message.content))
  )
}

export function shouldHandleBranchInventory(
  body: string,
  history: HistoryMessage[] = []
) {
  if (isSkuRequestPending(history) || isActiveInventoryThread(history)) return true
  if (hasProductUrlInText(body) && isInventoryQuestionWithContext(body, history)) {
    return true
  }
  if (hasProductUrlInText(body)) return isBareSkuMessage(textWithoutProductUrls(body))
  if (isInventoryQuestion(body)) return true
  if (extractSku(body) && isActiveInventoryThread(history)) return true
  return false
}

export function isInventoryAvailabilityReply(reply: string) {
  return (
    /בדקתי זמינות/.test(reply) &&
    (/\*יש במלאי\*/.test(reply) ||
      /\*לפי המערכת לא מופיע\*/.test(reply) ||
      /לא מופיע מלאי/.test(reply) ||
      /זמין(?:\s+כרגע)?\s+להזמנה מוקדמת/.test(reply))
  )
}

function buildInventoryUnconfirmedReply(label: string, branchLabel?: string | null) {
  const where = branchLabel ? `בסניף ${branchLabel}` : "בסניפים"
  return `${CUSTOMER_HEADER}
בדקתי זמינות לדגם ${label} ${where}.
לפי הנתונים במערכת לא מופיע מלאי כרגע — ייתכנו פערים מול מצב הרצפה בסניף.
האם להעביר ליועץ מכירות שיבדוק ויאמת?`
}

export function parseInventoryBranchPayload(data: unknown): InventoryBranchRow | null {
  const rows = Array.isArray(data)
    ? data
    : data &&
        typeof data === "object" &&
        Array.isArray((data as { result?: unknown }).result)
      ? (data as { result: unknown[] }).result
      : []

  for (const row of rows) {
    if (typeof row !== "object" || row == null) continue
    const payload = row as Record<string, unknown>
    if (payload.ok === false) continue

    const sku = String(payload.sku ?? "").trim()
    if (!sku) continue

    const product =
      typeof payload.product === "object" && payload.product != null
        ? (payload.product as Record<string, unknown>)
        : null
    const productTitle = String(product?.product_title ?? "").trim() || undefined

    if (Array.isArray(payload.inventory)) {
      return {
        sku,
        product_title: productTitle,
        preorder: parsePreorder(payload.preorder),
        inventory: parseInventoryLocations(payload.inventory),
      }
    }

    if (Array.isArray(payload.warehouses_inventory)) {
      return {
        sku,
        product_title: productTitle,
        preorder: parsePreorder(payload.preorder),
        inventory: parseInventoryLocations(payload.warehouses_inventory),
      }
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

  return parseInventoryBranchPayload(data)
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
כדי לבדוק מלאי של ${product} בסניף ${branch}, אצטרך את המק״ט של המוצר ${INVENTORY_SKU_EXAMPLE_HINT}.`
  }
  if (branch) {
    return `${CUSTOMER_HEADER}
כדי לבדוק מלאי בסניף ${branch}, אצטרך את המק״ט של המוצר ${INVENTORY_SKU_EXAMPLE_HINT}.`
  }
  if (product) {
    return `${CUSTOMER_HEADER}
כדי לבדוק מלאי של ${product} בסניפים, אצטרך את המק״ט ${INVENTORY_SKU_EXAMPLE_HINT}.`
  }

  return `${CUSTOMER_HEADER}
כדי לבדוק מלאי וזמינות, אצטרך את מספר המק״ט של המוצר ${INVENTORY_SKU_EXAMPLE_HINT} – הוא מופיע בדרך כלל בעמוד המוצר באתר.`
}

export function buildInventoryLookupFailureReply() {
  return buildApiFailureReply("sales")
}

export function buildInventoryNotFoundReply(sku: string) {
  return `${CUSTOMER_HEADER}
לא מצאתי את הדגם ${sku} במערכת.
אפשר לשלוח שוב את המק״ט, או להעביר ליועץ מכירות שיבדוק עבורכם?`
}

export function buildSkuMissingHandoffReply() {
  return `${CUSTOMER_HEADER}
בלי מק״ט לא אוכל לבדוק מלאי בסניפים.
אפשר לשלוח את המק״ט, או להעביר ליועץ מכירות שיבדוק עבורכם?`
}

function locationMatchesBranch(locationName: string, branchHint: string) {
  const name = formatLocationName(locationName)
  const city = normalizeBranchCityHint(branchHint)
  if (!name || !city) return false
  return name.includes(city) || city.includes(name)
}

function locationDisplayName(location: InventoryLocation) {
  if (location.displayName) return formatLocationName(location.displayName)
  return resolveInventoryBranchLabel(location.branch_id)
}

function skuLabel(row: InventoryBranchRow) {
  return row.product_title ? `${row.sku} (${row.product_title})` : row.sku
}

function extractProductSlugFromUrl(text: string) {
  const match = text.match(/\/products\/([a-z0-9-]+)/i)
  if (!match?.[1]) return null
  return match[1].replace(/-/g, " ")
}

function extractProductHintFromInventoryQuery(text: string) {
  const fromUrl = extractProductSlugFromUrl(text)
  if (fromUrl) return fromUrl

  const match =
    text.match(/(?:של|ע(?:ל|בור))\s+([א-תa-zA-Z0-9\s\-]{2,40}?)(?:\?|[\s,.]|$)/i) ||
    text.match(/(?:ל)?דגם\s+([א-תa-zA-Z0-9\s\-]{2,40}?)(?:\?|[\s,.]|$)/i) ||
    text.match(/(?:שטיח|פוף|דגם)\s+([א-תa-zA-Z0-9\s\-]{2,40}?)(?:\?|[\s,.]|$)/i)
  const product = match?.[1]?.trim()
  if (!product) return null
  if (/^(?:סניף|מלאי|המוצר|השטיח)$/i.test(product)) return null
  return product
}

export function buildProductUrlSkuPrompt(productHint?: string | null) {
  const product = productHint?.trim()
  if (product) {
    return `${CUSTOMER_HEADER}
קיבלתי את הקישור, תודה.
כדי לבדוק מלאי וזמינות של ${product}, אצטרך את המק״ט מדף המוצר ${INVENTORY_SKU_EXAMPLE_HINT}.`
  }
  return `${CUSTOMER_HEADER}
קיבלתי את הקישור, תודה.
כדי לבדוק מלאי וזמינות, אצטרך את המק״ט מדף המוצר ${INVENTORY_SKU_EXAMPLE_HINT}.`
}

export function buildInventoryAvailabilityReply(
  row: InventoryBranchRow,
  branchFilter?: string | null
) {
  const branchLabel = branchFilter ? normalizeBranchCityHint(branchFilter) : null
  const label = skuLabel(row)

  if (isPreorderSku(row)) {
    const lines = [
      branchLabel
        ? `בדקתי זמינות לדגם ${label} בסניף ${branchLabel}:`
        : `בדקתי זמינות לדגם ${label}:`,
      "",
      "הדגם זמין כרגע להזמנה מוקדמת.",
    ]
    const reqDate = row.preorder?.req_date?.trim()
    if (reqDate) {
      lines.push(`צפי הגעה: ${reqDate}`)
    }
    lines.push("", CUSTOMER_NATURAL_CLOSE)
    return `${CUSTOMER_HEADER}\n${lines.join("\n")}`
  }

  const available: string[] = []
  const unavailable: string[] = []

  for (const location of row.inventory) {
    if (!isCustomerStoreBranch(location)) continue
    const name = locationDisplayName(location)
    if (!name) continue
    if (branchFilter && !locationMatchesBranch(name, branchFilter)) continue
    if (Number(location.quantity) > 0) available.push(name)
    else unavailable.push(name)
  }

  if (branchFilter && available.length === 0 && unavailable.length === 0) {
    return `${CUSTOMER_HEADER}
בדקתי את הדגם ${label} — לא מצאתי סניף ${branchLabel} ברשימת המלאי.
אפשר לשלוח שוב את המק״ט, או להעביר ליועץ מכירות שיבדוק עבורכם?`
  }

  if (available.length === 0 && unavailable.length === 0) {
    return buildInventoryUnconfirmedReply(label, branchLabel)
  }

  const lines = [
    branchLabel
      ? `בדקתי זמינות לדגם ${label} בסניף ${branchLabel}:`
      : `בדקתי זמינות לדגם ${label}:`,
  ]

  if (available.length === 0) {
    return buildInventoryUnconfirmedReply(label, branchLabel)
  }

  lines.push("", "*יש במלאי:*", ...available.map((name) => `• ${name}`))
  if (unavailable.length > 0) {
    lines.push(
      "",
      "*לפי המערכת לא מופיע:*",
      ...unavailable.map((name) => `• ${name}`)
    )
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

function inventoryContextFromRecentMessages(
  body: string,
  history: HistoryMessage[] = []
) {
  const contextTexts = recentUserTexts(body, history, 5)
  const combined = contextTexts.join("\n")
  const branch =
    extractBranchCityFromInventoryQuery(body) ??
    extractBranchCityFromInventoryQuery(combined)
  const product =
    contextTexts
      .map((text) => extractProductHintFromInventoryQuery(text))
      .find(Boolean) ?? null
  return { branch, product }
}

export async function resolveBranchInventoryReply(input: {
  body: string
  history?: HistoryMessage[]
}) {
  const history = input.history ?? []
  const body = input.body.trim()
  const sku = extractRecentSku(body, history)
  const { branch, product } = inventoryContextFromRecentMessages(body, history)
  const skuContext = { branch, product }

  if (hasProductUrlInText(body) && !sku) {
    return buildProductUrlSkuPrompt(product)
  }

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
