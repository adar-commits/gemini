/** Shared phone/SKU normalization for Priority/n8n API payloads. */

/** Example מק״ט shown to customers (matches site format: 8 digits, hyphen, 6 digits). */
export const INVENTORY_SKU_EXAMPLE = "31503138-200290"
export const INVENTORY_SKU_EXAMPLE_HINT = `(לדוגמה: ${INVENTORY_SKU_EXAMPLE})`

export function normalizePhoneForOrderApi(phone: string) {
  let digits = phone.replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith("972")) digits = `0${digits.slice(3)}`
  if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`
  return digits
}

export function isValidIsraeliMobilePhone(phone: string) {
  const digits = normalizePhoneForOrderApi(phone)
  return /^0\d{9}$/.test(digits)
}

export function normalizedIsraeliMobilePhone(phone: string) {
  const digits = normalizePhoneForOrderApi(phone)
  return isValidIsraeliMobilePhone(digits) ? digits : null
}

function isPhoneLikeToken(token: string) {
  const digits = token.replace(/\D/g, "")
  if (/^0\d{9}$/.test(digits)) return true
  if (/^972\d{8,9}$/.test(digits)) return true
  return false
}

export function isValidInventorySku(value: string) {
  const token = value.trim()
  if (!token.includes("-")) return false
  if (isPhoneLikeToken(token)) return false
  if (/^\d{8}-\d{6}$/.test(token)) return true
  const parts = token.split("-")
  if (parts.length < 2) return false
  if (!parts.every((part) => /\d/.test(part))) return false
  return /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/.test(token)
}

/** Letter placeholders (ABC-12345) → real site-format מק״ט example for customer copy. */
const FAKE_SKU_PLACEHOLDER_RE = /\b[A-Za-z]{2,}[A-Za-z0-9]*-\d+\b/g

export function normalizeSkuExamplesInReply(text: string) {
  if (!/מק(?:״|"|')?ט|מלאi|SKU|המספר עם המקף/i.test(text)) return text

  let out = text.replace(FAKE_SKU_PLACEHOLDER_RE, INVENTORY_SKU_EXAMPLE)
  out = out.replace(/\(המספר עם המקף,\s*למשל[^)]+\)/gi, INVENTORY_SKU_EXAMPLE_HINT)
  return out
}

export function validatePriorityApiPayload(input: {
  actionType: string
  value: string
}) {
  const raw = input.value.trim()

  if (input.actionType === "getCampaigns") {
    return { ok: true as const, value: raw || "all" }
  }

  if (!raw) return { ok: false as const, reason: "empty" as const }

  if (input.actionType === "getOrders" || input.actionType === "getDocument") {
    const phone = normalizedIsraeliMobilePhone(raw)
    if (!phone) return { ok: false as const, reason: "invalid_phone" as const }
    return { ok: true as const, value: phone }
  }

  if (input.actionType === "getInventoryBranch") {
    if (!isValidInventorySku(raw)) {
      return { ok: false as const, reason: "invalid_sku" as const }
    }
    return { ok: true as const, value: raw }
  }

  return { ok: true as const, value: raw }
}
