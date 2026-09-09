import { CUSTOMER_HEADER } from "@/lib/agents/types"

export type HumanHandoffAction = "human_sales" | "human_service"

const DEFAULT_TZ = "Asia/Jerusalem"

function parseHourMinute(raw: string | undefined, fallback: { hour: number; minute: number }) {
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

function teamEndTime(action: HumanHandoffAction) {
  if (action === "human_sales") {
    return parseHourMinute(process.env.LANDBOT_HUMAN_SALES_END, { hour: 18, minute: 0 })
  }
  return parseHourMinute(process.env.LANDBOT_HUMAN_SERVICE_END, { hour: 15, minute: 30 })
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
  const end = teamEndTime(action)
  return `${String(end.hour).padStart(2, "0")}:${String(end.minute).padStart(2, "0")}`
}

/** Live rep pool is considered online before the configured end time (Israel time). */
export function isHumanAgentTeamOnline(action: HumanHandoffAction, now = new Date()) {
  const end = teamEndTime(action)
  const nowMinutes = wallClockMinutes(now, agentTimeZone())
  const endMinutes = end.hour * 60 + end.minute
  return nowMinutes < endMinutes
}

export function buildAfterHoursHandoffPrefix(action: HumanHandoffAction) {
  const until = humanAgentTeamHoursLabel(action)
  if (action === "human_sales") {
    return `כרגע אין יועצי מכירות זמינים (שעות הפעילות עד ${until}), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות.`
  }
  return `כרגע אין נציגי שירות זמינים (שעות הפעילות עד ${until}), אבל אל דאגה — קיבלנו את הפנייה וניצור איתכם קשר מיד עם חזרת הצוות לזמינות.`
}

function alreadyHasAfterHoursNotice(reply: string) {
  return /שעות הפעילות עד \d{1,2}:\d{2}/i.test(reply)
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
