const DEFAULT_TRAINER_PHONE = "+972547495083"

function phoneKey(phone: string) {
  let value = phone.replace(/\D/g, "")
  if (value.startsWith("00")) value = value.slice(2)
  if (value.startsWith("0") && value.length >= 9) value = `972${value.slice(1)}`
  if (value.length === 9 && value.startsWith("5")) value = `972${value}`
  return value
}

/** Comma/space-separated list — only these phones run AI and get WhatsApp replies. Use `*` for all customers. */
export function trainerPhones() {
  const raw = process.env.LANDBOT_TRAINER_PHONES?.trim()
  if (raw) {
    return raw
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return [DEFAULT_TRAINER_PHONE]
}

export function allowAllCustomerPhones() {
  return trainerPhones().some((item) => item === "*")
}

export function trainerPhone() {
  const phones = trainerPhones().filter((item) => item !== "*")
  return phones[0] ?? DEFAULT_TRAINER_PHONE
}

/** Numbers allowed to run trainer commands (איפוס, שאלה:, לתיקון:) — not the same as allow-all. */
export function explicitTrainerPhones() {
  const listed = trainerPhones().filter((item) => item !== "*")
  if (listed.length > 0) return listed
  if (allowAllCustomerPhones()) return [DEFAULT_TRAINER_PHONE]
  return trainerPhones()
}

export function isTrainerPhone(phone: string | null | undefined) {
  if (!phone?.trim()) return false
  const key = phoneKey(phone)
  return explicitTrainerPhones().some((item) => phoneKey(item) === key)
}

export function isCustomerPhoneAllowed(phone: string | null | undefined) {
  if (!phone?.trim()) return false
  if (allowAllCustomerPhones()) return true
  return isTrainerPhone(phone)
}
