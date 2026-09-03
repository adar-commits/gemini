import {
  isChannelPhoneSelfReference,
  customerOrderNumberStyleFromHistory,
  isDeliveryEstimateQuestion,
  isOrderConfirmationPending,
  isOrderDeliveryStatusQuestion,
  isOrderNumberRequestPending,
  isOrderStatusDeliveredInThread,
  isPhoneLookupConfirmPending,
  userProvidedPhone,
} from "@/lib/agents/order-lookup"
import {
  classifyPostPurchaseCase,
  isCreditCodeOnlineRedemptionRequest,
  isCreditRedemptionQuestion,
  isRefundTimelineQuestion,
} from "@/lib/agents/inquiry-intent"
import { isDissatisfactionWithoutDefect } from "@/lib/agents/dissatisfaction"
import {
  isCasualGreeting,
  isCasualSmallTalk,
  substantiveUserMessages,
} from "@/lib/agents/greeting"
import {
  isCarpetRentalQuestion,
  isReturnExchangePolicyFaqQuestion,
} from "@/lib/agents/policy-subjects"
import {
  isActiveInventoryThread,
  isInventoryRecheckRequest,
} from "@/lib/agents/inventory-lookup"
import {
  isPostPurchaseIntentConfirmPending,
  isPostPurchaseIntentConfirmed,
  isPostPurchaseIntentDeclined,
} from "@/lib/agents/intent-confirmation"
import {
  buildServiceRepHandoffNote,
  extractServiceIntake,
  isReturnPickupAwaitingThread,
  isServiceHandoffSummaryConfirmed,
  isServiceHandoffSummaryPending,
} from "@/lib/agents/service-intake"
import type { HistoryMessage } from "@/lib/agents/types"

