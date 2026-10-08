/** Israel staff-present window used to age a human-owned thread. Fri/Sat do not count. */
const TZ = "Asia/Jerusalem"
const WINDOW_START_MIN = 9 * 60
const WINDOW_END_MIN = 18 * 60
const BRIDGE_BUSINESS_HOURS = 4
const STALE_BUSINESS_HOURS = 16

export type HumanThreadAgeTier = "fresh" | "bridge" | "stale"

function israelWall(at: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0"
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(read("weekday"))
  return {
    weekday,
    y: Number(read("year")),
    m: Number(read("month")),
    d: Number(read("day")),
    minutes: Number(read("hour")) * 60 + Number(read("minute")),
  }
}

function isStaffWeekday(weekday: number) {
  return weekday >= 0 && weekday <= 4
}

const STEP_MS = 15 * 60 * 1000

/** Staff-present hours (Sun–Thu 09:00–18:00 Israel) between two instants. */
export function israelStaffHoursBetween(from: Date, to: Date) {
  if (to.getTime() <= from.getTime()) return 0
  let hours = 0
  const end = Math.min(to.getTime(), from.getTime() + 90 * 24 * 3600 * 1000)
  for (let cursor = from.getTime(); cursor < end; cursor += STEP_MS) {
    const wall = israelWall(new Date(cursor))
    if (
      isStaffWeekday(wall.weekday) &&
      wall.minutes >= WINDOW_START_MIN &&
      wall.minutes < WINDOW_END_MIN
    ) {
      hours += STEP_MS / 3600000
    }
  }
  return hours
}

export function classifyHumanThreadAge(lastHumanAt: string, now = new Date()): HumanThreadAgeTier {
  const from = new Date(lastHumanAt)
  if (!Number.isFinite(from.getTime())) return "fresh"
  const hours = israelStaffHoursBetween(from, now)
  if (hours >= STALE_BUSINESS_HOURS) return "stale"
  if (hours >= BRIDGE_BUSINESS_HOURS) return "bridge"
  return "fresh"
}
