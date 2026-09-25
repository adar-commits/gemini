import type { HistoryMessage } from "@/lib/agents/types"

/**
 * What the bot is waiting for after one of its messages. Stored per assistant row
 * (`hom_agent_messages.awaiting`) so pending-state detection does not depend on exact wording.
 * Detectors check the tag first and fall back to legacy phrase matching for untagged rows.
 */
export const BOT_AWAITING_KINDS = [
  "order_confirm",
  "order_phone_confirm",
  "handoff_confirm",
  "service_summary_confirm",
] as const

export type BotAwaiting = (typeof BOT_AWAITING_KINDS)[number]

export function normalizeBotAwaiting(value: unknown): BotAwaiting | null {
  return typeof value === "string" && (BOT_AWAITING_KINDS as readonly string[]).includes(value)
    ? (value as BotAwaiting)
    : null
}

export function messageAwaits(message: HistoryMessage | null | undefined, kind: BotAwaiting) {
  return message?.role === "assistant" && message.awaiting === kind
}
