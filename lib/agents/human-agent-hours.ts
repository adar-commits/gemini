import { CUSTOMER_HEADER } from "@/lib/agents/types"

export type HumanHandoffAction = "human_sales" | "human_service"

const DEFAULT_TZ = "Asia/Jerusalem"

type HourMinute = { hour: number; minute: number }

function parseHourMinute(raw: string | undefined, fallback: HourMinute) {
  const trimmed = raw?.trim()
  if (!trimmed) return fallback
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return fallback
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback
  return { hour, minute }
}

function toMinutes(value: HourMinute) {
  return value.hour * 60 + value.minute
}

function formatHourMinute(value: HourMinute) {
  return `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}`
}

type DayHours = { start: HourMinute; end: HourMinute }

function teamHours(action: HumanHandoffAction): DayHours {
  if (action === "human_sales") {
    return {
      start: parseHourMinute(process.env.LANDBOT_HUMAN_SALES_START, { hour: 9, minute: 30 }),
      end: parseHourMinute(process.env.LANDBOT_HUMAN_SALES_END, { hour: 18, minute: 0 }),
    }
  }
  return {
    start: parseHourMinute(process.env.LANDBOT_HUMAN_SERVICE_START, { hour: 9, minute: 0 }),
    end: parseHourMinute(process.env.LANDBOT_HUMAN_SERVICE_END, { hour: 16, minute: 0 }),
  }
}

/** Sales works short Friday hours (same as the stores); service is closed Friday. Nobody works Saturday. */
const SALES_FRIDAY_HOURS: DayHours = { start: { hour: 9, minute: 0 }, end: { hour: 14, minute: 0 } }

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function hoursOnWeekday(action: HumanHandoffAction, weekdayIndex: number): DayHours | null {
  if (weekdayIndex <= 4) return teamHours(action)
  if (weekdayIndex === 5 && action === "human_sales") return SALES_FRIDAY_HOURS
  return null
}

function wallClockWeekdayIndex(now: Date, timeZone: string) {
  const short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now)
  return WEEKDAYS.indexOf(short as (typeof WEEKDAYS)[number])
}

function agentTimeZone() {
  return process.env.LANDBOT_HUMAN_AGENT_TZ?.trim() || DEFAULT_TZ
}

function wallClockMinutes(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0")
  return hour * 60 + minute
}

function formatRange(hours: DayHours) {
  return `${formatHourMinute(hours.start)}-${formatHourMinute(hours.end)}`
}

export function humanAgentTeamHoursLabel(action: HumanHandoffAction) {
  const weekdays = `א'-ה' ${formatRange(teamHours(action))}`
  return action === "human_sales" ? `${weekdays}, ו' ${formatRange(SALES_FRIDAY_HOURS)}` : weekdays
}

/** Live rep pool is online within configured hours (Israel time, start inclusive, end exclusive). */
export function isHumanAgentTeamOnline(action: HumanHandoffAction, now = new Date()) {
  const timeZone = agentTimeZone()
  const today = hoursOnWeekday(action, wallClockWeekdayIndex(now, timeZone))
  if (!today) return false
  const nowMinutes = wallClockMinutes(now, timeZone)
  return nowMinutes >= toMinutes(today.start) && nowMinutes < toMinutes(today.end)
}

/** Team is next online on Sunday (weekend or end of the work week), not later today or tomorrow. */
function nextOpeningIsSunday(action: HumanHandoffAction, now: Date) {
  const timeZone = agentTimeZone()
  const weekdayIndex = wallClockWeekdayIndex(now, timeZone)
  const today = hoursOnWeekday(action, weekdayIndex)
  if (today && wallClockMinutes(now, timeZone) < toMinutes(today.start)) return false
  for (let offset = 1; offset <= 7; offset++) {
    const dayIndex = (weekdayIndex + offset) % 7
    if (hoursOnWeekday(action, dayIndex)) return dayIndex === 0
  }
  return false
}

export function buildAfterHoursHandoffPrefix(action: HumanHandoffAction, now = new Date()) {
  const team = action === "human_sales" ? "יועצי מכירות" : "נציגי שירות"
  if (nextOpeningIsSunday(action, now)) {
    const sundayStart = formatHourMinute(teamHours(action).start)
    return `כרגע אין ${team} זמינים, אבל אל דאגה — קיבלנו את הפנייה. הצוות חוזר ביום ראשון מ-${sundayStart}, ניצור איתכם קשר.`
  }
  const hours = humanAgentTeamHoursLabel(action)
  return `כרגע אין ${team} זמינים (שעות הפעילות ${hours}), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות.`
}

function onlineHandoffCore(action: HumanHandoffAction) {
  return action === "human_sales"
    ? "מעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."
    : "מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."
}

/** Customer-visible copy after handoff — one paragraph when reps are offline. */
export function buildHumanHandoffConfirmedReply(
  action: HumanHandoffAction,
  now = new Date()
) {
  if (!isHumanAgentTeamOnline(action, now)) {
    return buildAfterHoursHandoffPrefix(action, now)
  }
  return onlineHandoffCore(action)
}

/**
 * Final handoff reply shown to the customer.
 * After hours: keep whatever help the agent already wrote and close with the single offline notice.
 */
export function enrichHandoffReply(
  reply: string,
  action: HumanHandoffAction,
  now = new Date()
) {
  if (isHumanAgentTeamOnline(action, now)) {
    const text = reply.trim()
    return text || onlineHandoffCore(action)
  }

  const canonical = buildAfterHoursHandoffPrefix(action, now)
  if (reply.includes(canonical)) return reply

  const hasHeader = reply.trimStart().startsWith(CUSTOMER_HEADER)
  const body = (hasHeader ? reply.trimStart().slice(CUSTOMER_HEADER.length) : reply).trim()
  const text = body ? `${body}\n\n${canonical}` : canonical
  return hasHeader ? `${CUSTOMER_HEADER}\n${text}` : text
}
