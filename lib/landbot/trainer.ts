const DEFAULT_TRAINER_PHONE = "+972547495083"

function phoneKey(phone: string) {
  let value = phone.replace(/\D/g, "")
  if (value.startsWith("00")) value = value.slice(2)
  if (value.startsWith("0") && value.length >= 9) value = `972${value.slice(1)}`
  if (value.length === 9 && value.startsWith("5")) value = `972${value}`
  return value
}

export function trainerPhone() {
  return (
    process.env.LANDBOT_TRAINER_PHONE?.trim() ||
    process.env.LANDBOT_REPLY_PHONES?.trim()?.split(/[,\s]+/)[0] ||
    DEFAULT_TRAINER_PHONE
  )
}

export function isTrainerPhone(phone: string | null | undefined) {
  if (!phone?.trim()) return false
  return phoneKey(phone) === phoneKey(trainerPhone())
}
