const DEFAULT_TEST_PHONE = "+972547495083"

function digits(phone: string) {
  let value = phone.replace(/\D/g, "")
  if (value.startsWith("00")) value = value.slice(2)
  return value
}

function variants(phone: string) {
  const raw = digits(phone)
  const set = new Set<string>([raw])
  if (raw.startsWith("0") && raw.length >= 9) {
    set.add(`972${raw.slice(1)}`)
    set.add(raw.slice(1))
  }
  if (raw.startsWith("972") && raw.length >= 11) {
    set.add(`0${raw.slice(3)}`)
    set.add(raw.slice(3))
  }
  if (raw.length === 9 && raw.startsWith("5")) {
    set.add(`972${raw}`)
    set.add(`0${raw}`)
  }
  return set
}

type PhoneList = string[] | "all"

function parsePhoneEnv(...keys: string[]): PhoneList | undefined {
  for (const key of keys) {
    const raw = process.env[key]?.trim()
    if (!raw) continue
    if (raw === "*" || raw.toLowerCase() === "all") return "all"
    const list = raw
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (list.length) return list
  }
  return undefined
}

function displayList(list: PhoneList | undefined) {
  if (list === "all") return "all"
  if (!list) return [DEFAULT_TEST_PHONE]
  return list
}

function matchesPhone(phone: string | null | undefined, list: PhoneList) {
  if (list === "all") return true
  if (!phone?.trim()) return false
  const incoming = variants(phone)
  return list.some((item) => {
    const listed = variants(item)
    for (const value of incoming) {
      if (listed.has(value)) return true
    }
    return false
  })
}

/** Phones we run the agent for (shadow + reply). */
export function shouldProcessPhone(phone: string | null | undefined) {
  const process = parsePhoneEnv("LANDBOT_PROCESS_PHONES")
  if (process) return matchesPhone(phone, process)
  return shouldReplyPhone(phone)
}

/** Phones that receive WhatsApp replies and Landbot assignments. */
export function shouldReplyPhone(phone: string | null | undefined) {
  const reply = parsePhoneEnv("LANDBOT_REPLY_PHONES", "LANDBOT_ALLOWLIST_PHONES")
  if (reply === "all") return true
  if (!reply) return matchesPhone(phone, [DEFAULT_TEST_PHONE])
  return matchesPhone(phone, reply)
}

/** @deprecated Use shouldProcessPhone or landbotPhonePolicy(). */
export function allowlistPhones() {
  const reply = parsePhoneEnv("LANDBOT_REPLY_PHONES", "LANDBOT_ALLOWLIST_PHONES")
  if (reply === "all") return null
  return displayList(reply)
}

/** @deprecated Use shouldProcessPhone(). */
export function isPhoneAllowed(phone: string | null | undefined) {
  return shouldProcessPhone(phone)
}

export function landbotPhonePolicy() {
  const process = parsePhoneEnv("LANDBOT_PROCESS_PHONES")
  const reply = parsePhoneEnv("LANDBOT_REPLY_PHONES", "LANDBOT_ALLOWLIST_PHONES")
  return {
    process: displayList(process ?? reply),
    reply: displayList(reply),
  }
}
