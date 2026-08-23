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

export function allowlistPhones() {
  const raw = process.env.LANDBOT_ALLOWLIST_PHONES?.trim()
  if (raw === "*" || raw?.toLowerCase() === "all") return null
  const listed = (raw || DEFAULT_TEST_PHONE)
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  return listed
}

export function isPhoneAllowed(phone: string | null | undefined) {
  const allowed = allowlistPhones()
  if (allowed === null) return true
  if (!phone?.trim()) return false
  const incoming = variants(phone)
  return allowed.some((item) => {
    const listed = variants(item)
    for (const value of incoming) {
      if (listed.has(value)) return true
    }
    return false
  })
}
