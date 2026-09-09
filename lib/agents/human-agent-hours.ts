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

function teamHours(action: HumanHandoffAction): { start: HourMinute; end: HourMinute } {
  if (action === "human_sales") {
    return {
      start: parseHourMinute(process.env.LANDBOT_HUMAN_SALES_START, { hour: 9, minute: 30 }),
      end: parseHourMinute(process.env.LANDBOT_HUMAN_SALES_END, { hour: 18, minute: 0 }),
    }
  }
  return {
    start: parseHourMinute(process.env.LANDBOT_HUMAN_SERVICE_START, { hour: 8, minute: 0 }),
    end: parseHourMinute(process.env.LANDBOT_HUMAN_SERVICE_END, { hour: 16, minute: 0 }),
  }
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

export function humanAgentTeamHoursLabel(action: HumanHandoffAction) {
  const { start, end } = teamHours(action)
  return `${formatHourMinute(start)}-${formatHourMinute(end)}`
}

/** Live rep pool is online within configured hours (Israel time, start inclusive, end exclusive). */
export function isHumanAgentTeamOnline(action: HumanHandoffAction, now = new Date()) {
  const { start, end } = teamHours(action)
  const nowMinutes = wallClockMinutes(now, agentTimeZone())
  const startMinutes = toMinutes(start)
  const endMinutes = toMinutes(end)
  return nowMinutes >= startMinutes && nowMinutes < endMinutes
}

export function buildAfterHoursHandoffPrefix(action: HumanHandoffAction) {
  const hours = humanAgentTeamHoursLabel(action)
  if (action === "human_sales") {
    return `כרגע אין יועצי מכירות זמינים (שעות הפעילות ${hours}), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות.`
  }
  return `כרגע אין נציגי שירות זמינים (שעות הפעילות ${hours}), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות.`
}

function alreadyHasAfterHoursNotice(reply: string) {
  return /שעות הפעילות(?: עד| \d{1,2}:\d{2}-\d{1,2}:\d{2})/i.test(reply)
}

export function buildHumanHandoffConfirmedReply(
  action: HumanHandoffAction,
  now = new Date()
) {
  const core =
    action === "human_sales"
      ? "מעולה, העברתי את השיחה ליועץ מכירות. ניצור קשר בהקדם."
      : "מעולה, העברתי את השיחה לנציג שירות. ניצור קשר בהקדם."

  if (isHumanAgentTeamOnline(action, now)) return core
  return `${buildAfterHoursHandoffPrefix(action)}\n\n${core}`
}

/** Prepend after-hours notice to LLM/deterministic handoff copy when reps are offline. */
export function enrichHandoffReply(
  reply: string,
  action: HumanHandoffAction,
  now = new Date()
) {
  const text = reply.trim()
  if (!text || isHumanAgentTeamOnline(action, now) || alreadyHasAfterHoursNotice(text)) {
    return reply
  }

  const prefix = buildAfterHoursHandoffPrefix(action)
  if (text.startsWith(CUSTOMER_HEADER)) {
    const body = text.slice(CUSTOMER_HEADER.length).replace(/^\n+/, "")
    return `${CUSTOMER_HEADER}\n${prefix}\n\n${body}`
  }
  return `${prefix}\n\n${text}`
}
