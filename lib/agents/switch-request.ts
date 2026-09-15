import { buildApiFailureReply } from "@/lib/agent-core/fallbacks"
import {
  buildExchangeSwitchSuccessReply,
  exchangeKindToApiCode,
  extractExchangeIntake,
  type ExchangeKind,
  type ExchangeReasonCode,
} from "@/lib/agents/exchange-intake"
import { callPriorityWebhook } from "@/lib/agents/priority-webhook"
import { normalizedIsraeliMobilePhone } from "@/lib/agents/phone-for-api"
import type { HistoryMessage } from "@/lib/agents/types"

export type CreateSwitchRequestInput = {
  phone: string
  orderNumber: string
  exchangeKind: ExchangeKind
  targetSku?: string | null
  reasonCode?: ExchangeReasonCode | null
  customerReasonText?: string | null
  history?: HistoryMessage[]
  body?: string
}

function parseSwitchRequestResponse(payload: unknown) {
  if (!payload || typeof payload !== "object") return null
  const row = payload as Record<string, unknown>
  if (row.success !== "ok") return null
  const id =
    (typeof row["switch-request"] === "string" && row["switch-request"]) ||
    (typeof row.switchRequest === "string" && row.switchRequest) ||
    null
  return id?.trim() || null
}

export async function createSwitchRequest(input: CreateSwitchRequestInput) {
  const phone = normalizedIsraeliMobilePhone(input.phone)
  if (!phone) {
    return {
      ok: false as const,
      error: "Invalid phone for switch request API",
    }
  }

  const payload = {
    phone,
    orderNumber: input.orderNumber.trim(),
    exchangeKind: exchangeKindToApiCode(input.exchangeKind),
    targetSku: input.targetSku?.trim() || null,
    reasonCode: input.reasonCode ?? null,
    customerReasonText: input.customerReasonText?.trim() || null,
  }

  const response = await callPriorityWebhook({
    actionType: "createSwitchRequest",
    value: JSON.stringify(payload),
  })

  const switchRequestId = parseSwitchRequestResponse(response)
  if (!switchRequestId) {
    return {
      ok: false as const,
      reply: buildApiFailureReply("sales"),
      action: "human_sales" as const,
    }
  }

  const intake = extractExchangeIntake(input.history ?? [], input.body ?? "")
  intake.exchangeKind = input.exchangeKind
  intake.targetSku = input.targetSku ?? null
  intake.customerReasonText = input.customerReasonText ?? null
  intake.reasonCode = input.reasonCode ?? null
  intake.orderNumber = input.orderNumber
  intake.switchRequestId = switchRequestId

  return {
    ok: true as const,
    reply: buildExchangeSwitchSuccessReply(switchRequestId, intake),
    action: "human_sales" as const,
    switchRequestId,
  }
}
