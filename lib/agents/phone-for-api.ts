/** Shared phone/SKU normalization for Priority/n8n API payloads. */

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
  return /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/.test(token)
}

export function validatePriorityApiPayload(input: {
  actionType: string
  value: string
}) {
  const raw = input.value.trim()
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
