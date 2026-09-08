const JERUSALEM_TZ = "Asia/Jerusalem"

function parseIsoDate(iso: string) {
  const parsed = Date.parse(iso.trim())
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed)
}

function jerusalemParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: JERUSALEM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""
  return {
    day: get("day"),
    month: get("month"),
    year: get("year"),
    hour: get("hour"),
    minute: get("minute"),
  }
}

/** True when the source ISO carries an explicit clock time (not date-only / midnight sentinel). */
export function isoHasMeaningfulTime(iso: string) {
  const trimmed = iso.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false

  const timeMatch = trimmed.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!timeMatch) return false

  const hour = timeMatch[1]
  const minute = timeMatch[2]
  const second = timeMatch[3] ?? "00"
  return !(hour === "00" && minute === "00" && second === "00")
}

/** Customer-facing date: dd/mm/yyyy */
export function formatHebrewCustomerDate(iso: string | null | undefined) {
  if (!iso?.trim()) return null
  const date = parseIsoDate(iso)
  if (!date) return null
  const { day, month, year } = jerusalemParts(date)
  return `${day}/${month}/${year}`
}

/** Customer-facing date/time: dd/mm/yyyy, plus בשעה hh:mm only when time is known. */
export function formatHebrewCustomerDateTime(iso: string | null | undefined) {
  const datePart = formatHebrewCustomerDate(iso)
  if (!datePart || !iso?.trim()) return datePart

  if (!isoHasMeaningfulTime(iso)) return datePart

  const date = parseIsoDate(iso)
  if (!date) return datePart
  const { hour, minute } = jerusalemParts(date)
  return `${datePart} בשעה ${hour}:${minute}`
}
