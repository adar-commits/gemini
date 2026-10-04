import { salesIntakeMode } from "@/lib/agent-core/config"
import {
  channelPhone,
  extractOrderNumber,
  isChannelPhoneSelfReference,
  customerOrderNumberStyleFromHistory,
  isDeliveryEstimateQuestion,
  isKnownOrderConfirmPending,
  classifyDocumentNumber,
  isOrderConfirmationNo,
  isOrderConfirmationPending,
  isOrderConfirmationYes,
  pendingOrderNumberFromHistory,
  isOrderDeliveryStatusQuestion,
  isOrderLookupPhoneReplyPending,
  isOrderNumberRequestPending,
  isOrderReferencePresentation,
  isIdentifiedOrderRejection,
  isOrderLookupCompletedInThread,
  documentReferenceGivenInThread,
  mentionsCancellationDesire,
  orderIdGivenInThread,
  isShippingAddressUpdateThread,
  isPreorderEtaSharedInThread,
  isPostOrderShippingFollowUp,
  isShippingThreadFromHistory,
  isOrderStatusDeliveredInThread,
  historyHasOrderPickExhaustedRecheck,
  isPhoneLookupConfirmPending,
  orderPhoneNamedByAssistant,
  isServiceOrderIdentificationFlow,
  userProvidedPhone,
} from "@/lib/agents/order-lookup"
import { isDesignCenterLocationQuestion } from "@/lib/agents/branches"
import { customerExplicitlyRequestsHuman } from "@/lib/agents/kb-self-service-faq"
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
  hasCatalogIntakeSizeAndRoom,
  isCatalogProductInquiry,
  isColorVariantRealPhotoRequest,
  isHomStorefrontUrl,
  extractRequestedModel,
  isActiveProductSalesPrepThread,
  isProductDetailsRequest,
  isProductInventoryQuestion,
  isProductSpecDeferredToAdvisorInThread,
  isSalesTransferPromisedInLastAssistant,
  isSpecificProductMention,
  isCheckoutPriceDiscrepancyThread,
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
import { salesOutreachTemplateInThread } from "@/lib/agents/sales-outreach"
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
import { isPoufAssemblyFaqThread } from "@/lib/agents/kb"
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
  extractRecentSku,
  extractSku,
  hasPendingBranchDisplayQuestion,
  isActiveInventoryThread,
  isBackInStockNotificationRequest,
  isInventoryRecheckRequest,
  isSkuRequestPending,
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
  isActiveCourierWrongAddressReport,
  isCancelShipmentConfirmPending,
  isOrderCancellationSummaryLabel,
  isPostPurchaseServiceFlow,
  isReturnPickupAwaitingThread,
  isServiceHandoffSummaryConfirmed,
  isServiceHandoffSummaryPending,
  isServiceHandoffSummaryText,
} from "@/lib/agents/service-intake"
import {
  isPostPurchaseAlternateSizeThread,
  isShippingAddressChangeAsk,
} from "@/lib/agents/post-purchase-alt-size"
import {
  extractSalesIntake,
  hasOngoingSalesIntake,
  hasRoomPhotoInHistory,
  isAwaitingSalesIntakeAnswer,
  isBedRugSizingConsultation,
  isSalesIntakeCompleteWithOptionalPhotoPending,
  isSalesPhotoRequestPending,
  isServicePhotoAnalysisContext,
} from "@/lib/agents/sales-intake"
import {
  isOrderDocumentScreenshotTurn,
  shouldAnalyzeCustomerImage,
} from "@/lib/agents/vision-policy"
import type { UserTurn } from "@/lib/agents/user-turn"
import {
  isInactivityAssistantMessage,
  isInactivityPingPending,
  isInactivityStillHereReply,
} from "@/lib/agents/inactivity"
import { isHumanAgentTeamOnline } from "@/lib/agents/human-agent-hours"
import { isPostHumanHandoff, postHandoffKind } from "@/lib/agents/post-handoff"
import {
  customerRespondedToHandoffWithoutConfirm,
  hasDeclarativeHandoffTransfer,
  inferHumanHandoffAction,
  isHumanHandoffAffirmation,
  isHumanHandoffDecline,
  isHumanHandoffPending,
} from "@/lib/agents/off-topic"
import { isConfirmationPending, isSalesFinalSummaryPending } from "@/lib/agents/sales-intake"
import {
  BOT_VOICE_NO_MIRROR_HINT,
  customerUsesFeminineSelfReference,
} from "@/lib/agents/bot-voice"
import type { HistoryMessage } from "@/lib/agents/types"
import { isVoiceClosureTemplateMessage } from "@/lib/landbot/voice-closure-template"

function isVoiceClosureTemplateLastAssistant(history: HistoryMessage[]) {
  const lastAssistant = [...history].reverse().find((message) => message.role === "assistant")
  return isVoiceClosureTemplateMessage(lastAssistant ? { body: lastAssistant.content } : null)
}

function isReturnPortalSelfServiceThread(history: HistoryMessage[]) {
  return history.some(
    (message) =>
      message.role === "assistant" && /returns\.carpetshop\.co\.il/.test(message.content)
  )
}

