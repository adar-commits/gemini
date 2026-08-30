const DEFAULT_TRAINER_PHONE = "+972547495083"

function phoneKey(phone: string) {
  let value = phone.replace(/\D/g, "")
  if (value.startsWith("00")) value = value.slice(2)
  if (value.startsWith("0") && value.length >= 9) value = `972${value.slice(1)}`
  if (value.length === 9 && value.startsWith("5")) value = `972${value}`
  return value
}

/** Comma/space-separated list — only these phones run AI and get WhatsApp replies. */
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

export function trainerPhone() {
  return trainerPhones()[0]
}

export function isTrainerPhone(phone: string | null | undefined) {
  if (!phone?.trim()) return false
  const key = phoneKey(phone)
  return trainerPhones().some((item) => phoneKey(item) === key)
}
