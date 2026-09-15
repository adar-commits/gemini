import { isActiveSalesConsultation } from "@/lib/agents/sales-intake"
import {
  exchangeIntakeOrderConfirmed,
  extractExchangeIntake,
  isExchangeIntakeActive,
  isExchangeReadyForSwitchRequest,
  type ExchangeKind,
  type ExchangeReasonCode,
} from "@/lib/agents/exchange-intake"
import { isPostPurchaseServiceFlow } from "@/lib/agents/service-intake"
import { isReturnExchangePolicyFaqQuestion } from "@/lib/agents/policy-subjects"
import { isPostPurchaseAlternateSizeThread } from "@/lib/agents/post-purchase-alt-size"
import { getDissatisfactionRescueStage } from "@/lib/agents/dissatisfaction"
import { createSwitchRequest } from "@/lib/agents/switch-request"
import type { HistoryMessage } from "@/lib/agents/types"

export async function executeCreateSwitchRequest(input: {
  body: string
  phone?: string
  history?: HistoryMessage[]
  exchangeKind: ExchangeKind
  targetSku?: string | null
  reasonCode?: ExchangeReasonCode | null
  customerReasonText?: string | null
}) {
  const history = input.history ?? []
  const body = input.body.trim()

  if (!isExchangeIntakeActive(history)) {
    return {
      ok: false as const,
      error:
        "Exchange intake is not active — use only after customer chose החלפה from the two-option dissatisfaction menu and order is confirmed. Policy FAQ and new-purchase sales flows must not call this tool.",
    }
  }

  if (getDissatisfactionRescueStage(history) === "portal_referred") {
    return {
      ok: false as const,
      error: "Customer chose return path — do not create a switch request.",
    }
  }

  if (isPostPurchaseServiceFlow(history)) {
    return {
      ok: false as const,
      error: "Service/defect thread — use service intake, not create_switch_request.",
    }
  }

  if (isActiveSalesConsultation(history, null)) {
    return {
      ok: false as const,
      error: "Active sales consultation — do not call create_switch_request.",
    }
  }

  if (isPostPurchaseAlternateSizeThread(history)) {
    return {
      ok: false as const,
      error: "Post-purchase alternate-size thread — offer human_sales advisor, not switch API.",
    }
  }

  if (isReturnExchangePolicyFaqQuestion(body)) {
    return {
      ok: false as const,
      error: "Exchange policy FAQ — answer from KB only; no switch request.",
    }
  }

  if (!exchangeIntakeOrderConfirmed(history)) {
    return {
      ok: false as const,
      error:
        "Order not confirmed yet — call lookup_order_status first and wait for customer to confirm the order card.",
    }
  }

  const intake = extractExchangeIntake(history, body)
  if (!isExchangeReadyForSwitchRequest(history, body)) {
    if (input.exchangeKind === "different_model" && !intake.customerReasonText && !input.customerReasonText) {
      return {
        ok: false as const,
        error:
          "Exchange kind C requires customer reason (מה לא אהבתם) before create_switch_request.",
      }
    }
    if (
      (input.exchangeKind === "same_model_color" || input.exchangeKind === "same_model_size") &&
      !intake.skuQuestionSent &&
      !input.targetSku &&
      !intake.targetSku
    ) {
      return {
        ok: false as const,
        error:
          "Ask for target SKU once (optional for customer) before create_switch_request for kind A/B.",
      }
    }
    return {
      ok: false as const,
      error: "Exchange intake not ready — complete kind/SKU/reason steps first.",
    }
  }

  const orderNumber = intake.orderNumber
  if (!orderNumber) {
    return {
      ok: false as const,
      error: "Missing order number — run lookup_order_status and confirm order first.",
    }
  }

  const phone = input.phone?.trim()
  if (!phone) {
    return {
      ok: false as const,
      error: "Missing WhatsApp phone for switch request API.",
    }
  }

  return createSwitchRequest({
    phone,
    orderNumber,
    exchangeKind: input.exchangeKind,
    targetSku: input.targetSku ?? intake.targetSku,
    reasonCode: input.reasonCode ?? intake.reasonCode,
    customerReasonText: input.customerReasonText ?? intake.customerReasonText,
    history,
    body,
  })
}
