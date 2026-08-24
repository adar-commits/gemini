const DEFAULT_TRAINER_PHONE = "+972547495083"

function phoneKey(phone: string) {
  let value = phone.replace(/\D/g, "")
  if (value.startsWith("00")) value = value.slice(2)
  if (value.startsWith("0") && value.length >= 9) value = `972${value.slice(1)}`
  if (value.length === 9 && value.startsWith("5")) value = `972${value}`
  return value
}

function trainerPhones() {
  const multi = process.env.LANDBOT_TRAINER_PHONES?.trim()
  if (multi) {
    return multi
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  const single = process.env.LANDBOT_TRAINER_PHONE?.trim()
  if (single) return [single]
  const replyFirst = process.env.LANDBOT_REPLY_PHONES?.trim()?.split(/[,\s]+/)[0]
  if (replyFirst) return [replyFirst.trim()]
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