function userTurnFromBody(body: string): UserTurn {
  const media: UserTurn["media"] = []
  for (const match of body.matchAll(/\[media:image:([^\]]+)\]/gi)) {
    const url = match[1]?.trim()
    if (url && !media.some((part) => part.url === url)) {
      media.push({ kind: "image", url })
    }
  }
  const text = body.replace(/\[media:image:[^\]]+\]/gi, "").trim()
  return { text, media }
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
  const poufAssemblyFaqThread =
    isPoufAssemblyFaqThread(history) && !hasOngoingSalesIntake(history)

  if (poufAssemblyFaqThread) {
    lines.push(
      'POUF ASSEMBLY FAQ (533487147): active post-purchase assembly / filling help — stay FAQ (`action: reply`). Answer from pozitive KB + tutorial link. Photo + assembly question (ניילון, מילוי, שלב) is **not** sales — never "לאיזה חלל", never יועץ עיצוב, never sales intake or `crm_department: sales`. Offer `human_service` only when KB cannot answer and the customer agrees.'
    )
  }

  if (isFirstSubstantiveCustomerTurn(history)) {
    lines.push(
      "FIRST CUSTOMER MESSAGE: interpret their full intent with LLM + tools this turn — no structured FAQ/order shortcuts. Answer what they actually asked; call lookup_order_status only when they ask about an existing order/shipment — never for a product page or פרטים נוספים."
    )
  }

  if (isDesignCenterLocationQuestion(body)) {
    lines.push(
      'DESIGN-CENTER LOCATION FAQ (533900683): "inside design center" / מרכז עיצוב = yes/no — are our stores inside design-center complexes? Answer yes with examples from get_branch_info (e.g. Kiryat Ata in Redesign). If no city named, ask which branch/city they plan to visit — never "Which design center did you mean?" and never assume one branch from CRM name alone. Match customer language (Hebrew/English). action: reply.'
    )
  }

  if (isCatalogProductInquiry(body, history) || isHomStorefrontUrl(body) || isProductDetailsRequest(body)) {
    lines.push(
      'CATALOG PRODUCT (מכירות): carpetshop.co.il / pozitiveshop.co.il link or Landbot "פרטים נוספים לגבי …" is a product they saw on the site — not an order. Never lookup_order_status / phone-confirm. Set `"crm_department": "sales"`, answer from KB or continue sales intake (room / photo / advisor). A photo asking about the model shape belongs here too.'
    )
  }

  if (isColorVariantRealPhotoRequest(body, history) && !hasOngoingSalesIntake(history)) {
    lines.push(
      'COLOR VARIANT PHOTOS (533891498): customer hesitates between color variants or asks for real-life photos you cannot send — יועץ המכירות owns the comparison. Send bullet recap + `action: human_sales` + `crm_department: sales` in the **same** JSON when you write מעביר ליועץ מכירות — never `action: reply` alone (Action ↔ transfer wording). Optional room photo may be requested in the same message but must not block handoff.'
    )
  }

  if (isSalesTransferPromisedInLastAssistant(history)) {
    lines.push(
      'SALES TRANSFER PROMISED (533891498): you already wrote מעביר ליועץ מכירות — customer may add rooms, quantities, or photos. Update the advisor recap + set `action: human_sales` in the **same** JSON now. Never stay on reply/faq while they wait for the rep.'
    )
  }

  if (
    isCatalogProductInquiry(body, history) &&
    isProductSpecDeferredToAdvisorInThread(history) &&
    hasCatalogIntakeSizeAndRoom(history, body)
  ) {
    lines.push(
      'PRODUCT SPEC DEFERRED (533758736): you already said יועץ המכירות will verify a spec (e.g. משקל) you lack — customer gave size + room. Send advisor recap + `action: human_sales` in the **same** JSON now (מעביר ליועץ מכירות). Do **not** ask sofa size, pets, or photo — the advisor owns the spec check.'
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

  if (isVoiceClosureTemplateLastAssistant(history) && !isOrderConfirmationPending(history)) {
    const handoffKind = postHandoffKind(null, history) ?? "human_service"
    const departmentLine =
      handoffKind === "human_sales"
        ? "If they still need a rep, or you cannot resolve it, set action human_sales + crm_department sales in the same JSON — the prior handoff was to sales (441678247); ignore the template's 'שירות' wording."
        : "If they still need a rep, or you cannot resolve it, set action human_service in the same JSON."
    lines.push(
      `VOICE CALLBACK TEMPLATE (532661685): the last outbound ("כאן נציג/ה ... בהמשך לבקשתך לדבר עם נציג") is an automatic template sent after the customer chose, on a phone call, to keep waiting for a rep on WhatsApp — no rep has written yet. Answer their request normally this turn with tools (e.g. shipping status → lookup_order_status). Never stay silent and never ask a "זה מדויק?" summary confirmation. ${departmentLine}`
    )
  }

  if (isActiveCourierWrongAddressReport(body)) {
    lines.push(
      "ACTIVE COURIER WRONG ADDRESS (533569676): courier is en route but the address on the courier side is wrong — urgent service issue, NOT the 532692073 address-change KB. crm_department service. Call lookup_order_status when the order is not identified yet. If they say the address was fixed at purchase → acknowledge HoM error + human_service for urgent callback. Never reply with ONLY 077-9725055 / *3076 self-service without a service path."
    )
  }

  if (isShippingAddressUpdateThread(history)) {
    lines.push(
      "SHIPPING ADDRESS UPDATE (532692073): they want to change the delivery address — not shipment status. Answer from shipping-policy KB: an update is not always possible; it depends on whether the order was already handed to the courier. After handover there is a cost — WhatsApp 077-9725055 or *3076. Do NOT call lookup_order_status, do NOT send בדקתי / סטטוס משלוח, do NOT ask for the new address or an order number. action reply — never אעביר with action reply."
    )
  }

  if (salesOutreachTemplateInThread(history)) {
    lines.push(
      'SALES OUTREACH (533322535): rep already sent abandoned-cart outreach (מאיר / לא השלמת את הרכישה). This is מכירות — answer product/promotion/color hesitation directly or hand off with action human_sales + crm_department sales. Never never-stuck / לא הצלחתי להבין. Never human_service / נציג שירות — the assigned rep owns this lead.'
    )
  }

  if (isOrderModificationRequest(body)) {
    lines.push(
      'ORDER MODIFICATION (532165595 / 422622122): customer wants to change color/size on an existing order. Empathize → call lookup_order_status (phone confirm is OK). After status: **never** warm-close with שמחתי לעזור only — address the change in the same reply. Size/מידה/גודל while still in packaging → human_sales to update before ship. Color → exchange intake (kind A) after confirm. Never sales-intake quiz, never empty/"לא הצלחתי להבין".'
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
      'SALES THREAD (מכירות): new purchase / product inquiry / available sizes (e.g. יש יותר קטן?) — not שירות. Include `"crm_department": "sales"` in JSON this turn. When intake is complete, send recap + action human_sales in the **same** JSON (מעביר ליועץ מכירות) — never אני צודק? and never wait for approval.'
    )
  }

  if (isSalesIntakeCompleteWithOptionalPhotoPending(history)) {
    lines.push(
      'SALES RECAP + OPTIONAL PHOTO (533759845): intake quiz is done — you already sent recap + optional room photo. Customer photo, "שלחתי תמונה", thanks, or waiting → `action: human_sales` NOW (מעביר ליועץ מכירות) with brief ack. Optional photo never blocks handoff; never stay on reply/faq. Quote sofa/room sizes exactly as the customer wrote — never invent (e.g. 2 מ׳ רוחב ≠ 2.5 מ׳).'
    )
  }

  const serviceFlowActive =
    !isExchangeIntakeActive(history) &&
    (isServiceHandoffSummaryPending(history) ||
      isServiceOrderIdentificationFlow(history, body) ||
      isReturnPickupAwaitingThread(history, body) ||
      isPostPurchaseServiceFlow(history))

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
      "SERVICE SUMMARY PENDING: on customer confirm (כן/נכון/בדיוק/מדויק/כן תודה) set action human_service + crm_department service immediately — short transfer to נציג שירות only. Never human_sales / יועץ מכירות (this is the service recap, not a sales summary). If they stay silent, the system auto-assigns to שירות (no inactivity ping)."
    )
  }

  const multiOrderShippingCorpus = [...history.map((m) => m.content), body].join("\n")
  if (
    /(?:שתי|2|שני).*?(?:הזמנ|שטיח)|(?:הזמנה אחת|אחת נוספת|ההזמנה השנ)/i.test(
      multiOrderShippingCorpus
    ) &&
    /(?:צפי|מתי.*(?:מגיע|יגיע|אספקה)|סטטוס משלוח)/i.test(multiOrderShippingCorpus)
  ) {
    lines.push(
      "MULTI-ORDER DELIVERY ETA (532828502): two+ orders + delivery timing ask — if you cannot show ETA for all, send service rep summary with bullets + 'זה מדויק?' using **אעביר** (future) only — action reply + awaiting service_summary_confirm. Never אני מעביר/העברתי until they confirm; then human_service."
    )
  }

  const serviceSummarySent = history.some(
    (message) =>
      message.role === "assistant" &&
      (isServiceHandoffSummaryText(message.content) ||
        /זה מדויק(?:,|\s|$)/.test(message.content))
  )
  const serviceLabelPhotoReceived = history.some(
    (message) => message.role === "user" && /\[media:image:/i.test(message.content)
  )
  if (serviceSummarySent && serviceLabelPhotoReceived) {
    lines.push(
      "WRONG-ITEM PHOTO + SERVICE SUMMARY (533620279): wrong color/item thread — summary already sent and label photo received. If they ask open-or-not, advise briefly; if they ask timing (היום / הנהג עזב), say you cannot promise same-day — rep coordinates. Then set action human_service NOW with recap + photo note. Never defer with 'אחרי שתפתחי… ואז מעביר' while action stays reply; declarative מעביר = human_service same JSON."
    )
  }

  if (
    isHumanHandoffPending(history) &&
    customerRespondedToHandoffWithoutConfirm(history) &&
    !isHumanHandoffAffirmation(body) &&
    !isHumanHandoffDecline(body)
  ) {
    lines.push(
      "HANDOFF OFFER — NON-CONFIRM REPLY (533962351): customer answered the rep offer with a different message (not כן/לא) — fulfill their ask or warm-close. Visit intent + thanks (אגיע לשם / נגיע / אבוא) → `action: end` with בכיף/תתחדשi — **never** `human_sales`, never re-offer יועץ מכירות on the closing turn."
    )
  }

  if (
    isHumanHandoffPending(history) &&
    !kbSelfServiceFaqThisTurn &&
    !customerRespondedToHandoffWithoutConfirm(history)
  ) {
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
    !isOrderConfirmationPending(history) &&
    !(
      isOrderLookupCompletedInThread(history) &&
      isShippingThreadFromHistory(history)
    )
  ) {
    lines.push(
      "THANKS AFTER RESOLVED THREAD: customer is closing — reply with warm close only (`{name}, שמחתי לעזור היום! 😊`), action end, expects_reply false. Never ask במה עוד אוכל לעזור."
    )
  }

  const inactivityStillHere = isInactivityStillHereReply(body)
  const inactivityAffirmation =
    inactivityStillHere || /^(?:בטח|אשמח|yes)/i.test(body.trim())
  const bindInactivityToPrior =
    isHumanHandoffPending(history) ||
    isConfirmationPending(history) ||
    isAwaitingSalesIntakeAnswer(history) ||
    isOrderConfirmationPending(history) ||
    isServiceHandoffSummaryPending(history) ||
    isOrderLookupPhoneReplyPending(history)

  if (isInactivityPingPending(history) && inactivityAffirmation && bindInactivityToPrior) {
    lines.push(
      'INACTIVITY PING BINDING: the last bot message was "עדיין כאן?" — treat short affirmations (כן/יכן/בטח/אשמח) as answering the **prior** substantive question (handoff confirm, intake summary, order confirm), NOT as a fresh "still here" ack. On handoff confirm → set action human_sales or human_service immediately.'
    )
  }

  if (isInactivityPingPending(history) && inactivityStillHere && !bindInactivityToPrior) {
    lines.push(
      'INACTIVITY STILL-HERE ACK: "עדיין כאן?" with no open handoff/summary/order question — short "כן"/"יכן" means the customer is still here. Reply "אני כאן. איך אוכל להמשיך לעזור?", action reply. Never human_service/human_sales or rep-callback promises unless they ask again.'
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
        "AFTER-HOURS HANDOFF: reps are offline. If the customer confirms the transfer, set action human_sales or human_service; the system appends one offline notice at the end. In reply keep only what still helps (answer / recap) — do NOT write transfer lines (מעביר ליועץ / יחזור אליכם / ניצור קשר), they duplicate the notice. Nothing to add → empty reply."
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
        `Service summary confirm (533773292): customer approved — including confirm+addition (כן ו… / כן, להוסיף…). Set action \`human_service\` NOW — never warm-close or action end. Do NOT repeat the previous recap/bullets. Reply with one short transfer sentence and include this compact rep note: ${buildServiceRepGoalNote(intake)}`
      )
    } else {
      lines.push(
        "Waiting for customer to confirm the service summary. Treat confirmation semantically (including slang/short affirmations), not as exact keywords. If they correct details, update summary and ask again; if they confirm, action human_service."
      )
    }
  }

  if (
    isReturnPickupAwaitingThread(history, body) &&
    !isServiceHandoffSummaryPending(history) &&
    !isPostPurchaseIntentConfirmPending(history)
  ) {
    lines.push(
      "RETURN PICKUP WAIT (advanced service, not FAQ): identify order via lookup_order_status if needed, then rep-report bullets + summary check (awaiting service_summary_confirm) → human_service after confirm. Never tell customer outbound shipping/self-pickup status — rep handles pickup logistics."
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
    isCallbackUrgencyRequest(body) &&
    (isPostOrderShippingFollowUp(body, history) ||
      isShippingStatusQuestion(body) ||
      isOrderDeliveryStatusQuestion(body) ||
      isOrderLookupCompletedInThread(history))
  ) {
    lines.push(
      "CALLBACK URGENCY + SHIPPING (262348751): urgent phone callback while delivery is still open — brief empathize, answer shipping/status if you can, then action human_service + crm_department service. Never replay a stale sales intake summary or human_sales — this is שירות."
    )
  }

  if (
    isSalesFinalSummaryPending(history) &&
    (isCallbackUrgencyRequest(body) ||
      isShippingStatusQuestion(body) ||
      isOrderDeliveryStatusQuestion(body) ||
      isPostOrderShippingFollowUp(body, history))
  ) {
    lines.push(
      "STALE SALES SUMMARY: shipping/urgent service issue overrides an old sales אני צודק? recap — ignore the sales summary; route to service (lookup/status if needed → human_service). Never human_sales on this turn."
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
      `Customer confirmed the WhatsApp channel phone (${input.whatsappPhone}). Call lookup_order_status now — do not re-ask the same phone question. Never claim you cannot see status without running the tool (533526188).`
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

  const offeredOrders = ordersOfferedInLastAssistantQuestion(history)
  if (offeredOrders.length >= 2) {
    lines.push(
      `ORDER CHOICE BINDING (532138355): your last message asked which order to check (${offeredOrders.join(" / ")}). The customer's reply picks one of them (e.g. האחרונה / החדשה = the newest — higher SO number; הראשונה / השנייה = listed order). Call lookup_order_status now with lookupHint = the chosen order id. Do NOT ask the phone question and do NOT search the phone for a different order. Only if the pick is truly unclear, ask once which of these orders.`
    )
  }

  const namedOrderPhone = orderPhoneNamedByAssistant(history, input.whatsappPhone)
  if (namedOrderPhone && !isOrderLookupCompletedInThread(history)) {
    lines.push(
      `ORDER PHONE ALREADY NAMED (533137123): the order phone is ${namedOrderPhone}, already read from their payment image or receipt. Call lookup_order_status now for that phone — pass it as lookupHint. "לאתר לפי הטלפון" means that number, not the WhatsApp chat number. Never say you searched the chat number unless the tool ran on it. A phone they type replaces it. The model stays on this turn; do not wait for a structured phone-confirm.`
    )
  }

  if (
    customerExplicitlyRequestsHuman(body) &&
    !isHumanHandoffPending(history) &&
    !isPostHumanHandoff(null, history)
  ) {
    lines.push(
      "EXPLICIT REP REQUEST: customer asks for a human (נציג / מענה אנושי / לא בוט) — set action human_service or human_sales NOW in the same JSON. Never never-stuck fallback on this turn."
    )
  }

  if (isOrderConfirmationPending(history) && !isReturnPickupAwaitingThread(history, body)) {
    if (isExchangeIntakeActive(history)) {
      if (isOrderConfirmationYes(body)) {
        lines.push(
          "EXCHANGE ORDER CONFIRM YES (530876768): order card confirmed during exchange intake — ask ONE A/B/C exchange-kind question now (action reply). Do NOT call lookup_order_status again. Do NOT service rep summary or human_service — stay on החלפה → create_switch_request → human_sales."
        )
      } else {
        lines.push(
          "EXCHANGE ORDER CONFIRM PENDING: bind short confirmations or corrections to the pending order card during exchange intake — call lookup_order_status only if they give a different order/phone. No service summary, no shipping status."
        )
      }
    } else {
      if (isOrderConfirmationYes(body)) {
        lines.push(
          "ORDER CONFIRM YES: כן/נכון/אוקיי confirms the pending order card — call lookup_order_status immediately with the bound order/phone. Never never-stuck on this turn."
        )
      }
      if (kbSelfServiceFaqThisTurn) {
        lines.push(
          "ORDER CONFIRM + KB FAQ: customer confirmed (or is confirming) the order card AND asks policy (fees/eligibility/care) — answer from KB first. Trailing כן/כן כן binds to the FAQ answer, NOT a stale handoff offer. action reply unless they explicitly ask for a rep."
        )
      } else if (isServiceOrderIdentificationFlow(history, body) && !kbSelfServiceFaqThisTurn) {
        lines.push(
          "SERVICE ORDER ID: lookup was only to identify מס׳ הזמנה for an open service/quality issue (defect, shedding, photos). After customer confirms the order card → rep summary bullets → summary check (awaiting service_summary_confirm) → human_service. Never shipping status, never אפשר לעזור במשהו נוסף as the main answer."
        )
      } else if (
        isOrderConfirmationYes(body) &&
        !isServiceOrderIdentificationFlow(history, body) &&
        (isShippingStatusQuestion(body) ||
          isOrderDeliveryStatusQuestion(body) ||
          history
            .filter((message) => message.role === "user")
            .slice(-4)
            .some(
              (message) =>
                isShippingStatusQuestion(message.content) ||
                isOrderDeliveryStatusQuestion(message.content)
            ))
      ) {
        lines.push(
          "SHIPPING ORDER CONFIRM YES (532732459): כן confirms the order card for delivery/status tracking only — call lookup_order_status and answer shipping status. Never invent dissatisfaction/service rep summary unless they stated a product/service complaint."
        )
      } else {
        lines.push(
          "Order/shipment lookup in progress — bind short confirmations or corrections semantically to the pending lookup, not a new topic. Never repeat the order card."
        )
      }
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
      "ORDER LOOKUP COMPLETED: order card already confirmed — NEVER call lookup_order_status or re-ask phone unless refreshing status for a new shipping question. Never say 'כבר מצאנו את ההזמנה' — customer does not care. Never offer unsolicited ביטול/החזרה/העברה menus — let them state intent. Shipping follow-ups (מתי יגיע/יסופק/יבוצע ההספקה, עבר שבוע, מי חברת השליחויות) → answer from last status + policy; courier name unavailable in ERP → say so + optional rep. Rep request (העברה לנציג / נציג שירות) → human_service immediately. Return menu 1/2 after policy → portal/courier instructions from KB, not lookup."
    )
  }

  if (isOrderStatusDeliveredInThread(history) && isPostOrderShippingFollowUp(body, history)) {
    lines.push(
      "POST-ORDER SHIPPING THREAD (529503176 / 531893004 / 533482593): customer still on delivery timing/status — continue that thread. Do NOT pivot to cancel/return/exchange menus. A complete status answer (בדרך, נארז, השליח יתאם, מוכן לאיסוף) is the whole reply — action reply, never append האם להעביר לנציג. human_service only when they ask for a rep, status is unknown, or the system says נמסר and they say it did not arrive."
    )
  }

  if (
    isOrderLookupCompletedInThread(history) &&
    isOrderStatusDeliveredInThread(history) &&
    /(?:מתי\s+.*(?:יבוצע|תבוצע)|(?:י)?(?:בוצע|תבוצע)\s+(?:ה)?(?:ה)?(?:אספק|הספק))/i.test(body)
  ) {
    lines.push(
      "POST-ORDER DELIVERY EXECUTION (533482593): מתי יבוצע ההספקה / יבוצע ההספקה is the same shipping follow-up as מתי יגיע — answer from the last status card + policy (courier coordinates on delivery day; no exact hour in ERP). action reply — never open with handoff offer. If they explicitly ask for a rep, human_service."
    )
  }

  lines.push(
    "ORDER REFERENCE GROUND RULE: `#` + exactly 5 digits (#36805) is Priority REFERENCE — the customer order id. SO… is ORDNAME (internal; tracking orderID). RC… is a receipt and IN…/OV… are invoices — digital documents tied to the order via ORDNAME, not REFERENCE. Never show ORDNAME when REFERENCE is set."
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
  } else if (
    isOrderCancellationSummaryLabel(body) &&
    !isOrderLookupCompletedInThread(history) &&
    !isReturnPortalSelfServiceThread(history)
  ) {
    lines.push(
      "PRE-DELIVERY CANCEL OPENING (348040437 / 464488405): customer wants to cancel (may also ask for a rep to call back) — pre-delivery cancel playbook in the same turn: returns portal link with phone prefill + action human_service so delivery can be stopped. Never lookup_order_status only for packaging/shipping status + warm-close (שמחתי לעזור). A new order afterward is for the rep — service owns cancel + callback first."
    )
  } else if (isCancelShipmentConfirmPending(history)) {
    lines.push(
      "PRE-DELIVERY CANCEL SHIPMENT CONFIRM (533868148 / 464488405): bot asked whether the order shipped — if customer confirms it has NOT shipped yet, execute pre-delivery cancel in THIS turn: returns portal link with phone prefill + say you are transferring to a service rep to stop delivery → action human_service. Do NOT reply with only after-hours / no-reps template without portal + transfer wording."
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

  if (
    /זיכוי/i.test(body) &&
    /(?:לא|ללא)\s+(?:ה)?(?:חזר(?:ה|ים|ת)?\s+)?כספ/i.test(body) &&
    /(?:שטיח|קני)/i.test(body)
  ) {
    lines.push(
      "STORE CREDIT FOR EXCHANGE (533474035): customer wants credit toward another rug (not cash refund). Explain eligibility briefly (unused + original packaging → credit code), then action human_service in the same JSON when you write מעביר לנציג — rep issues credit on the order. Never action reply with declarative מעביר."
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

  if (isBackInStockNotificationRequest(body)) {
    lines.push(
      "BACK-IN-STOCK NOTIFICATION OPENING (534030320 / 441678247): customer wants an alert when a size comes back — you cannot register stock alerts from chat. Echo product + size, say a sales advisor will check ETA and update them, write מעביר + action human_sales in the same JSON. Never lookup_inventory, never ask for מק״ט, never conditional 'if no stock then sales'."
    )
  }

  if (isBedRugSizingConsultation(body) && !hasOngoingSalesIntake(history)) {
    lines.push(
      'BED RUG SIZING OPENING (534057154): which rug/size under bed or for bedroom — `"crm_department": "sales"`, start sales intake (חדר שינה / מידות מיטה or room). Size guide or visualization link is optional one-liner only — never FAQ-only, never recommend a size, never human_service.'
    )
  }

  const inventorySku =
    extractSku(body) ??
    (isSkuRequestPending(history) ? extractRecentSku(body, history) : null)
  if (
    inventorySku &&
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
    history.some((message) => isOutboundDocumentDeliveryMessage(message.content))
  const forwardedWeezmoOrder =
    orderIdGivenInThread(history) ??
    extractOrderNumber(body) ??
    history.reduce<string | null>((found, message) => {
      if (found) return found
      return extractOrderNumber(message.content)
    }, null)

  if (
    forwardedWeezmo &&
    !isDigitalDocumentRequest(body) &&
    !isOrderLookupCompletedInThread(history)
  ) {
    lines.push(
      forwardedWeezmoOrder
        ? mentionsCancellationDesire(body)
          ? `KNOWN ORDER CANCEL (530265067): the receipt already names order ${forwardedWeezmoOrder} and the customer asked to cancel and get a refund. Call lookup_order_status with that id now. Do NOT ask whether they mean that order, do NOT ask for מספר הזמנה or a phone, and never reply "לא הצלחתי להבין". If it is a pre-order, explain הזמנה מוקדמת and the expected date — that is why it has not arrived. action reply.`
          : `FORWARDED WEEZMO TEMPLATE / KNOWN ORDER ${forwardedWeezmoOrder} (532748267): the receipt/tracking link already names this order. Do NOT ask for מספר הזמנה or phone, and do NOT start a fresh identification lookup. If you have not confirmed it yet, ask once whether they mean order ${forwardedWeezmoOrder}. On כן (including היי, כן / כן, ההזמנה האחרונה), lookup_order_status with that id only — never a different newest order on the phone. Not a document-copy request.`
        : "FORWARDED WEEZMO TEMPLATE: automated receipt is order context, not a document copy. Do not open איזה סוג מסמך. If they ask about delivery, confirm the tracking order already in the thread — do not ask for a new order number."
    )
  }

  if (
    forwardedWeezmoOrder &&
    classifyDocumentNumber(body)?.kind === "receipt" &&
    !isOrderLookupCompletedInThread(history) &&
    history.some(
      (message) => message.role === "assistant" && message.content.includes(forwardedWeezmoOrder)
    )
  ) {
    lines.push(
      `RECEIPT REF FOR NAMED ORDER (530777437): you already named order ${forwardedWeezmoOrder} to the customer. The RC receipt number they sent is a reference to that same order — call lookup_order_status with ${forwardedWeezmoOrder}, never with the RC number. Never "לא מצאתי הזמנה RC…" and never re-ask the phone.`
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
    isPhoneLookupConfirmPending(history) &&
    historyHasOrderPickExhaustedRecheck(history) &&
    pendingOrderNumberFromHistory(history)
  ) {
    const pending = pendingOrderNumberFromHistory(history)
    lines.push(
      `PHONE RECHECK + ORDER CARD (532360395): after all order cards were rejected you re-asked whether the lookup phone is correct. The last order card (${pending}) is still the candidate — if the customer confirms that card (כן/נכון/זה ההזמנה, even with a side FAQ like other sizes), call lookup_order_status now and answer the open delivery question first. A side product/size question does not cancel the confirm. Never empty reply, never "לא הצלחתי להבין".`
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

  if (isKnownOrderConfirmPending(history)) {
    const known = orderIdGivenInThread(history)
    lines.push(
      `KNOWN ORDER CONFIRM (404732305 / 508272038 / 532767659): you already asked if they mean order ${known ?? "from the receipt"}. כן OR a shipping/packaging timeline follow-up (כמה זמן עד אריזה, מתי יגיע) means call lookup_order_status with that id now — never re-ask for מספר הזמנה or phone. Never claim you cannot see status. A Pre Order line IS the status — explain הזמנה מוקדמת and the expected date, then action end. Never "לא הצלחתי להבין". Never human_service.`
    )
  }

  if (
    orderIdGivenInThread(history) &&
    isOrderConfirmationPending(history) &&
    (isOrderConfirmationNo(body) || /לא/.test(body.trim()))
  ) {
    const known = orderIdGivenInThread(history)
    const pending = pendingOrderNumberFromHistory(history)
    if (known && pending && pending.toUpperCase() !== known.toUpperCase()) {
      lines.push(
        `WRONG ORDER CARD (508272038): customer rejected ${pending}. The receipt order is ${known} — call lookup_order_status for that id now, not another phone pick and not a service summary with the rejected card. Never "לא הצלחתי להבין".`
      )
    }
  }

  if (isShippingAddressChangeAsk(body, history) && !isShippingAddressUpdateThread(history)) {
    lines.push(
      "ADDRESS CHANGE NOT STOCK (529942717): לשנות/להחליף כתובת is a delivery-address change. Never alternate size, never מק״ט, never 'אותו דגם במידה אחרת', never lookup_inventory. Address policy from KB. If they also ask when it arrives, that part is shipment timing — do not turn להחליף into a size exchange. כן to a phone-confirm question confirms the phone."
    )
  }

  if (
    isPostPurchaseAlternateSizeThread(history, body) &&
    !isShippingAddressChangeAsk(body, history)
  ) {
    lines.push(
      "POST-PURCHASE ALT SIZE: customer wants the same model in another size after ordering/receiving — **human_sales**, not lookup_inventory. You cannot read מק״ט from photos or payment screenshots. Never loop asking for מק״ט when they reference their order (הזמנה / רכשתי היום). Brief exchange policy OK, then offer יועץ מכירות to check availability against their order."
    )
  }

  if (isActiveInventoryThread(history) || isInventoryRecheckRequest(body)) {
    const displayOpen = hasPendingBranchDisplayQuestion(body, history)
    lines.push(
      displayOpen
        ? "Inventory + DISPLAY OPEN (533798193): customer also asked if the SKU is on **showroom display** at a branch — `lookup_inventory` answers stock/preorder only, not floor display. After stock results: **never** warm-close (שמחתי לעזור); remind display is not visible in the system and offer `human_sales` to check with the branch. Re-check another item → ask for a **new** מק״ט."
        : "Inventory thread (sales flow): re-check another item → ask for a **new** מק״ט; after results offer human_sales if they want to buy. **Color variants at a branch** → human_sales only, never list colors. When requested branch shows no stock but another branch/warehouse has qty, name where they can order from."
    )
  }

  if (
    /\[media:image:/i.test(body) &&
    isSalesIntakeCompleteWithOptionalPhotoPending(history)
  ) {
    lines.push(
      "SALES ROOM PHOTO + HANDOFF (533759845): intake recap already sent — ack the photo once (קיבלתי את התמונה) and set `action: human_sales` in the **same** JSON (מעביר ליועץ מכירות). Never continue intake or stay on reply. Do NOT describe/analyze the image."
    )
  } else if (
    /\[media:image:/i.test(body) &&
    (isSalesPhotoRequestPending(history) ||
      hasOngoingSalesIntake(history) ||
      hasRoomPhotoInHistory(history))
  ) {
    lines.push(
      "SALES ROOM PHOTO: reference for the human advisor only — **one** ack line (תודה, קיבלתי את התמונה — אעביר ליועץ העיצוב), then next intake step (usually דרישות מיוחדות). Never stack a second קיבלתי/אוקיי קיבלתי and never re-ask for a photo they just sent. **Never re-ask pets or any other intake step already answered in the thread.** Do NOT describe/analyze the image."
    )
  } else if (/\[media:image:/i.test(body) && poufAssemblyFaqThread) {
    lines.push(
      'POUF ASSEMBLY PHOTO (533487147): image during assembly FAQ — ack "קיבלתי את התמונה", answer the assembly question from KB/tutorial when you can; stay `action: reply`. Never sales room photo / יועץ עיצוב / "לאיזה חלל". Offer `human_service` if unsure after answering what you can.'
    )
  } else if (
    /\[media:image:/i.test(body) &&
    isSkuRequestPending(history) &&
    shouldHandleBranchInventory(body, history) &&
    !isPostPurchaseAlternateSizeThread(history, body)
  ) {
    lines.push(
      'INVENTORY SKU PHOTO (503612164): you asked for מק״ט for branch stock and the customer sent a product-page screenshot — ack the photo once, explain you cannot read מק״ט from images for stock checks, and ask them to **type** the מק״ט from the page (format 31503138-200290). Stay `action: reply` — **never** `human_sales` or after-hours OOO while stock lookup is still possible. When they type the מק״ט, call `lookup_inventory`.'
    )
  } else if (
    /\[media:image:/i.test(body) &&
    isCheckoutPriceDiscrepancyThread(history, body)
  ) {
    lines.push(
      'CHECKOUT PRICE PHOTO (534083437): customer asks why price differs at checkout and sent screenshot(s) — images **already arrived**. Ack "קיבלתי את צילומי המסך"; you cannot read prices from images; set `action: human_sales` + `crm_department: sales` with a one-line summary (מחיר בעמוד לעומת קופה). **Never** ask to send a screenshot again or ask them to type both prices before handoff.'
    )
  } else if (/\[media:image:/i.test(body)) {
    lines.push(
      'PHOTO RECEIVED (533695023 / 320713782): this turn contains a customer image — it **already arrived**. Never write that the photo/link did not arrive and never ask them to resend it. You cannot identify a rug model from a photo (story screenshot / "איך השטיח נקרא באתר?") — ack "קיבלתי את התמונה" and hand off to יועץ מכירות with a short summary of what they asked. **Same JSON must include `action: human_sales` + `crm_department: sales`** — never write מעביר/אעביר/מעביר אליו with `action: reply` only (Action ↔ transfer wording). Skip unless an order/service flow is active.'
    )
  }

  const imageTurn = /\[media:image:/i.test(body) ? userTurnFromBody(body) : null
  if (
    imageTurn &&
    shouldAnalyzeCustomerImage({ history, turn: imageTurn, lastAgent: null })
  ) {
    if (isOrderNumberRequestPending(history) || isOrderDocumentScreenshotTurn(body)) {
      lines.push(
        "ORDER RECEIPT SCREENSHOT (vision on): read SO… / #36805 / IN… / RC… or a phone number from the image, then call lookup_order_status with that value — order identification, not fetch_digital_document. Never restart document-type menu."
      )
    } else if (
      !isExchangeIntakeActive(history) &&
      (isServicePhotoAnalysisContext(history, body) || isServiceOrderIdentificationFlow(history, body))
    ) {
      lines.push(
        "SERVICE PHOTO VISION (vision on): briefly note visible damage/concern the customer reported — never pre-judge liability (no 'פגם מלכתחילה'). Continue service intake → rep summary → human_service when ready."
      )
    }
  }

  if (isAwaitingSalesIntakeAnswer(history) && hasOngoingSalesIntake(history)) {
    lines.push(
      salesIntakeMode() === "llm"
        ? "SALES INTAKE QUIZ (LLM-led): you asked the last intake question — interpret their answer in thread context; never re-ask room/product/pets/practical already answered in the thread. On לא יודע/לא בטוח/לא alone: reassure, note for advisor, advance (pets → photo → practical → summary+human_sales). Never empty reply or silence — always the next question or final summary+human_sales."
        : "SALES INTAKE QUIZ: the bot asked a scripted intake question — answer it and advance to the next step (room photo, דרישות מיוחדות, or confirmation summary). Short לא/אין/ללא counts as an answer to that step. Always a complete Hebrew question or summary — never stub words like placeholder/TODO or empty reply."
    )
  }

  if (
    documentReferenceGivenInThread(history) &&
    (isShippingStatusQuestion(body) ||
      isOrderDeliveryStatusQuestion(body) ||
      isDigitalDocumentRequest(body))
  ) {
    lines.push(
      "RECEIPT REF ORDER ID (533474136): RC/IN/OV in thread identifies the order for lookup_order_status — not document copy menu. fetch_digital_document only when they explicitly ask for a copy of receipt/invoice."
    )
  }

  const salesIntake = extractSalesIntake(history, body)
  if (salesIntake.pets != null && hasOngoingSalesIntake(history)) {
    lines.push(
      "PETS ALREADY ANSWERED (533966352): customer already answered the pets question in this thread — never ask about בעלי חיים again. Continue to דרישות מיוחדות or handoff summary+human_sales."
    )
  }
  const threadRequestedModel = requestedModelFromUserThread(history, body)
  if (
    threadRequestedModel &&
    (hasOngoingSalesIntake(history) || isActiveProductSalesPrepThread(history))
  ) {
    lines.push(
      `THREAD PRODUCT BINDING (533700177): sales thread already named "${threadRequestedModel}" — questions like "הדגם הזה" / "איך קוראים לדגם?" / product page refer to THAT product. Use inventory/KB or the correct carpetshop/pozitive URL for it. Never send a different model link (e.g. Vega when thread is Sydney). Pivot rule applies only when customer introduces a NEW product/link/name.`
    )
  }

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

function requestedModelFromUserThread(history: HistoryMessage[], body: string) {
  for (const message of history) {
    if (message.role !== "user") continue
    const model = extractRequestedModel(message.content)
    if (model) return model
  }
  return extractRequestedModel(body)
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

function ordersOfferedInLastAssistantQuestion(history: HistoryMessage[]) {
  const last = lastNonInactivityAssistant(history)
  if (!last.includes("?")) return []
  const ids = [
    ...Array.from(last.matchAll(/\b(?:SO|IN|OV)\s*\d{5,}\b/gi), (match) =>
      match[0].replace(/\s+/g, "").toUpperCase()
    ),
    ...Array.from(last.matchAll(/#\s*(\d{5})\b/g), (match) => `#${match[1]}`),
  ]
  return Array.from(new Set(ids))
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