/** Dynamic turn hints — guide the LLM without bypassing it. */
export function buildConversationHints(input: {
  history: HistoryMessage[]
  body: string
  whatsappPhone?: string
}): string | null {
  const { history, body } = input
  const lines: string[] = []

  if (
    substantiveUserMessages(history).length === 0 &&
    (isCasualGreeting(body) || isCasualSmallTalk(body))
  ) {
    lines.push(
      'OPENING GREETING: mirror their hello warmly (e.g. "היי שלום" → "היי שלום! 😊"). Use 1–2 emojis (😊 ☺️ 👋). Never a dry "איך אפשר לעזור?" without warmth first.'
    )
  }

  if (isServiceHandoffSummaryPending(history)) {
    if (isServiceHandoffSummaryConfirmed(body)) {
      const intake = extractServiceIntake(history, body)
      lines.push(
        `Service summary was confirmed. Reply briefly, set action \`human_service\`, include rep note: ${buildServiceRepHandoffNote(intake)}`
      )
    } else {
      lines.push(
        "Waiting for customer to confirm service summary (אני צודק?). If they correct details, update summary and ask again. If they confirm (כן/נכון), action human_service."
      )
    }
  }

  if (
    isReturnPickupAwaitingThread(history, body) &&
    !isServiceHandoffSummaryPending(history) &&
    !isPostPurchaseIntentConfirmPending(history)
  ) {
    lines.push(
      "RETURN PICKUP WAIT (advanced service, not FAQ): identify order via lookup_order_status if needed, then rep-report bullets ('אז מסכם את הפנייה…') → human_service after confirm. Never tell customer outbound shipping/self-pickup status — rep handles pickup logistics."
    )
  }

  if (isPostPurchaseIntentConfirmPending(history)) {
    if (isPostPurchaseIntentDeclined(body)) {
      lines.push(
        "Customer corrected your intent mirror. Thank them and ask how to help — do not repeat the same confirm question."
      )
    } else if (isPostPurchaseIntentConfirmed(body)) {
      const intake = extractServiceIntake(history, body)
      if (intake.issueKind === "return_pickup_pending") {
        lines.push(
          "Intent confirmed — return pickup wait. Service summary → human_service after confirm; never shipping lookup."
        )
      } else {
        lines.push(
          "Intent confirmed — continue service intake (order ID if helpful) → summary → human_service."
        )
      }
    } else {
      lines.push(
        "You asked 'אני צודק?' on post-purchase intent. Wait for כן/לא; on כן continue the matching playbook."
      )
    }
  }

  const postPurchaseKind = classifyPostPurchaseCase(body)
  if (postPurchaseKind === "defect") {
    lines.push(
      "Defect / damage report: empathize and describe what you see or what they reported — never confirm 'מדובר בפגם' or 'פגם מלכתחילה'. Rep bullet: דיווח על בעיה / חשש (לפי הלקוח). Human verifies liability."
    )
  }

  if (
    postPurchaseKind === "return_pickup_pending" &&
    !isReturnPickupAwaitingThread(history, body)
  ) {
    lines.push(
      "Opening: return pickup wait. Mirror briefly if needed, then service summary — not order lookup."
    )
  }

  if (
    input.whatsappPhone &&
    isChannelPhoneSelfReference(body) &&
    (isOrderNumberRequestPending(history) || isPhoneLookupConfirmPending(history))
  ) {
    lines.push(
      `Customer confirmed the WhatsApp channel phone (${input.whatsappPhone}). Call lookup_order_status now — do not re-ask the same phone question.`
    )
  }

  if (isOrderConfirmationPending(history) && !isReturnPickupAwaitingThread(history, body)) {
    lines.push(
      "Order/shipment lookup in progress — bind short replies (כן/כן זה/נכון/המספר שלי) to the pending lookup, not a new topic. Never repeat the order card — the tool handles confirm."
    )
  }

  if (isOrderConfirmationPending(history) && userProvidedPhone(body)) {
    lines.push(
      "Customer sent a phone number during order confirmation — call lookup_order_status with that number immediately; do not repeat the rejected order card."
    )
  }

  if (
    isOrderStatusDeliveredInThread(history) &&
    (isDeliveryEstimateQuestion(body) || isOrderDeliveryStatusQuestion(body))
  ) {
    lines.push(
      "Order already identified this thread — do NOT call lookup_order_status again or re-ask phone. Delivery estimate (צפי) → policy by status code only; never invent a calendar date."
    )
  }

  const orderStyle = customerOrderNumberStyleFromHistory(history, body)
  if (orderStyle) {
    const styleHint =
      orderStyle === "hash"
        ? "#76884-style"
        : orderStyle === "digits"
          ? "bare digits (76884)"
          : "SO26005938-style"
    lines.push(
      `Customer uses ${styleHint} order IDs — keep the same format in every reply this thread (never switch to another shape).`
    )
  }

  if (isDissatisfactionWithoutDefect(body)) {
    lines.push(
      "Dissatisfaction without defect: use the two-option playbook (exchange + sales advisor offer; return via branch/courier + returns portal). Never 'מצב לא נעים' or numbered emoji bullets."
    )
  }

  if (isReturnExchangePolicyFaqQuestion(body) && !postPurchaseKind) {
    lines.push(
      "Policy FAQ: returns/cancellations → returns portal; exchanges → branch or paid courier fees from KB — never portal for exchanges."
    )
  }

  if (isCreditRedemptionQuestion(body)) {
    lines.push(
      "Credit redemption FAQ: say קוד זיכוי (never שובר). Branches or website via service rep — not self-service coupon field."
    )
  }

  if (isCreditCodeOnlineRedemptionRequest(body, history)) {
    lines.push("Online credit-code redemption → explain policy briefly, action human_service.")
  }

  if (isCarpetRentalQuestion(body)) {
    lines.push(
      "Carpet rental / try-before-buy: answer from KB (case-by-case via sales advisor). Never 'אין לי מידע' or branch hours dump."
    )
  }

  if (isRefundTimelineQuestion(body)) {
    lines.push(
      "Refund timeline: up to 7 business days from cancellation date — not from warehouse/branch receipt."
    )
  }

  if (isActiveInventoryThread(history) || isInventoryRecheckRequest(body)) {
    lines.push(
      "Inventory thread (sales flow): re-check another item → ask for a **new** מק״ט; after results offer human_sales if they want to buy."
    )
  }

  return lines.length > 0 ? lines.map((line) => `- ${line}`).join("\n") : null
}
