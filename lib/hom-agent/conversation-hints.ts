import { salesIntakeMode } from "@/lib/agent-core/config"
import {
  channelPhone,
  extractOrderNumber,
  isChannelPhoneSelfReference,
  customerOrderNumberStyleFromHistory,
  isDeliveryEstimateQuestion,
  isOrderConfirmationPending,
  isOrderDeliveryStatusQuestion,
  isOrderLookupPhoneReplyPending,
  isOrderNumberRequestPending,
  isOrderReferencePresentation,
  isIdentifiedOrderRejection,
  isOrderLookupCompletedInThread,
  isShippingAddressUpdateThread,
  isPreorderEtaSharedInThread,
  isPostOrderShippingFollowUp,
  isOrderStatusDeliveredInThread,
  isPhoneLookupConfirmPending,
  isServiceOrderIdentificationFlow,
  userProvidedPhone,
} from "@/lib/agents/order-lookup"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import {
  classifyPostPurchaseCase,
  isCallbackUrgencyRequest,
  isCreditCodeOnlineRedemptionRequest,
  isCreditRedemptionQuestion,
  isDefectReplacementStatusQuestion,
  isMissingOrPartialDeliveryComplaint,
  isOrderModificationRequest,
  isRefundTimelineQuestion,
  isReturnEligibilityQuestion,
  isReturnShippingFeeQuestion,
  isTradeInQuestion,
} from "@/lib/agents/inquiry-intent"
import {
  isCatalogProductInquiry,
  isHomStorefrontUrl,
  isProductDetailsRequest,
  isProductInventoryQuestion,
  isSpecificProductMention,
} from "@/lib/agents/product-handoff"
import { isCouponCodeRequest } from "@/lib/agents/campaign-lookup"
import {
  activeDigitalDocumentRequest,
  documentLookupFailureOfferedInThread,
  isActiveDigitalDocumentFlow,
  isDigitalDocumentRequest,
  outboundDocumentDeliveryInThread,
  isOutboundDocumentDeliveryMessage,
  lastAssistantWasOutboundDocumentDelivery,
  shouldDeferDocumentFlowToOrderLookup,
  shouldReleaseStructuredDocumentFlow,
} from "@/lib/agents/digital-document-flow"
import { isMembershipClubCheckoutQuestion } from "@/lib/agents/payment-intent"
import {
  isDissatisfactionRescuePending,
  isDissatisfactionWithoutDefect,
  shouldOfferReturnOptionsFirst,
} from "@/lib/agents/dissatisfaction"
import {
  isDissatisfactionMenuPending,
  isExplicitExchangeExecutionTurn,
  isExchangeIntakeActive,
  isExchangeKindPending,
  isExchangeOrderRequired,
  isExchangeReasonPending,
  isExchangeReadyForSwitchRequest,
  isExchangeSkuPending,
  needsExchangeKindQuestion,
} from "@/lib/agents/exchange-intake"
import {
  isCasualGreeting,
  isCasualSmallTalk,
  extractLeadingGreeting,
  isFirstSubstantiveCustomerTurn,
  substantiveUserMessages,
} from "@/lib/agents/greeting"
import { isOwnedRugCareQuestion } from "@/lib/crm/conversation-department"
import { isKbSelfServiceFaqThisTurn } from "@/lib/agents/kb-self-service-faq"
import {
  isCarpetPackagingOpenQuestion,
  isCarpetRentalQuestion,
  isReturnExchangePolicyFaqQuestion,
  isRugCleaningServiceQuestion,
} from "@/lib/agents/policy-subjects"
import {
  endsWithOptionalFollowUpOffer,
  isThanksAcknowledgment,
  isNonSubstantiveFollowUp,
} from "@/lib/agents/conversation-close"
import {
  extractSku,
  isActiveInventoryThread,
  isInventoryRecheckRequest,
  shouldHandleBranchInventory,
} from "@/lib/agents/inventory-lookup"
import {
  isPostPurchaseIntentConfirmPending,
  isPostPurchaseIntentConfirmed,
  isPostPurchaseIntentDeclined,
} from "@/lib/agents/intent-confirmation"
import {
  buildServiceRepGoalNote,
  extractServiceIntake,
  isPostPurchaseServiceFlow,
  isReturnPickupAwaitingThread,
  isServiceHandoffSummaryConfirmed,
  isServiceHandoffSummaryPending,
} from "@/lib/agents/service-intake"
import {
  isPostPurchaseAlternateSizeThread,
} from "@/lib/agents/post-purchase-alt-size"
import {
  extractSalesIntake,
  hasOngoingSalesIntake,
  hasRoomPhotoInHistory,
  isAwaitingSalesIntakeAnswer,
  isSalesPhotoRequestPending,
} from "@/lib/agents/sales-intake"
import {
  isInactivityAssistantMessage,
  isInactivityPingPending,
} from "@/lib/agents/inactivity"
import { isHumanAgentTeamOnline } from "@/lib/agents/human-agent-hours"
import {
  hasDeclarativeHandoffTransfer,
  inferHumanHandoffAction,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import { isConfirmationPending, isSalesFinalSummaryPending } from "@/lib/agents/sales-intake"
import {
  BOT_VOICE_NO_MIRROR_HINT,
  customerUsesFeminineSelfReference,
} from "@/lib/agents/bot-voice"
import type { HistoryMessage } from "@/lib/agents/types"

function isReturnPortalSelfServiceThread(history: HistoryMessage[]) {
  return history.some(
    (message) =>
      message.role === "assistant" && /returns\.carpetshop\.co\.il/.test(message.content)
  )
}

/** Dynamic turn hints — guide the LLM without bypassing it. */
export function buildConversationHints(input: {
  history: HistoryMessage[]
  body: string
  whatsappPhone?: string
}): string | null {
  const { history, body } = input
  const lines: string[] = []

  const kbSelfServiceFaqThisTurn = isKbSelfServiceFaqThisTurn(body, history)

  if (isFirstSubstantiveCustomerTurn(history)) {
    lines.push(
      "FIRST CUSTOMER MESSAGE: interpret their full intent with LLM + tools this turn — no structured FAQ/order shortcuts. Answer what they actually asked; call lookup_order_status only when they ask about an existing order/shipment — never for a product page or פרטים נוספים."
    )
  }

  if (isCatalogProductInquiry(body, history) || isHomStorefrontUrl(body) || isProductDetailsRequest(body)) {
    lines.push(
      'CATALOG PRODUCT (מכירות): carpetshop.co.il / pozitiveshop.co.il link or Landbot "פרטים נוספים לגבי …" is a product they saw on the site — not an order. Never lookup_order_status / phone-confirm. Set `"crm_department": "sales"`, answer from KB or continue sales intake (room / photo / advisor). A photo asking about the model shape belongs here too.'
    )
  }

  if (
    isFirstSubstantiveCustomerTurn(history) &&
    (isCasualGreeting(body) ||
      isCasualSmallTalk(body) ||
      extractLeadingGreeting(body))
  ) {
    lines.push(
      'OPENING GREETING: mirror their hello warmly on your first line (e.g. "היי שלום" → "היי שלום! 😊") — even when you continue to order lookup or policy. Use 1–2 emojis (😊 ☺️ 👋). Never jump straight to "קודם אמצא את ההזמנה" without greeting first.'
    )
  }

  const questionParts = splitQuestionParts(body)
  if (questionParts.length >= 2) {
    lines.push(
      `MULTI-MESSAGE TURN (${questionParts.length} parts merged): rapid WhatsApp messages were combined into this one turn. FIRST decide: do the parts describe ONE issue/flow (very common — e.g. "קיבלתי את השטיח" + "ולא אהבתי אותו" = one dissatisfaction case)? If so, treat them as a single request and give ONE coherent reply for that flow — never answer each line separately, never add a second greeting or a generic "how can I help" block after a substantive answer. Only when the parts are genuinely DISTINCT topics: cover each answerable topic briefly in short blocks; if one needs live data (order status / inventory / document), answer the non-tool topics first, then ask one focused follow-up for that item. Prefer at most one tool call this turn.`
    )
  }

  if (customerUsesFeminineSelfReference(body)) {
    lines.push(BOT_VOICE_NO_MIRROR_HINT)
  }

  if (isShippingAddressUpdateThread(history)) {
    lines.push(
      "SHIPPING ADDRESS UPDATE (532692073): they want to change the delivery address — not shipment status. Answer from shipping-policy KB: an update is not always possible; it depends on whether the order was already handed to the courier. After handover there is a cost — WhatsApp 077-9725055 or *3076. Do NOT call lookup_order_status, do NOT send בדקתי / סטטוס משלוח, do NOT ask for the new address or an order number. action reply — never אעביר with action reply."
    )
  }

  if (isOrderModificationRequest(body)) {
    lines.push(
      'ORDER MODIFICATION (532165595): customer wants to change color/size on an existing order. Empathize → call lookup_order_status (phone confirm is OK) → after order card confirm start exchange intake kind A for color change. Never sales-intake quiz, never empty/"לא הצלחתי להבין".'
    )
  }

  if (isConfirmationPending(history)) {
    lines.push(
      "LEGACY SALES SUMMARY CONFIRM: older thread still has אני צודק? — on customer confirm (כן/נכון/בדיוק) set action human_sales immediately. New intake must never ask confirm."
    )
  }

  const awaitingSalesIntakeAnswer = isAwaitingSalesIntakeAnswer(history)
  const salesIntakeActive =
    hasOngoingSalesIntake(history) && awaitingSalesIntakeAnswer

  if (salesIntakeActive) {
    lines.push(
      'SALES THREAD (מכירות): new purchase / product inquiry / available sizes (e.g. יש יותר קטן?) — not שירות. Include `"crm_department": "sales"` in JSON this turn. When intake is complete, send recap + action human_sales in the **same** JSON (מעביר/ה ליועץ מכירות) — never אני צודק? and never wait for approval.'
    )
  }

  const serviceFlowActive =
    isServiceHandoffSummaryPending(history) ||
    isServiceOrderIdentificationFlow(history, body) ||
    isReturnPickupAwaitingThread(history, body) ||
    isPostPurchaseServiceFlow(history)

  if (serviceFlowActive && !salesIntakeActive) {
    lines.push(
      'SERVICE THREAD (שירות לקוחות): include `"crm_department": "service"` in JSON this turn when continuing service intake or rep summary — not מכירות.'
    )
  }

  if (
    isOrderStatusDeliveredInThread(history) &&
    (isSpecificProductMention(body, history) || isProductInventoryQuestion(body))
  ) {
    lines.push(
      'MID-THREAD PIVOT (service→sales): customer finished shipping/status and now asks about a product, photo, or new purchase. Set `"crm_department": "sales"` immediately and start/continue sales intake — do not restart order lookup or stay on service.'
    )
  }

  if (
    (isMissingOrPartialDeliveryComplaint(body) ||
      isShippingStatusQuestion(body)) &&
    hasOngoingSalesIntake(history) &&
    !awaitingSalesIntakeAnswer
  ) {
    lines.push(
      'MID-THREAD PIVOT (sales→service): customer reports delivery problem / shipment not received. Set `"crm_department": "service"`, handle as service (lookup_order_status if needed) — do not bind bare כן/נכון to a stale sales quiz.'
    )
  }

  if (isServiceHandoffSummaryPending(history)) {
    lines.push(
      "SERVICE SUMMARY PENDING: on customer confirm (כן/נכון/בדיוק/כן תודה) set action human_service + crm_department service immediately — short transfer to נציג שירות only. Never human_sales / יועץ מכירות (אני צודק? here is the service recap, not a sales summary). If they stay silent, the system auto-assigns to שירות (no inactivity ping)."
    )
  }

  if (isHumanHandoffPending(history) && !kbSelfServiceFaqThisTurn) {
    const handoffAction = inferHumanHandoffAction(history, null)
    const documentHandoff = documentLookupFailureOfferedInThread(history)
    lines.push(
      documentHandoff
        ? `DOCUMENT HANDOFF PENDING: getDocument already ran for this phone — customer confirms rep transfer (כן / כן אני אשמח / כן, תודה / bare כן). Set action ${handoffAction} NOW — never re-ask "האם העסקה רשומה על המספר", never call fetch_digital_document or lookup_order_status again.`
        : `HANDOFF OFFER PENDING: any confirm (כן / כן אני אשמח / כן, תודה / בסדר / אוקיי / bare כן alone) → set action ${handoffAction} NOW in the same JSON — short transfer line paired with action. Never re-ask phone or restart document intake. Never write מעביר/העברתי with action reply only. Thanks alone (no confirm) → remind they can write כן.`
    )
  }

  if (isHumanHandoffPending(history) && kbSelfServiceFaqThisTurn) {
    lines.push(
      "HANDOFF OFFER STALE — RETURN FAQ THIS TURN: customer pivoted to return/courier-fee policy (כמה יעלה / אתחרט / דמי משלוח). Answer from KB with action reply — do NOT treat trailing כן as handoff confirm. human_service only if they explicitly ask for a rep after the FAQ answer."
    )
  }

  const lastAssistant = lastNonInactivityAssistant(history)
  if (lastAssistant && hasDeclarativeHandoffTransfer(lastAssistant)) {
    lines.push(
      "You already told the customer you are transferring — if action is still reply, set human_service or human_sales immediately (same turn or next). Never repeat transfer prose without the matching action."
    )
  }

  const greetingAfterDocumentDelivery =
    lastAssistantWasOutboundDocumentDelivery(history) &&
    (isCasualGreeting(body) || isCasualSmallTalk(body))

  if (greetingAfterDocumentDelivery) {
    lines.push(
      'FRESH START after invoice/receipt delivery: customer said hello to begin anew — mirror hello warmly (e.g. "היי! 😊") and ask how you can help. NOT a thanks wrap-up — never "בשמחה! אם יעלה עוד משהו".'
    )
  }

  if (
    !greetingAfterDocumentDelivery &&
    (isNonSubstantiveFollowUp(body) || isCasualSmallTalk(body))
  ) {
    lines.push(
      'WAIT PING (? / ?? / הלו?): customer checks if anyone is still here — apologize briefly for any delay, confirm you are here, ask how to help. Do NOT say they reached the wrong company. Old invoice billing names (e.g. business name on receipt) or third-party auto-replies in thread history do NOT mean misdirected contact — they are still HoM customers.'
    )
  }

  if (lastAssistant && endsWithOptionalFollowUpOffer(lastAssistant)) {
    lines.push(
      'WARM CLOSE SENT: your last message already closed warmly (שמחתי לעזור…) — never write "עדיין כאן?" or ask "אפשר לעזור במשהו נוסף?". Customer thanks → action end with the same warm close; new business on a later message = fresh turn.'
    )
  }

  if (
    isThanksAcknowledgment(body) &&
    !isHumanHandoffPending(history) &&
    !isOrderConfirmationPending(history)
  ) {
    lines.push(
      "THANKS AFTER RESOLVED THREAD: customer is closing — reply with warm close only (`{name}, שמחתי לעזור היום! 😊`), action end, expects_reply false. Never ask במה עוד אוכל לעזור."
    )
  }

  if (isInactivityPingPending(history) && (isHumanHandoffPending(history) || /^(?:כן|בטח|אשמח|yes)/i.test(body.trim()))) {
    lines.push(
      'INACTIVITY PING BINDING: the last bot message was "עדיין כאן?" — treat short affirmations (כן/בטח/אשמח) as answering the **prior** substantive question (handoff confirm, intake summary, order confirm), NOT as a fresh "still here" ack. On handoff confirm → set action human_sales or human_service immediately.'
    )
  }

  if (
    !kbSelfServiceFaqThisTurn &&
    (isHumanHandoffPending(history) ||
      isConfirmationPending(history) ||
      (isServiceHandoffSummaryPending(history) && isServiceHandoffSummaryConfirmed(body)))
  ) {
    const handoffAction = inferHumanHandoffAction(history, null)
    if (!isHumanAgentTeamOnline(handoffAction)) {
      lines.push(
        "AFTER-HOURS HANDOFF: reps are offline. Set action human_sales or human_service and leave reply EMPTY — the system sends one offline notice automatically. Do NOT write transfer lines (מעביר ליועץ / יחזור אליכם / ניצור קשר) — they duplicate the system message."
      )
    }
  }

  if (historyShowsHomInvoiceBillingName(history)) {
    lines.push(
      "Thread includes HoM purchase invoice to a business billing name — the person chatting may be that business's contact. This IS the correct HoM WhatsApp for their carpet order. Never redirect to another company unless they explicitly say they meant someone else."
    )
  }

  if (isServiceHandoffSummaryPending(history)) {
    if (isServiceHandoffSummaryConfirmed(body)) {
      const intake = extractServiceIntake(history, body)
      lines.push(
        `Service summary was already approved. Do NOT repeat the previous recap/bullets. Reply with one short transfer sentence, set action \`human_service\`, and include only this compact rep note: ${buildServiceRepGoalNote(intake)}`
      )
    } else {
      lines.push(
        "Waiting for customer to confirm service summary (אני צודק?). Treat confirmation semantically (including slang/short affirmations), not as exact keywords. If they correct details, update summary and ask again; if they confirm, action human_service."
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
        "You asked 'אני צודק?' on post-purchase intent. Treat affirmation/decline semantically (slang and short replies count). On affirmation continue the matching playbook."
      )
    }
  }

  const postPurchaseKind = classifyPostPurchaseCase(body)
  if (postPurchaseKind === "defect") {
    lines.push(
      "Defect / damage report: empathize and describe what you see or what they reported — never confirm 'מדובר בפגם' or 'פגם מלכתחילה'. Rep bullet: דיווח על בעיה / חשש (לפי הלקוח). Human verifies liability."
    )
  }

  if (isDefectReplacementStatusQuestion(body, history)) {
    lines.push(
      "DEFECT REPLACEMENT STATUS: open service case — customer asks when the defective-item replacement happens / no answer yet. This is NOT post-purchase alt-size or sales exchange intake. Brief empathize → lookup_order_status if you need מס׳ הזמנה → rep summary → human_service. Never 'אותו דגם במידה אחרת' or document type menu."
    )
  }

  if (isCallbackUrgencyRequest(body)) {
    lines.push(
      "CALLBACK URGENCY: customer demands an urgent phone call — empathize briefly, do NOT loop phone confirm or document intake. Service rep summary if context exists → action human_service in the same JSON (transfer wording must match action)."
    )
  }

  if (
    isShippingStatusQuestion(body) &&
    !isServiceOrderIdentificationFlow(history, body)
  ) {
    lines.push(
      "ORDER STATUS OPENING (532163951 / 532360395): delivery/shipment tracking — lookup_order_status → confirm → live status. \"לא קיבלתי את השטיח\" without רק/חסר/חלק is NOT missing_item. After confirm, if a line is Pre Order: explain that הזמנה מוקדמת means the item was not in stock as stated on the order page, so we expect חידוש מלאי around preorder_reqdate. Close with אם יש משהו נוסף שאוכל לעזור בו, אני כאן 😊 and action end — not שמחתי לעזור, not human_service just because delivery status is empty."
    )
  }

  if (
    postPurchaseKind === "return_pickup_pending" &&
    !isReturnPickupAwaitingThread(history, body) &&
    !isShippingStatusQuestion(body) &&
    !isOrderDeliveryStatusQuestion(body)
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

  if (
    isOrderNumberRequestPending(history) &&
    (isOrderReferencePresentation(body) || extractOrderNumber(body))
  ) {
    lines.push(
      "ORDER ID BINDING: customer answered your order-number ask with SO/IN/OV (even if labeled חשבונית/הזמנה) — call lookup_order_status with that reference now. NOT fetch_digital_document, NOT 'איזה סוג חשבונית'."
    )
  }

  if (isOrderConfirmationPending(history) && !isReturnPickupAwaitingThread(history, body)) {
    if (kbSelfServiceFaqThisTurn) {
      lines.push(
        "ORDER CONFIRM + KB FAQ: customer confirmed (or is confirming) the order card AND asks policy (fees/eligibility/care) — answer from KB first. Trailing כן/כן כן binds to the FAQ answer, NOT a stale handoff offer. action reply unless they explicitly ask for a rep."
      )
    } else if (isServiceOrderIdentificationFlow(history, body) && !kbSelfServiceFaqThisTurn) {
      lines.push(
        "SERVICE ORDER ID: lookup was only to identify מס׳ הזמנה for an open service/quality issue (defect, shedding, photos). After customer confirms the order card → אז מסכם את הפנייה (rep bullets) → אני צודק? → human_service. Never shipping status, never אפשר לעזור במשהו נוסף as the main answer."
      )
    } else {
      lines.push(
        "Order/shipment lookup in progress — bind short confirmations or corrections semantically to the pending lookup, not a new topic. Never repeat the order card."
      )
    }
  }

  if (isOrderConfirmationPending(history) && userProvidedPhone(body)) {
    lines.push(
      "Customer sent a phone number during order confirmation — call lookup_order_status with that number immediately; do not repeat the rejected order card."
    )
  }

  if (isOrderLookupPhoneReplyPending(history) && userProvidedPhone(body)) {
    lines.push(
      "Customer sent the correct/alternate phone for order lookup — call lookup_order_status immediately with that number; do not re-ask channel phone."
    )
  }

  if (
    input.whatsappPhone &&
    !channelPhone(input.whatsappPhone) &&
    isShippingStatusQuestion(body)
  ) {
    lines.push(
      "WhatsApp channel phone is not a valid Israeli mobile — ask for the order phone or accept the number the customer typed; never treat the channel id as lookup phone."
    )
  }

  if (isOrderStatusDeliveredInThread(history) && isIdentifiedOrderRejection(body)) {
    lines.push(
      "WRONG ORDER after status: the customer is saying the identified order is not the one they meant (even if they first said yes). Call lookup_order_status now so the next unused order from the same phone API list can be offered. Do not ask them to invent a new order number first. If every candidate was already rejected, offer a human."
    )
  } else if (
    isOrderStatusDeliveredInThread(history) &&
    (isDeliveryEstimateQuestion(body) || isOrderDeliveryStatusQuestion(body))
  ) {
    lines.push(
      "Order already identified this thread — do NOT call lookup_order_status again or re-ask phone. Delivery estimate (צפי) → policy by status code only; never invent a calendar date."
    )
  }

  if (isPreorderEtaSharedInThread(history)) {
    lines.push(
      "PREORDER ETA UNSATISFIED (511324782): last status was הזמנה מוקדמת + date. If they push back (לא / לא מתאים / רוצה שירות / או לבטל) — action human_service + short transfer to נציג שירות only. Never \"אין בעיה, אפשר לבטל\", never \"נטפל בביטול\", never write that the wait לא מתאימה and then sell cancel. The rep owns wait vs cancel."
    )
  }

  if (isOrderLookupCompletedInThread(history)) {
    lines.push(
      "ORDER LOOKUP COMPLETED: order card already confirmed — NEVER call lookup_order_status or re-ask phone unless refreshing status for a new shipping question. Never say 'כבר מצאנו את ההזמנה' — customer does not care. Never offer unsolicited ביטול/החזרה/העברה menus — let them state intent. Shipping follow-ups (מתי יגיע/יסופק, עבר שבוע, מי חברת השליחויות) → answer from last status + policy; courier name unavailable in ERP → say so + optional rep. Rep request (העברה לנציג / נציג שירות) → human_service immediately. Return menu 1/2 after policy → portal/courier instructions from KB, not lookup."
    )
  }

  if (isOrderStatusDeliveredInThread(history) && isPostOrderShippingFollowUp(body, history)) {
    lines.push(
      "POST-ORDER SHIPPING THREAD (529503176 / 531893004): customer still on delivery timing/status — continue that thread. Do NOT pivot to cancel/return/exchange menus. A complete status answer (בדרך, נארז, השליח יתאם, מוכן לאיסוף) is the whole reply — action reply, never append האם להעביר לנציג. human_service only when they ask for a rep, status is unknown, or the system says נמסר and they say it did not arrive."
    )
  }

  lines.push(
    "ORDER REFERENCE GROUND RULE: when getOrders returns REFERENCE (#76736 / 76736), that is the customer order number — never show Priority ORDNAME (SO260…) in replies when REFERENCE is set."
  )

  const orderStyle = customerOrderNumberStyleFromHistory(history, body)
  if (orderStyle) {
    const styleHint =
      orderStyle === "hash"
        ? "#76884-style"
        : orderStyle === "digits"
          ? "bare digits (76884)"
          : "SO26005938-style"
    lines.push(
      `Customer uses ${styleHint} order IDs — when Priority REFERENCE is set use REFERENCE (#76736), not SO ORDNAME; otherwise keep this format every reply.`
    )
  }

  if (isExplicitExchangeExecutionTurn(body, history)) {
    lines.push(
      "EXPLICIT EXCHANGE EXECUTION: customer chose/wants החלפה — stay on exchange intake only (lookup_order_status → A/B/C quiz → create_switch_request). **Never** returns.carpetshop.co.il portal, **never** החזרה וביטול paths, **never** combined return+exchange policy in the same reply."
    )
  } else if (shouldOfferReturnOptionsFirst(body, history)) {
    lines.push(
      "RETURN OPTIONS FIRST: bare return or dissatisfaction without defect — open with the two-option playbook (exchange + sales advisor; return via branch/courier + returns portal). Never ask for order number on this turn. Never lookup_order_status until they choose return execution or pickup-wait service."
    )
  } else if (isDissatisfactionMenuPending(history)) {
    lines.push(
      "EXCHANGE INTAKE MENU PENDING: bind החלפה semantically to exchange execution quiz; bind החזרה to portal/branch return path only. Never create_switch_request on this turn."
    )
  } else if (isExchangeOrderRequired(history)) {
    lines.push(
      "EXCHANGE ORDER REQUIRED: customer chose החלפה — call lookup_order_status until order card is confirmed. No create_switch_request yet."
    )
  } else if (needsExchangeKindQuestion(history)) {
    lines.push(
      "EXCHANGE KIND PENDING: order confirmed — ask ONE question to classify A (same model, new color) / B (same model+color, new size) / C (different model). Accept paraphrases."
    )
  } else if (isExchangeKindPending(history)) {
    lines.push(
      "EXCHANGE KIND PENDING: classify the customer's reply as same_model_color / same_model_size / different_model this turn."
    )
  } else if (isExchangeSkuPending(history)) {
    lines.push(
      "EXCHANGE SKU PENDING (A/B): ask target SKU once gently — no consulting, no inventory lookup. If customer cannot find SKU, acknowledge and proceed without pushing."
    )
  } else if (isExchangeReasonPending(history)) {
    lines.push(
      "EXCHANGE REASON PENDING (C): must ask מה לא אהבתם before create_switch_request; map to reasonCode changed_mind | quality_insufficient | different_from_website."
    )
  } else if (isExchangeReadyForSwitchRequest(history, body)) {
    lines.push(
      "EXCHANGE READY FOR API: call create_switch_request now with exchangeKind + optional targetSku (A/B) or reasonCode + customerReasonText (C). On success reply with AB- id and action human_sales in same JSON."
    )
  } else if (isExchangeIntakeActive(history)) {
    lines.push(
      "Exchange intake active: stay on החלפה execution — no returns portal, no sales-intake quiz, no service defect playbook."
    )
  } else if (isDissatisfactionRescuePending(history)) {
    lines.push(
      "Dissatisfaction rescue pending: return choice → portal self-service (link + steps + fees/timeline); exchange → order confirm + A/B/C quiz + create_switch_request. Never proactively offer human_service to open the portal — passive 'אם נתקעים…' only; human_service when they explicitly ask for נציג or are stuck."
    )
  } else if (isDissatisfactionWithoutDefect(body)) {
    lines.push(
      "Dissatisfaction without defect: use the two-option playbook (exchange + sales advisor offer; return via branch/courier + returns portal). Never 'מצב לא נעים' or numbered emoji bullets."
    )
  }

  if (postPurchaseKind === "return_request" && !shouldOfferReturnOptionsFirst(body, history)) {
    lines.push(
      "Return execution after options: portal self-service — link + how (branch/courier) + refund timeline. Never 'רוצים שאעביר… לפתוח את הבקשה'. Passive help if stuck; human_service only on explicit rep request or portal failure — not pickup-wait (that uses advanced service playbook)."
    )
  }

  if (isReturnPortalSelfServiceThread(history) && /(?:החזר|זיכוי|הובלה|שליח|ביטול|פורטל|מעוניין|שטיח)/i.test(body)) {
    lines.push(
      "RETURN PORTAL SELF-SERVICE (530914111): continue guiding portal steps — no proactive handoff to open the request. Close with passive safety net: 'אם נתקעים בפתיחת הבקשה — אפשר לכתוב כאן ונעזור.' Bare כן after that is acknowledgment, not handoff confirm."
    )
  }

  if (isReturnShippingFeeQuestion(body)) {
    lines.push(
      "RETURN SHIPPING FEE FAQ (507969015): answer from KB — branch return free; home courier pickup paid by rug size (85–300 ₪ per direction). If order size known from confirm card, quote that tier; else give the size table briefly. 14 days from receipt, unused + original packaging, portal mandatory. action reply — NOT human_service. After-hours does NOT block FAQ answers; reps offline is not a reason to skip the fee table."
    )
  }

  if (isReturnEligibilityQuestion(body, history)) {
    lines.push(
      "Return ELIGIBILITY FAQ (hypothetical — not executing a return now): answer immediately from return policy — 14 days from receipt, unused + original packaging, branch or paid courier, returns portal to open the request. Confirm their planned day (e.g. Sunday) is within the window. Do NOT call lookup_order_status."
    )
  } else if (isReturnExchangePolicyFaqQuestion(body) && !postPurchaseKind) {
    lines.push(
      "CANCELLATION/RETURN POLICY FAQ: include BOTH execution paths — (1) return at network branch (free), (2) home pickup via courier (paid by rug size from KB). Portal is mandatory to open the request (even for branch returns); link with phone prefill when known. Also: 14 days, ללא שימוש באריזתו המקורית, refund up to 7 business days from cancellation. Never portal-only; never 'אפשר לפתוח בקשה'. Exchanges → branch/courier fees — never portal."
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
      "Carpet rental / try-before-buy (customer asked explicitly): answer from KB (case-by-case via sales advisor). Never 'אין לי מידע' or branch hours dump. Never volunteer rental when comparing product links."
    )
  }

  if (isTradeInQuestion(body)) {
    lines.push(
      "TRADE-IN (478627132): no טרייד אין / trade-in program — one short line from KB only. Never mention תיקון שטיחים or repair (not in KB). Never unprompted exchange/return/14-day policy. Product inquiry thread → continue sales intake after answering."
    )
  }

  if (isRugCleaningServiceQuestion(body) || isOwnedRugCareQuestion(body)) {
    lines.push(
      'RUG CLEANING / CARE FAQ (שירות): wash, stain, pee, or "do you clean rugs?" on a rug they have — `"crm_department": "service"`. HoM does not clean rugs or neutralize odor in-house. Answer warmly from carpet-products-faq — pro dry cleaning for general care; spot clean with alcohol-free wipe or microfiber + warm water + dish soap. React first (שאלה טובה / הבנתי), everyday Hebrew — never אין לי מידע על, מטעם החברה, or לא שירות שאנחנו מבצעים בעצמנו. Simple care FAQ — no proactive handoff; passive close only.'
    )
  }

  if (isCarpetPackagingOpenQuestion(body)) {
    lines.push(
      "CARPET PACKAGING FAQ: answer from carpet-products-faq (כיצד לפתוח את האריזה) — cut plastic edge carefully with scissors, remove rug and corner guards, remove tape; never sharp objects on the rug. Warm tone (שאלה טובה). Not return-policy 'באריזה המקורית'. action: reply — no handoff."
    )
  }

  if (
    extractSku(body) &&
    shouldHandleBranchInventory(body, history) &&
    !isPostPurchaseAlternateSizeThread(history, body)
  ) {
    lines.push(
      "INVENTORY SKU PROVIDED: customer sent a valid מק״ט — call lookup_inventory (or use the structured result). Never re-ask for מק״ט, never say you cannot check stock, never jump to human_sales while a lookup is possible."
    )
  }

  if (isRefundTimelineQuestion(body)) {
    lines.push(
      "Refund timeline: up to 7 business days from cancellation date — not from warehouse/branch receipt."
    )
  }

  if (isMembershipClubCheckoutQuestion(body)) {
    lines.push(
      "MEMBERSHIP / RELOADABLE CHECKOUT: answer SHORT from membership-clubs-payments KB — if their program is listed, confirm we work with it; completing the order with that card usually needs a service rep (like קוד זיכוי). Offer human_service — never a long payment-methods dump, never 'אין לי מידע'. If they ask נציג אנושי → handoff immediately."
    )
  }

  if (isCouponCodeRequest(body)) {
    lines.push(
      "COUPON CODE: call get_campaigns now. Share coupon_code from API only for **active** campaigns (valid dates). Never invent codes. Never say 'לא הבנתי' on קוד הנחה / typos like הנלה — treat as coupon ask."
    )
  }

  if (postPurchaseKind === "missing_item") {
    lines.push(
      "MISSING ITEM / PARTIAL DELIVERY: service case, NOT document copy. lookup_order_status → order confirm (no product list on card) → after כן, if order has line items show numbered pick for missing product → rep summary with פריט חסר → human_service. Never fetch_digital_document."
    )
  }

  const forwardedWeezmo =
    isOutboundDocumentDeliveryMessage(body) ||
    history.some(
      (message) =>
        message.role === "user" && isOutboundDocumentDeliveryMessage(message.content)
    )
  const forwardedWeezmoOrder =
    extractOrderNumber(body) ??
    history.reduce<string | null>((found, message) => {
      if (found || message.role !== "user") return found
      return extractOrderNumber(message.content)
    }, null)

  if (forwardedWeezmo && !isDigitalDocumentRequest(body)) {
    lines.push(
      forwardedWeezmoOrder
        ? `FORWARDED WEEZMO TEMPLATE: customer pasted the automated receipt+tracking SMS (documents.carpetshop.co.il). This is order context, not a request for another copy. Do not open איזה סוג מסמך and do not call fetch_digital_document from this paste. Tracking order is ${forwardedWeezmoOrder} — if they ask about the order or delivery, lookup_order_status with that id. If they only forwarded it, ack briefly and ask how you can help.`
        : "FORWARDED WEEZMO TEMPLATE: customer pasted the automated receipt+tracking SMS (documents.carpetshop.co.il). This is order context, not a request for another copy. Do not open איזה סוג מסמך and do not call fetch_digital_document from this paste. If they ask about the order or delivery, lookup_order_status. If they only forwarded it, ack briefly and ask how you can help."
    )
  }

  if (
    (isDigitalDocumentRequest(body) || isActiveDigitalDocumentFlow(history, body)) &&
    !shouldReleaseStructuredDocumentFlow(history, body)
  ) {
    lines.push(
      "DOCUMENT COPY (קבלה / חשבונית / העתק): fetch_digital_document only — getDocument API by phone. Never lookup_order_status or getOrders for invoice/receipt requests."
    )
  }

  if (
    shouldDeferDocumentFlowToOrderLookup(history, body) &&
    isPhoneLookupConfirmPending(history)
  ) {
    lines.push(
      "SHIPPING / PICKUP STATUS: customer asked when an order arrives or branch pickup — NOT a document copy request (even if they said זה הקבלה with a receipt ref). On phone confirm (כן / זה המספר / כן!!) call lookup_order_status with channel phone immediately — never repeat phone confirm or ask document type."
    )
  }

  if (
    outboundDocumentDeliveryInThread(history) &&
    (isDigitalDocumentRequest(body) || activeDigitalDocumentRequest(history))
  ) {
    lines.push(
      "ERP RECEIPT ALREADY SENT: automated Weezmo receipt/invoice template with documents.carpetshop.co.il link already in thread — confirm the link above; receipt is fulfilled even if getDocument failed. NEVER re-ask phone or repeat document intake questions. If you offered human handoff and customer confirms (כן / כן אני אשמח) → human_service immediately."
    )
  }

  if (isDeliverySchedulingPreferenceQuestion(body)) {
    lines.push(
      "DELIVERY SCHEDULING: ≤3 sentences — carrier calls on delivery day; cannot pre-book exact date/time; deferred requests (מיום X ואילך) are noted but not scheduled in advance — offer order # lookup or *3076. Complete message with punctuation; never cut off mid-sentence."
    )
  }

  if (isPostPurchaseAlternateSizeThread(history, body)) {
    lines.push(
      "POST-PURCHASE ALT SIZE: customer wants the same model in another size after ordering/receiving — **human_sales**, not lookup_inventory. You cannot read מק״ט from photos or payment screenshots. Never loop asking for מק״ט when they reference their order (הזמנה / רכשתי היום). Brief exchange policy OK, then offer יועץ מכירות to check availability against their order."
    )
  }

  if (isActiveInventoryThread(history) || isInventoryRecheckRequest(body)) {
    lines.push(
      "Inventory thread (sales flow): re-check another item → ask for a **new** מק״ט; after results offer human_sales if they want to buy. **Color variants at a branch** → human_sales only, never list colors. When requested branch shows no stock but another branch/warehouse has qty, name where they can order from."
    )
  }

  if (
    /\[media:image:/i.test(body) &&
    (isSalesPhotoRequestPending(history) ||
      hasOngoingSalesIntake(history) ||
      hasRoomPhotoInHistory(history))
  ) {
    lines.push(
      "SALES ROOM PHOTO: reference for the human advisor only — **one** ack line (תודה, קיבלתי את התמונה — אעביר ליועץ העיצוב), then next intake step (usually דרישות מיוחדות). Never stack a second קיבלתי/אוקיי קיבלתי and never re-ask for a photo they just sent. Do NOT describe/analyze the image."
    )
  }

  if (isAwaitingSalesIntakeAnswer(history) && hasOngoingSalesIntake(history)) {
    lines.push(
      salesIntakeMode() === "llm"
        ? "SALES INTAKE QUIZ (LLM-led): you asked the last intake question — interpret their answer in thread context; never re-ask room/product already stated. On לא יודע/לא בטוח: reassure, note for advisor, advance (pets → photo → practical → summary+human_sales). Never replay canned script blocks verbatim."
        : "SALES INTAKE QUIZ: the bot asked a scripted intake question — answer it and advance to the next step (room photo, דרישות מיוחדות, or confirmation summary). Always a complete Hebrew question or summary — never stub words like placeholder/TODO."
    )
  }

  const salesIntake = extractSalesIntake(history, body)
  if (
    /חדר\s+ילדים/i.test(salesIntake.targetSpace ?? body) &&
    !salesIntake.childrenAge
  ) {
    lines.push(
      'Kids room sales intake: ask "מדובר בילדים קטנים, גדולים, או גם וגם?" BEFORE room dimensions or rug size. Use KB (carpet-terminology): small children → easy-clean / כביס-רחיץ for the advisor note — do not jump straight to measurements.'
    )
  }

  return lines.length > 0 ? lines.map((line) => `- ${line}`).join("\n") : null
}

function splitQuestionParts(body: string) {
  return body
    .split(/\n+|(?<=\?)/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 6)
}

function historyShowsHomInvoiceBillingName(history: HistoryMessage[]) {
  return history.some(
    (message) => isOutboundDocumentDeliveryMessage(message.content)
  )
}

function isDeliverySchedulingPreferenceQuestion(body: string) {
  const text = body.trim()
  if (!text || text.length > 200) return false
  return (
    /(?:מ|מ)?(?:יום|ה)?(?:יום\s+(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(?:\s+ו(?:אילך|הלאה))?|ואילך|הלאה)/i.test(
      text
    ) ||
    /(?:ל(?:קבוע|תאם)|ב(?:וקר|ערב)|שע(?:ה|ות)\s+מ(?:דויק|סוימ)|מועד\s+(?:משלוח|מסירה|אספקה))/i.test(
      text
    )
  )
}

function lastNonInactivityAssistant(history: HistoryMessage[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    if (isInactivityAssistantMessage(message.content)) continue
    return message.content
  }
  return ""
}
