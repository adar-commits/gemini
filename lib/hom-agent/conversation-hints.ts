import { salesIntakeMode } from "@/lib/agent-core/config"
import type { ConversationVisit } from "@/lib/agents/conversation-visit"
import { formatHebrewCustomerDate } from "@/lib/agents/hebrew-date-format"
import {
  channelPhone,
  extractOrderNumber,
  extractOrderReference,
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
  isAlternatePhoneRequestPending,
  isOrderLookupPhoneReplyPending,
  isOrderNumberRequestPending,
  wasOrderNumberRequestedInThread,
  isOrderReferencePresentation,
  isIdentifiedOrderRejection,
  isOrderLookupCompletedInThread,
  isOrderModificationInThread,
  documentReferenceGivenInThread,
  mentionsCancellationDesire,
  orderIdGivenInThread,
  isShippingAddressUpdateThread,
  isPreorderEtaSharedInThread,
  isPostOrderShippingFollowUp,
  isShippingThreadFromHistory,
  isNonReceiptShippingOpenerFromHistory,
  isOrderStatusDeliveredInThread,
  historyHasOrderPickExhaustedRecheck,
  isPhoneLookupConfirmPending,
  isServiceLookupContext,
  isPurePhoneLookupConfirmYes,
  orderReferenceFromCustomerHistory,
  orderPhoneNamedByAssistant,
  isServiceOrderIdentificationFlow,
  requiresOrderIdentification,
  userProvidedPhone,
} from "@/lib/agents/order-lookup"
import { isDesignCenterLocationQuestion } from "@/lib/agents/branches"
import { customerExplicitlyRequestsHuman } from "@/lib/agents/kb-self-service-faq"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import {
  isTrackingLinkLocationQuestion,
  trackingUrlFromThread,
} from "@/lib/hom-agent/tracking-link-ask"
import {
  EN_ROUTE_NOT_YET_ARRIVED_REPLY,
  isEnRouteNotYetArrivedUpdate,
} from "@/lib/hom-agent/en-route-follow-up"
import {
  classifyPostPurchaseCase,
  isCallbackUrgencyRequest,
  isCreditCodeOnlineRedemptionRequest,
  isCreditRedemptionQuestion,
  isDefectReplacementStatusQuestion,
  isDuplicateOrExtraItemComplaint,
  isMissingOrPartialDeliveryComplaint,
  isOrderModificationRequest,
  mentionsExchangeIntent,
  isRefundTimelineQuestion,
  isReturnEligibilityQuestion,
  isReturnShippingFeeQuestion,
  isTradeInQuestion,
} from "@/lib/agents/inquiry-intent"
import {
  hasCatalogIntakeSizeAndRoom,
  isCatalogProductInquiry,
  isColorVariantRealPhotoRequest,
  isAffiliateCommissionInquiry,
  isDesignerPartnershipInquiry,
  isHomStorefrontUrl,
  extractRequestedModel,
  isActiveProductSalesPrepThread,
  isPriorOrderSizeReorderThread,
  isProductDetailsRequest,
  isProductInventoryQuestion,
  isProductSpecDeferredToAdvisorInThread,
  isSalesTransferPromisedInLastAssistant,
  isSpecificProductMention,
  isCheckoutPriceDiscrepancyThread,
} from "@/lib/agents/product-handoff"
import { isCampaignQuestion, isCouponCodeRequest } from "@/lib/agents/campaign-lookup"
import {
  activeDigitalDocumentRequest,
  documentLookupFailureOfferedInThread,
  isActiveDigitalDocumentFlow,
  isDigitalDocumentRequest,
  outboundDocumentDeliveryInThread,
  isOutboundDocumentDeliveryMessage,
  isReceiptReferencePresentation,
  lastAssistantWasOutboundDocumentDelivery,
  isDirectReceiptPhoneIntakeThread,
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
  isExchangeOriginalPackagingPolicyPending,
  isExchangeReasonPending,
  isExchangeReadyForSwitchRequest,
  isExchangeSkuPending,
  needsExchangeKindQuestion,
} from "@/lib/agents/exchange-intake"
import {
  hasImmediateBusinessAsk,
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
  isBranchStoreAvailabilityThanksClose,
  isActiveInventoryThread,
  isBackInStockNotificationRequest,
  isBackInStockVariantFollowUp,
  isBranchInventoryQuestion,
  isInventoryQuestion,
  isInventoryRecheckRequest,
  isSkuCorrectionAfterStockAnswer,
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
  isDesignerCodeRequestPending,
  isOrderCancellationSummaryLabel,
  isPostPurchaseServiceFlow,
  isReturnPickupAwaitingThread,
  isServiceHandoffSummaryConfirmed,
  isServiceSummaryOrderReferenceClarification,
  isServiceHandoffSummaryPending,
  isServiceHandoffSummaryText,
} from "@/lib/agents/service-intake"
import {
  isPostPurchaseAlternateSizeThread,
  isShippingAddressChangeAsk,
} from "@/lib/agents/post-purchase-alt-size"
import {
  extractSalesIntake,
  hasExplicitRugDimensionsInText,
  hasOngoingSalesIntake,
  hasRoomPhotoInHistory,
  isAwaitingSalesIntakeAnswer,
  isBedRugSizingConsultation,
  isOutdoorBalconyRugConsultation,
  isOutdoorBalconyRugThread,
  isOrderProductIdentityQuestion,
  isPastOrderSizeRecallQuestion,
  isSalesIntakeCompleteWithOptionalPhotoPending,
  isSalesPhotoDeclineAnswer,
  isSalesPhotoRequestPending,
  pendingSalesIntakeQuestionKind,
  petsQuestionWasAsked,
  isSalesSizingPhotoSubstitutePending,
  isServiceEvidencePhotoRequestPending,
  isServicePhotoAnalysisContext,
  isWrongItemDeliveryPhotoTurn,
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
import { isSalesHandoffCommittedInAssistantText } from "@/lib/agents/human-waiting"
import {
  hasLiveRepReplyAfterBotHandoff,
  isPostHumanHandoff,
  postHandoffKind,
} from "@/lib/agents/post-handoff"
import { messageAwaits } from "@/lib/agents/bot-awaiting"
import {
  customerRespondedToHandoffWithoutConfirm,
  hasDeclarativeHandoffTransfer,
  inferHumanHandoffAction,
  isHumanHandoffAffirmation,
  isHumanHandoffDecline,
  isHumanHandoffOfferText,
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

const CALLBACK_ASK_RE =
  /(?:ת(?:ת|)קשר(?:ו|י)?|(?:ל)?(?:ה)?תקשר(?:ו|י)?|אנא\s+התקשר|בבקשה\s+ת(?:ת|)קשר|חז(?:ור|ר(?:ו|ה))\s+אלי(?:י|ך))/i

const PRIOR_CALLBACK_HANDOFF_RE =
  /(?:שיחה\s+חוזרת|רשמתי.*(?:שיחה|התקשר|מספר)|העבר(?:תי|נו)|סימנתי\s+לנציג|ניצור\s+(?:א(?:ית)?כם\s+)?קשר)/i

function isCallbackRepeatAfterHandoff(history: HistoryMessage[], body: string) {
  const text = body.trim()
  if (!text || text.length > 280) return false
  if (!CALLBACK_ASK_RE.test(text)) return false
  const priorUserCallback = history.some(
    (message) => message.role === "user" && CALLBACK_ASK_RE.test(message.content)
  )
  if (!priorUserCallback) return false
  if (isPostHumanHandoff(null, history)) return true
  return history.some(
    (message) =>
      message.role === "assistant" && PRIOR_CALLBACK_HANDOFF_RE.test(message.content)
  )
}

function isStoreCreditValidityExtensionRequest(body: string) {
  const text = body.trim()
  if (!text || text.length > 400) return false
  if (!/זיכוי/i.test(text)) return false
  if (!/(?:האריך|הארכת|להאריך|תוקף|אחרי\s+חודש)/i.test(text)) return false
  if (!/(?:החזר|בסניף|בחנות|שמ(?:ור|איר))/i.test(text)) return false
  return true
}

function isExpiredCreditNoCallbackReEscalation(history: HistoryMessage[], body: string) {
  const text = body.trim()
  if (!text || text.length > 280) return false
  if (!/זיכוי/i.test(text)) return false
  if (
    !/(?:אף\s+אחד\s+לא|עדיין\s+לא\s+חזר|לא\s+חזר(?:ו|ה)?(?:\s+אלי(?:י|ך))?|מנסה.*(?:תפוס|להשיג).*שירות)/i.test(
      text
    )
  ) {
    return false
  }
  if (!history.some((m) => /זיכוי/i.test(m.content))) return false
  return history.some(
    (m) =>
      m.role === "assistant" &&
      /(?:העבר(?:תי|נו)\s+א(?:ת|ת)\s+ה(?:שיחה|פנייה)|הנציג\s+כבר\s+קיבל|ניצור\s+קשר\s+בהקדם)/i.test(
        m.content
      )
  )
}

const NO_RESPONSE_COMPLAINT_RE =
  /(?:אין\s+מענה|לא\s+(?:חוזר(?:ים|ה)?|עונ(?:ים|ה)?)(?:\s+אלי(?:י|ך))?|לא\s+ה(?:בנת|בין)(?:י|תי)\s+למה|עדיין\s+לא\s+חזר(?:ו|ה)?|אף\s+אחד\s+לא(?:\s+חזר)?|עבר\s+(?:יותר\s+מ?)?(?:זמן|מדי\s+זמן)|לא\s+רוצ(?:ה|ים|ות)\s+.*(?:עובר|יגיע))/i

/** Customer returns after a logged handoff complaining nobody responded (306743535). */
function isPostHandoffNoResponseReEscalation(history: HistoryMessage[], body: string) {
  const text = body.trim()
  if (!text || text.length > 320) return false
  if (!NO_RESPONSE_COMPLAINT_RE.test(text)) return false
  if (!isPostHumanHandoff(null, history)) return false
  if (hasLiveRepReplyAfterBotHandoff(history)) return false
  return history.some(
    (m) =>
      m.role === "assistant" &&
      /(?:העבר(?:תי|נו)\s+א(?:ת|ת)\s+ה(?:שיחה|פנייה)|ניצור\s+קשר\s+בהקדם|מ(?:עביר|חבר)(?:ים|ה|א)?[^\n]{0,48}יועץ\s+מכירות|נציג\s+שירות)/i.test(
        m.content
      )
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

function isDeliveryDateQuestion(text: string) {
  return (
    /(?:ל)?גבי\s+(?:מועד|תאריך)\s+(?:ה)?(?:אספק(?:ה|ת)|הגע(?:ה|ת))|(?:מה|מתי)\s+(?:ה)?(?:מועד|תאריך)\s+(?:ה)?(?:אספק(?:ה|ת)|הגע(?:ה|ת))|(?:מועד|תאריך)\s+(?:ה)?אספק(?:ה|ת)/i.test(
      text
    ) || /(?:מתי|ממתי)\s+אקבל/i.test(text)
  )
}

/** Delivery-date / ETA thread — user wording or bot's pending confirm question (533856219). */
function isDeliveryDateQuestionInHistory(history: HistoryMessage[]) {
  return history.some(
    (message) => message.role === "user" && isDeliveryDateQuestion(message.content)
  )
}

function isDeliveryTimingConfirmOfferedByBot(history: HistoryMessage[]) {
  const lastAssistant = [...history].reverse().find((message) => message.role === "assistant")
  if (!lastAssistant) return false
  return /(?:מועד|תאריך)\s+(?:ה)?(?:אספק(?:ה|ת)|הגע(?:ה|ת))/i.test(lastAssistant.content)
}

/** Customer asks bot to check live delivery/ETA — not bare handoff confirm (534443123). */
function isShippingCheckRequest(body: string) {
  const text = body.trim()
  if (!text) return false
  return (
    /(?:לבדוק|תבדוק|בדוק|יכול\s+(?:ל)?בדוק|אפשר\s+(?:ל)?בדוק)/i.test(text) &&
    /(?:יגיע|הגיע|הגעה|אספק|משלוח|היום|מגיע)/i.test(text)
  )
}

/** Promised delivery window already passed — shipping thread follow-up (534443123). */
function isOverduePromisedDeliveryMention(body: string) {
  const text = body.trim()
  if (!text) return false
  return (
    /(?:עבר(?:ו)?\s+(?:כבר)?|כבר\s+עבר)/i.test(text) &&
    /(?:שבוע|ימ(?:ים|י)|זמן|אמר(?:ו|ת)|הובטח|הוצג|נאמר)/i.test(text)
  )
}

/** Bot answered with generic warehouse/ETA FAQ — lookup never ran (534111673). */
function hasGenericEtaFaqWithoutLookupInThread(history: HistoryMessage[]) {
  if (isOrderLookupCompletedInThread(history)) return false
  return history.some(
    (message) =>
      message.role === "assistant" &&
      /(?:אין(?:\s+לי|\s+במערכת)?\s+.*(?:תאריך|מועד)\s+אספקה\s+מדויק|כרגע\s+אין\s+במערכת\s+תאריך\s+אספקה|עדיין\s+נארז(?:ה|ת)?\s+במחסן|(?:ב)?תהליכי\s+אריזה\s+במחסן|אריזה\s+במחסן)/i.test(
        message.content
      )
  )
}

/** Rep-transfer question — includes «להעביר אליו?» not caught by isHumanHandoffOfferText (534443123). */
function hasRepHandoffOfferQuestionInThread(history: HistoryMessage[]) {
  const lastAssistant = [...history].reverse().find((message) => message.role === "assistant")
  if (!lastAssistant) return false
  const text = lastAssistant.content
  return (
    isHumanHandoffOfferText(text) ||
    /להעביר\s+אל(?:יו|יה|יהם)\?\s*$/i.test(text) ||
    messageAwaits(lastAssistant, "handoff_confirm")
  )
}

function isShippingStatusCheckOfferedInThread(history: HistoryMessage[]) {
  return history.some(
    (message) =>
      message.role === "assistant" &&
      /(?:אבדוק|לבדוק).*סטטוס\s*(?:ה)?משלוח|רוצים\s+שאבדוק\s+א(?:ת\s+)?סטטוס\s*(?:ה)?משלוח/i.test(
        message.content
      )
  )
}

function isOrderStatusProgressOpener(content: string) {
  const text = content.trim()
  if (!text) return false
  return (
    /(?:מה|איך)\s+קור(?:ה|ים).*(?:ה)?(?:הזמנה|שטיח|פוף)/i.test(text) ||
    /(?:מבקש(?:ים|ות)?\s+לדעת|רוצ(?:ה|ים|ות)\s+לדעת).*(?:ה)?הזמנה/i.test(text) ||
    /(?:מתי|ממתי).{0,80}(?:יגיע|תגיע|מגיע).*(?:שטיח|הזמנה|פוף)/i.test(text) ||
    /(?:מתי|ממתי).*(?:שטיח|הזמנה|פוף).{0,80}(?:יגיע|תגיע|מגיע)/i.test(text) ||
    /(?:אשמח|רוצ(?:ה|ים|ות)|מבקש(?:ים|ות)?)\s+לדעת\s+מתי/i.test(text)
  )
}

/** Bare «צפי לקבל/להגיע» + order — not caught by isDeliveryEstimateQuestion alone (534257487). */
function isExpectReceiveDeliveryAsk(body: string) {
  const text = body.trim()
  if (!text) return false
  return (
    isDeliveryEstimateQuestion(text) ||
    /(?:צפי|צפוי(?:ה|ים|ות)?)\s+ל(?:קבל|הגיע)/i.test(text)
  )
}

/** Return/pickup in progress plus waiting for carpet matching / design advisor — sales owns the advisory (533663665). */
function isReturnWithSalesAdvisoryInThread(history: HistoryMessage[], body: string) {
  const userText = history
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .concat(body.trim())
    .join("\n")
  const hasReturnContext =
    /(?:החזר(?:ה|ת)?|מוחזר|(?:בקש(?:ה|ת)?\s+)?(?:ל)?(?:ה)?איסוף(?:\s+(?:מ)?(?:ה)?(?:בית|הבית))?)/i.test(
      userText
    )
  const hasSalesAdvisory =
    /(?:התא(?:ים|מת)(?:\s+(?:של\s+)?)?(?:ש)?טיח|שטיח\s+(?:אחר|ל(?:סלון|חדר))|(?:מ(?:מת(?:in(?:ה|ים)?|ינ(?:ה|ים)?)|ח(?:כ(?:ה|ים)?)))[^\n]{0,50}(?:עיצוב|יועץ)|(?:מ|ב)(?:ה)?עיצוב|י(?:יעוץ|עוץ)|יועץ(?:\s+(?:מכירות|העיצוב))?)/i.test(
      userText
    )
  return hasReturnContext && hasSalesAdvisory
}

/** Customer described a service/shipping issue before order confirm — not phone-only lookup (534367153). */
function threadHasStatedCustomerIssue(history: HistoryMessage[], body: string) {
  const userText = history
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .concat(body.trim())
    .join("\n")
  if (classifyPostPurchaseCase(userText)) return true
  if (isOrderDeliveryStatusQuestion(userText)) return true
  if (isShippingStatusQuestion(userText)) return true
  if (isShippingThreadFromHistory(history)) return true
  if (/\[media:image:/i.test(userText)) return true
  if (isDuplicateOrExtraItemComplaint(userText)) return true
  if (isMissingOrPartialDeliveryComplaint(userText)) return true
  return false
}

function isOrderStatusProgressOpenerFromHistory(history: HistoryMessage[]) {
  return history.some(
    (message) => message.role === "user" && isOrderStatusProgressOpener(message.content)
  )
}

/** Bot named receipt SO and asked זו ההזמנה? — not caught by isKnownOrderConfirmPending (534269217). */
function botOfferedReceiptOrderConfirm(history: HistoryMessage[]) {
  const known = orderIdGivenInThread(history)
  if (!known || isOrderLookupCompletedInThread(history)) return false
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== "assistant") continue
    const text = message.content
    if (!text.includes(known) || !/\?/.test(text)) return false
    return !/(?:אוכל לקבל|מה|איז(?:ה|ו))\s+(?:את\s+)?(?:מספר(?:י)?\s+)?(?:ה)?הזמנ(?:ה|ות)/i.test(
      text
    )
  }
  return false
}

function isSoftKnownOrderConfirm(body: string) {
  if (isOrderConfirmationYes(body)) return true
  const firstLine = body.trim().split(/\n+/)[0]?.trim() ?? body.trim()
  if (/^כן[\s,.!?]+(?:זו|זאת|זה)\s+(?:ה)?הזמנה(?:[\s,.!?]|$)/i.test(firstLine)) return true
  if (/^(?:הן\s+)?כן(?!\s+לא\b)/i.test(firstLine) && firstLine.length <= 60) return true
  if (/^(?:כ)?(?:נ)?(?:י)?(?:י)?ראה(?:\s+לי)?(?:[\s,.!?]|$)/i.test(firstLine)) return true
  if (/^כן\s+(?:מ(?:תאריך)?\s*)[\d./-]+(?:[\s,.!?]|$)/i.test(firstLine)) return true
  return /(?:ה)?(?:מס(?:פר)?|טל(?:פון)?)\s+(?:ה)?זה\s+(?:הוא\s+)?(?:שלי|שלנו)/i.test(body)
}

function isDeliveryEtaThread(history: HistoryMessage[]) {
  return (
    isShippingThreadFromHistory(history) ||
    isOrderStatusProgressOpenerFromHistory(history) ||
    isDeliveryDateQuestionInHistory(history) ||
    isDeliveryTimingConfirmOfferedByBot(history)
  )
}

/** Bot handed off claiming it cannot show status — lookup never ran (534269217). */
function hasPrematureHandoffWithoutLookupInThread(history: HistoryMessage[]) {
  if (isOrderLookupCompletedInThread(history)) return false
  return history.some(
    (message) =>
      message.role === "assistant" &&
      hasDeclarativeHandoffTransfer(message.content) &&
      /לא\s+(?:יכול|ניתן)\s+(?:להציג|לראות)/i.test(message.content)
  )
}

function isPoliteOrderConfirmYes(body: string) {
  return /^כן\s+בבקשה(?:[\s,.!?]|$)/i.test(body.trim())
}

/** Customer asks for a product/rug photo — not receipt upload (530087154). */
function isProductPhotoAsk(body: string) {
  return /(?:יש\s+(?:לך\s+)?תמונה|תמונ[הות]\s+של|צילום\s+של)/i.test(body)
}

/** "להחליף דגם" — isOrderModificationRequest misses דגם alone (531256545). */
function isBareModelChangeRequest(text: string) {
  const trimmed = text.trim()
  if (!trimmed || isOrderModificationRequest(trimmed)) return false
  return mentionsExchangeIntent(trimmed) && trimmed.includes("דגם")
}

function isBareModelChangeRequestInThread(history: HistoryMessage[], body: string) {
  if (isBareModelChangeRequest(body)) return true
  return history.some(
    (message) => message.role === "user" && isBareModelChangeRequest(message.content)
  )
}

/** Dynamic turn hints — guide the LLM without bypassing it. */
export function buildConversationHints(input: {
  history: HistoryMessage[]
  body: string
  whatsappPhone?: string
  humanThreadAssist?: "bridge" | "stale"
  visit?: ConversationVisit | null
}): string | null {
  const { history, body } = input
  const lines: string[] = []
  const postHandoffNoResponseReEscalation = isPostHandoffNoResponseReEscalation(
    history,
    body
  )

  if (input.visit) {
    const previous = formatHebrewCustomerDate(input.visit.previousVisitAt) ?? "earlier"
    lines.push(
      !input.visit.fresh && input.visit.anchor
        ? `CURRENT VISIT (228989877): this visit started with the customer message «${input.visit.anchor}» after ${input.visit.gapDays} days of silence (previous visit ended ${previous}). Messages before it are background from a past visit — answer what they ask in this visit. Never continue an old product inquiry, sales quiz, order or complaint from the earlier visit unless the customer brings it up again.`
        : `NEW VISIT (228989877): the previous message in this thread was ${input.visit.gapDays} days ago (${previous}). Treat this message as a fresh inquiry — earlier messages are background from a past visit. Do not assume they still mean that older product, order, quiz or complaint unless they say so; if their message is only a greeting or unclear, ask how you can help.`
    )
  }

  if (input.humanThreadAssist === "stale") {
    lines.push(
      "STALE HUMAN THREAD (412809595): a rep last wrote more than 2 staff days ago and the customer wrote again. Decide from the full thread — do not restart a hard case. NEW question (status, stock, product, invoice, a different order) → answer with tools as a new inquiry. OPEN HARD CASE (defect, missing items, refund dispute, pickup/repair in progress) → do not start intake over; acknowledge the case stays with the team, add only what a lookup can add, `action: reply` unless they explicitly ask for a transfer. Never claim a rep already has the case on `action: reply`."
    )
  } else if (input.humanThreadAssist === "bridge") {
    lines.push(
      "HUMAN THREAD BRIDGE: a rep still owns this chat and has not answered for several staff hours. Answer delivery status / stock / product / invoice from tools. Anything else → one short holding line that the team continues, then stop. Do not start a new sales or service intake, do not recap for handoff, do not take the case. `action: reply` unless they explicitly ask for a different transfer. Never claim a rep already has the case on `action: reply`."
    )
  }

  const kbSelfServiceFaqThisTurn = isKbSelfServiceFaqThisTurn(body, history)
  const lastAssistantText = lastNonInactivityAssistant(history)
  const postHandoffThanksClose =
    isThanksAcknowledgment(body) &&
    !isOrderModificationInThread(history, body) &&
    (hasLiveRepReplyAfterBotHandoff(history) ||
      (lastAssistantText != null &&
        (hasDeclarativeHandoffTransfer(lastAssistantText) ||
          isSalesHandoffCommittedInAssistantText(lastAssistantText))))
  const shippingServiceThanksClose =
    postHandoffThanksClose && isShippingThreadFromHistory(history)
  const branchStoreThanksClose = isBranchStoreAvailabilityThanksClose(body, history)
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
      'CATALOG PRODUCT (534348772 / מכירות): carpetshop.co.il / pozitiveshop.co.il link or Landbot "פרטים נוספים לגבי …" is a product they saw on the site — not an order. Never lookup_order_status / phone-confirm. Set `"crm_department": "sales"`, answer from KB or continue sales intake (room / photo / advisor). A photo asking about the model shape belongs here too. **Never `human_service`** — handoff only as `human_sales` after intake or when customer asks for a sales advisor.'
    )
  }

  if (isColorVariantRealPhotoRequest(body, history) && !hasOngoingSalesIntake(history)) {
    lines.push(
      'COLOR VARIANT PHOTOS (533891498): customer hesitates between color variants or asks for real-life photos you cannot send — יועץ המכירות owns the comparison. Send bullet recap + `action: human_sales` + `crm_department: sales` in the **same** JSON when you write מעביר ליועץ מכירות — never `action: reply` alone (Action ↔ transfer wording). Optional room photo may be requested in the same message but must not block handoff.'
    )
  }

  if (isAffiliateCommissionInquiry(body, history) && !hasOngoingSalesIntake(history)) {
    lines.push(
      'AFFILIATE COMMISSION (487016993): partner asking how to receive commissions on purchases with their personal/referral code — יועץ מכירות owns payout process. Brief intro + bullet recap (topic, recent purchases via code, phone) + `action: human_sales` + `crm_department: sales` in the **same** JSON when you write מעביר ליועץ מכירות — never `action: reply` alone. You may ask optional studio name or the code itself in the same message; optional info must **not** block handoff.'
    )
  }

  if (isDesignerPartnershipInquiry(body, history) && !hasOngoingSalesIntake(history)) {
    lines.push(
      'DESIGNER PARTNERSHIP (534359537): interior designer asking about discount/partnership process — יועץ מכירות owns the terms. Brief intro + bullet recap + `action: human_sales` + `crm_department: sales` in the **same** JSON when you write מעביר ליועץ מכירות — never `action: reply` alone. You may ask optional studio name/project in the same message; optional info must **not** block handoff.'
    )
  }

  const pastOrderSizeRecallPending =
    !isOrderLookupCompletedInThread(history) &&
    !isOrderConfirmationPending(history) &&
    (isPastOrderSizeRecallQuestion(body) ||
      substantiveUserMessages(history).some((message) =>
        isPastOrderSizeRecallQuestion(message.content)
      ))

  const orderProductIdentityPending =
    !isOrderLookupCompletedInThread(history) &&
    !isOrderConfirmationPending(history) &&
    (isOrderProductIdentityQuestion(body) ||
      substantiveUserMessages(history).some((message) =>
        isOrderProductIdentityQuestion(message.content)
      ))

  const blockSalesTransferForPastOrderSize =
    pastOrderSizeRecallPending ||
    (!isOrderLookupCompletedInThread(history) && isPriorOrderSizeReorderThread(history))

  if (isSalesTransferPromisedInLastAssistant(history) && !blockSalesTransferForPastOrderSize) {
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

  if (isPostHumanHandoff(null, history)) {
    lines.push(
      'ASSIGNMENT TRUTH (278792620): a previous "אני מעביר לנציג" is not proof a human still holds the chat — Landbot webhooks must not be described as an assignment. Do NOT say "הפנייה כבר אצל נציג" / "השיחה כבר משויכת" / "הנציג כבר קיבל" with action reply. If they still need the rep, set action human_service or human_sales in this same JSON so our app assigns them. You may answer the question without claiming a rep already has the case.'
    )
  }

  if (isCallbackRepeatAfterHandoff(history, body)) {
    const handoffKind = postHandoffKind(null, history) ?? "human_service"
    const department =
      handoffKind === "human_sales"
        ? "human_sales + crm_department sales"
        : "human_service + crm_department service"
    lines.push(
      `CALLBACK REPEAT RE-ESCALATION (533886824): customer already asked for a phone callback and a prior handoff/callback was logged — empathize that nobody called yet if they say so. Re-confirm the case + phone, mark urgent, and set action ${department} in the **same** JSON when you write העברתי/סימנתי/מעביר. Never replay "אין נציגים זמינים" after you already transferred during business hours. The voice-callback template ("כאן נציג/ה…") is automatic — not a live rep in chat.`
    )
  }

  if (
    isVoiceClosureTemplateLastAssistant(history) &&
    !isOrderConfirmationPending(history) &&
    !isCallbackRepeatAfterHandoff(history, body)
  ) {
    const handoffKind = postHandoffKind(null, history) ?? "human_service"
    const departmentLine =
      handoffKind === "human_sales"
        ? "If they still need a rep, or you cannot resolve it, set action human_sales + crm_department sales in the same JSON — the prior handoff was to sales (441678247); ignore the template's 'שירות' wording."
        : "If they still need a rep, or you cannot resolve it, set action human_service in the same JSON."
    lines.push(
      `VOICE CALLBACK TEMPLATE (532661685 / 533657825 / 534257487): the last outbound is an automatic voice-closure template ("כאן נציג/ה ... בהמשך לבקשתך לדבר עם נציג" or "מחלקת שירות ... בהמשך לשיחתך הטלפונית") sent after the customer chose, on a phone call, to keep waiting for a rep on WhatsApp — no rep has written yet. Answer their request normally this turn with tools (e.g. «צפי לקבל הזמנה» + order # → lookup_order_status, not human_service for «צפi מדויק»). Never stay silent and never ask a "זה מדויק?" summary confirmation. ${departmentLine}`
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

  if (postHandoffThanksClose) {
    lines.push(
      'POST-HANDOFF THANKS CLOSE (499989618 / 533428072 / 533476186 / 534366103 / 534464447): customer thanks after you already transferred (`אני מעביר לנציג` / human_sales or human_service executed) **or after a live rep already answered post-handoff**. Warm close only (`action: end` or short post-handoff ack) — **never** repeat «העברתי את השיחה» / `human_sales` / `human_service` again. Stale sales intake does NOT apply on this closing turn. Order modification threads are excluded — those still need human_sales on thanks (530164166).'
    )
  }

  if (branchStoreThanksClose) {
    lines.push(
      'BRANCH STORE AVAILABILITY THANKS CLOSE (534200437): customer asked if a product is in a branch/store to view — you answered yes/no briefly. Their thanks closes the thread — warm close (`action: end`, e.g. בכיף / שמחתי לעזור). **Never** `human_sales` / «העברתי ליועץ מכירות» — even if earlier in the thread there was a stock-alert handoff or product links. No rep needed.'
    )
  }

  if (
    !shippingServiceThanksClose &&
    isOrderModificationRequest(body) ||
    isOrderModificationInThread(history, body) ||
    isBareModelChangeRequestInThread(history, body)
  ) {
    lines.push(
      'ORDER MODIFICATION (441694412 / 532165595 / 422622122 / 530164166 / 531256545): customer wants to change color/size/model on an existing order — including bare "להחליף דגם" / "דגם אחר". Empathize → call lookup_order_status (phone confirm is OK). **Never** post-receipt exchange policy (14 days / unused packaging / "מה לא התאים?") on the opening turn before status. After status: **never** warm-close with שמחתי לעזור only — address the change in the same reply. Size/מידה/גודל/דגם while still in packaging / not yet delivered → **`action: human_sales`** when you write מעביר/העברתי ליועץ מכירות — **same JSON**, never reply alone. Customer thanks after you already said מעביר ליועץ → human_sales NOW — never action end. Color → exchange intake (kind A) after confirm. Never sales-intake quiz, never empty/"לא הצלחתי להבין".'
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

  if (salesIntakeActive && !postHandoffNoResponseReEscalation) {
    lines.push(
      'SALES THREAD (מכירות): new purchase / product inquiry / available sizes (e.g. יש יותר קטן?) — not שירות. Include `"crm_department": "sales"` in JSON this turn. When intake is complete, send recap + action human_sales in the **same** JSON (מעביר ליועץ מכירות) — never אני צודק? and never wait for approval.'
    )
  }

  if (
    isSalesIntakeCompleteWithOptionalPhotoPending(history) &&
    !shippingServiceThanksClose &&
    !branchStoreThanksClose
  ) {
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
      "SERVICE SUMMARY PENDING: on customer confirm (כן/נכון/בדיוק/מדויק/כן תודה) set action human_service + crm_department service immediately — short transfer to נציג שירות only. Never human_sales / יועץ מכירות (this is the service recap, not a sales summary). If they stay silent, the system auto-assigns to שירות with the standard העברתי את השיחה ack (no inactivity ping)."
    )
  }

  const multiOrderShippingCorpus = [...history.map((m) => m.content), body].join("\n")
  if (
    /(?:שתי|2|שני).*?(?:הזמנ|שטיח)|(?:הזמנה אחת|אחת נוספת|ההזמנה השנ)/i.test(
      multiOrderShippingCorpus
    ) &&
    /(?:צפי|מתי.*(?:מגיע|יגיע|אספקה)|סטטוס משלוח|(?:עדיין\s+)?לא\s+(?:הגיע|קיבל)|לפני\s+שבוע|ימי\s+עסקים)/i.test(
      multiOrderShippingCorpus
    )
  ) {
    lines.push(
      "MULTI-ORDER DELIVERY ETA (532828502): two+ orders + delivery timing ask — if you cannot show ETA for all, send service rep summary with bullets + 'זה מדויק?' using **אעביר** (future) only — action reply + awaiting service_summary_confirm. Never אני מעביר/העברתי until they confirm; then human_service."
    )
  }

  const distinctSoInBody = new Set(
    (body.match(/\bSO\d+\b/gi) ?? []).map((id) => id.toUpperCase())
  )
  const shippingDelayMultiOrderClarification =
    isShippingThreadFromHistory(history) &&
    (distinctSoInBody.size >= 2 ||
      (/(?:so\d+|SO\d+).*(?:so\d+|SO\d+)/i.test(body) &&
        /(?:יש|ו?יש|ו)/i.test(body)))
  if (shippingDelayMultiOrderClarification) {
    lines.push(
      "MULTI-ORDER SHIPPING DELAY (534274729): customer clarifies two+ SO numbers in a delivery-delay thread — call lookup_order_status for each and answer **outbound delivery** status/ETA. **Never** return-pickup / בקשת החזרה / איסוף שליח rep summary — ERP return flags on one order do NOT override their stated לא הגיע / תביאו את השטיחים. If you cannot show ETA for all → multi-order delivery ETA summary (532828502), not return service."
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
    hasRepHandoffOfferQuestionInThread(history) &&
    !isHumanHandoffAffirmation(body) &&
    !isHumanHandoffDecline(body) &&
    isDeliveryEtaThread(history) &&
    !isOrderLookupCompletedInThread(history) &&
    (isShippingCheckRequest(body) ||
      isOverduePromisedDeliveryMention(body) ||
      isOrderDeliveryStatusQuestion(body) ||
      isDeliveryEstimateQuestion(body))
  ) {
    lines.push(
      "HANDOFF OFFER — SHIPPING CHECK (534443123): customer did not confirm «להעביר?» — they asked to check delivery/ETA (עבר הזמן / יכול להגיע היום / לבדוק). Call lookup_order_status now (channel phone first if no order id). Answer status + whether today is possible from live data — action reply. human_service only if lookup fails AND they explicitly ask for a rep this turn. Never human_service without lookup."
    )
  } else if (
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
  if (
    lastAssistant &&
    hasDeclarativeHandoffTransfer(lastAssistant) &&
    !isThanksAcknowledgment(body)
  ) {
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

  const wrongPhoneAfterProactiveSms =
    lastAssistantWasOutboundDocumentDelivery(history) &&
    history.filter((message) => message.role === "user").length === 1 &&
    !greetingAfterDocumentDelivery &&
    !isThanksAcknowledgment(body) &&
    !hasImmediateBusinessAsk(body)

  if (wrongPhoneAfterProactiveSms) {
    lines.push(
      'WRONG PHONE / MISTaken proactive SMS (534285929): first reply to automated receipt+tracking template reporting wrong phone / not their order / «טעות במספר» — apologize briefly, say they can ignore it, note you logged for ops to fix the phone on the order. **`action: reply`** — **never** `human_service` unless they explicitly ask for נציג. No lookup_order_status.'
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

  if (isDesignerCodeRequestPending(history)) {
    lines.push(
      "DESIGNER CODE PENDING (534090339): you asked for the designer code — thanks-only is NOT closure. Reply בשמחה and remind for the code (`action: reply`). When they send the code → `human_service` with ack + transfer line."
    )
  }

  if (
    isThanksAcknowledgment(body) &&
    !isHumanHandoffPending(history) &&
    !isOrderConfirmationPending(history) &&
    !isDesignerCodeRequestPending(history)
  ) {
    lines.push(
      isShippingThreadFromHistory(history)
        ? "THANKS AFTER SHIPPING STATUS (533474524): customer thanked after your status/ETA update — warm close only (`{name}, שמחתי לעזור היום! 😊`), action end. Never human_service/human_sales unless they explicitly asked for a rep. A soft «עדכני אם מגיע» is not a handoff offer."
        : "THANKS AFTER RESOLVED THREAD: customer is closing — reply with warm close only (`{name}, שמחתי לעזור היום! 😊`), action end, expects_reply false. Never ask במה עוד אוכל לעזור."
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
      (isServiceHandoffSummaryPending(history) &&
        isServiceHandoffSummaryConfirmed(body, history)))
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
    if (isServiceSummaryOrderReferenceClarification(body, history)) {
      lines.push(
        "SERVICE ORDER ID CLARIFY (354673370): customer asked why SO… and #… differ after your summary — explain both are the same order (SO = tracking ORDNAME, # = customer REFERENCE). Keep action reply + awaiting service_summary_confirm; never human_service until they clearly confirm the case details."
      )
    } else if (isServiceHandoffSummaryConfirmed(body, history)) {
      const intake = extractServiceIntake(history, body)
      const repNote = intake.customerGoal?.trim()
        ? ` and include this compact rep note: ${buildServiceRepGoalNote(intake)}`
        : " — no rep note line, no policy add-ons (533844316)"
      lines.push(
        `Service summary confirm (533773292): customer approved — including confirm+addition (כן ו… / כן, להוסיף…). Set action \`human_service\` NOW — never warm-close or action end. Do NOT repeat the previous recap/bullets. Reply with one short transfer sentence${repNote}.`
      )
    } else if (
      /נקוד/u.test(body) &&
      /(?:^|\s)לא\s*(?:קשור|קשורות|קשיר)/u.test(body)
    ) {
      lines.push(
        "SERVICE SUMMARY DOTS CORRECTION (533667546): customer corrected dots vs threads (נקודות + לא קשור/לא קשורות). Replace «בעיה לפי הלקוח» with their exact wording — e.g. «שתי נקודות באמצע השטיח, לא קשירות» — never «קשורות». Set action human_service NOW with one short transfer line; do NOT ask another summary-check question after they fixed a misread."
      )
    } else {
      lines.push(
        "SERVICE SUMMARY CORRECTION (429830143): customer did not confirm — treat as correction/refinement of the case. Replace «בעיה לפי הלקוח» with ONLY their latest wording; drop any prior bot/image detail they contradicted or did not repeat (e.g. «אין סיבים בולטים» → remove סיבים from the recap). Never merge old inference with their correction. Updated recap → action reply + awaiting service_summary_confirm; human_service only after clear confirm."
      )
    }
  }

  if (
    isReturnPickupAwaitingThread(history, body) &&
    !shippingDelayMultiOrderClarification &&
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

  const postPurchaseKind =
    classifyPostPurchaseCase(body) ?? extractServiceIntake(history, body).issueKind
  if (postPurchaseKind === "defect") {
    lines.push(
      'DEFECT / WARRANTY (534098184): empathize and describe what they reported — never confirm "מדובר בפגם" or "פגם מלכתחילה". Set `"crm_department": "service"` every turn. Collect photos + order # → rep summary → `human_service`. **Never** `human_sales` / יועץ מכירות. Rep bullet: דיווח על בעיה / חשש (לפי הלקוח). Human verifies liability.'
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
      "CALLBACK URGENCY + SHIPPING (262348751 / 530810101): urgent phone callback while delivery is still open — call lookup_order_status first when lookup is not completed yet, then brief empathize + status, then action human_service + crm_department service. Never replay a stale sales intake summary or human_sales — this is שירות."
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
    (isShippingStatusQuestion(body) ||
      isOrderStatusProgressOpener(body) ||
      isExpectReceiveDeliveryAsk(body)) &&
    !isServiceOrderIdentificationFlow(history, body)
  ) {
    lines.push(
      "ORDER STATUS OPENING (532163951 / 532360395 / 533691332 / 532250107): delivery/shipment tracking — lookup_order_status → confirm → live status. \"לא קיבלתי את השטיח\" without רק/חסר/חלק is NOT missing_item. After confirm, if a line is Pre Order: explain that הזמנה מוקדמת means the item was not in stock as stated on the order page, so we expect חידוש מלאי around preorder_reqdate — never echo the customer's \"היה במלאי / יום למחרת / היה אמור להגיע\" as HoM's promise (532581645). If status is delivered while they claimed non-receipt (532314606) → acknowledge the gap, list line items, ask which arrived — action reply, never action end. Otherwise close with אם יש משהו נוסף שאוכל לעזור בו, אני כאן 😊 and action end — not שמחתי לעזור, not human_service just because delivery status is empty. Stale exchange/return FAQ in history does NOT make a status opener (מצב ההזמנה / יום עסקים + order #) a modification request — never human_sales or לשנות הזמנה unless this turn explicitly asks to change/cancel."
    )
  }

  const shippingOpenerOrderId =
    extractOrderReference(body, history) ?? extractOrderNumber(body)
  if (
    shippingOpenerOrderId &&
    !isOrderLookupCompletedInThread(history) &&
    !isOrderConfirmationPending(history) &&
    !isOrderNumberRequestPending(history) &&
    (isShippingStatusQuestion(body) ||
      isOrderDeliveryStatusQuestion(body) ||
      isOrderStatusProgressOpener(body) ||
      isExpectReceiveDeliveryAsk(body))
  ) {
    lines.push(
      `ETA OPENER + ORDER ID (533428072 / 533710142 / 532250107 / 534257487): customer asks when the order will arrive (including «מה קורה עם השטיח» / «צפי לקבל הזמנה») and already gave order ${shippingOpenerOrderId} in this turn (rapid messages merge into one). Call lookup_order_status with ${shippingOpenerOrderId} now — answer status + ETA policy after lookup. Delivered copy only when shipping code is 6 or 23 — empty ZPIT_DELSTATUSCODE uses neutral order-status fallback; never say נמסרה from ORDSTATUSDES alone (533710142). If they also say טרם הגיע/לא קיבל/עדיין לא and shipping code 6/23 confirms delivery — acknowledge the gap (532314606), list line items, ask which arrived; action reply, never שמחתי לעזור or action end. Never generic SLA + human_service without running the tool.`
    )
  }

  const threadKnownOrder = orderIdGivenInThread(history)
  if (
    threadKnownOrder &&
    !isOrderLookupCompletedInThread(history) &&
    hasPrematureHandoffWithoutLookupInThread(history) &&
    (isOrderDeliveryStatusQuestion(body) ||
      isShippingStatusQuestion(body) ||
      isOrderStatusProgressOpener(body)) &&
    !isKnownOrderConfirmPending(history) &&
    !isServiceOrderIdentificationFlow(history, body)
  ) {
    lines.push(
      `REPEAT SHIPPING AFTER PREMATURE HANDOFF (534269217): order ${threadKnownOrder} was confirmed but lookup_order_status never ran — you already handed off once claiming you cannot show status. Customer repeats delivery/ETA ask (מה קורה עם המשלוח/ההזמנה). Call lookup_order_status with ${threadKnownOrder} now — answer status + ETA policy. Never "לא יכול להציג" or human_service again unless lookup fails AND they explicitly ask for a rep this turn. action reply.`
    )
  }

  if (
    threadKnownOrder &&
    !isOrderLookupCompletedInThread(history) &&
    isDeliveryEtaThread(history) &&
    (isOrderDeliveryStatusQuestion(body) ||
      isShippingStatusQuestion(body) ||
      isOrderStatusProgressOpener(body)) &&
    !isKnownOrderConfirmPending(history) &&
    !isServiceOrderIdentificationFlow(history, body) &&
    !shippingOpenerOrderId
  ) {
    lines.push(
      `REPEAT ETA KNOWN ORDER (531872131): delivery thread already names order ${threadKnownOrder} — customer repeats מתי/מועד הגעה (e.g. after receipt ref RC…, automated invoice, or stale service summary). Call lookup_order_status with ${threadKnownOrder} now — answer status + ETA policy. Never "אין לי צפi מדויק" + human_service without running the tool first. Receipt/RC numbers are order refs on this thread — not fetch_digital_document. action reply unless they explicitly ask for a rep after status.`
    )
  }

  if (
    !isOrderLookupCompletedInThread(history) &&
    isDeliveryEtaThread(history) &&
    hasGenericEtaFaqWithoutLookupInThread(history) &&
    (isDeliveryEstimateQuestion(body) ||
      isOrderDeliveryStatusQuestion(body) ||
      isShippingStatusQuestion(body) ||
      isDeliveryDateQuestion(body) ||
      isShippingCheckRequest(body) ||
      isOverduePromisedDeliveryMention(body)) &&
    !isKnownOrderConfirmPending(history) &&
    !isServiceOrderIdentificationFlow(history, body)
  ) {
    lines.push(
      "REPEAT ETA AFTER FAQ (534111673): you already answered with generic warehouse/ETA policy without lookup_order_status. Customer repeats מתי/מועד/צפi אספקה — call lookup_order_status now (channel phone first if no order id in thread). Share live status + ETA policy; never repeat the same FAQ paragraph or offer handoff before lookup. action reply unless lookup fails or they explicitly ask for a rep."
    )
  }

  if (
    isShippingThreadFromHistory(history) &&
    isReceiptReferencePresentation(body) &&
    threadKnownOrder &&
    shouldDeferDocumentFlowToOrderLookup(history, body)
  ) {
    lines.push(
      `RECEIPT REF ON SHIPPING (531872131): customer sent a receipt/RC reference on a delivery/ETA thread — call lookup_order_status with ${threadKnownOrder} (never the RC as the lookup id), never fetch_digital_document. Continue answering מתי/מועד הגעה from live status.`
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
    (isChannelPhoneSelfReference(body) || isPurePhoneLookupConfirmYes(body)) &&
    (isOrderNumberRequestPending(history) || isPhoneLookupConfirmPending(history))
  ) {
    lines.push(
      `Customer confirmed the WhatsApp channel phone (${input.whatsappPhone}). Call lookup_order_status now — do not re-ask the same phone question. Never claim you cannot see status without running the tool (533526188). If status shows packaging and you write מעביר ליועץ מכירות for an order change → action human_sales in the **same** JSON — never action reply alone (530164166).`
    )
  }

  if (
    (isOrderNumberRequestPending(history) ||
      (wasOrderNumberRequestedInThread(history) &&
        isShippingThreadFromHistory(history))) &&
    (isOrderReferencePresentation(body) ||
      extractOrderNumber(body) ||
      extractOrderReference(body, history))
  ) {
    const orderId = extractOrderReference(body, history) ?? extractOrderNumber(body)
    if (wasOrderNumberRequestedInThread(history) && !isOrderNumberRequestPending(history)) {
      lines.push(
        `ORDER ID AFTER LOOKUP PIVOT (533991279): you asked for מספר הזמנה earlier in this shipping/ETA thread — customer now gave ${orderId ?? "that order id"}. Call lookup_order_status now — never generic ETA policy or human_service without running the tool. A later invoice ack or handoff offer does NOT cancel the order-number ask.`
      )
    } else {
      lines.push(
        `ORDER ID BINDING (228989877): customer answered your order-number ask (including bare digits like #77871) — call lookup_order_status with ${orderId ?? "that id"} now. NOT fetch_digital_document, NOT sales-intake summary, NOT human_sales — even if an older sales quiz is still open in the thread. NOT 'איזה סוג חשבונית'.`
      )
    }
  }

  const receiptOrder = orderIdGivenInThread(history)
  const alternateOrderId =
    extractOrderReference(body, history) ?? extractOrderNumber(body)
  if (
    receiptOrder &&
    alternateOrderId &&
    alternateOrderId.toUpperCase() !== receiptOrder.toUpperCase() &&
    (isKnownOrderConfirmPending(history) ||
      (isShippingThreadFromHistory(history) && isOrderReferencePresentation(body))) &&
    !isOrderLookupCompletedInThread(history)
  ) {
    lines.push(
      `ALTERNATE ORDER ID (432754460): delivery/ETA thread — customer gave order ${alternateOrderId} instead of the receipt order ${receiptOrder}. Call lookup_order_status with ${alternateOrderId} now — never claim you cannot show delivery ETA without running the tool. Never skip lookup and jump to handoff offer.`
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
      if (isOrderConfirmationYes(body) && isOrderModificationInThread(history, body)) {
        lines.push(
          "ORDER CONFIRM + MODIFICATION (441694412 / 530164166): כן confirms the order card on a color/size/model change thread — call lookup_order_status now. If status is still packaging/in warehouse: address the change in the same reply and set **`action: human_sales`** when you write מעביר/העברתי ליועץ מכירות — **same JSON**, never action reply alone. Never warm-close or paraphrase status without the tool."
        )
      } else if (
        isOrderConfirmationYes(body) &&
        isReturnWithSalesAdvisoryInThread(history, body) &&
        !kbSelfServiceFaqThisTurn
      ) {
        lines.push(
          "RETURN + SALES ADVISORY (533663665): order confirmed on a thread that combines return/pickup in progress AND waiting for carpet matching / design advisor (התאמת שטיח, עיצוב, שטיח אחר לסלון). After כן → **sales** bullet recap for יועץ מכירות (room/context + note return already handled at branch if stated) → **`action: human_sales`** + `crm_department: sales` in the **same** JSON when you write מעביר. **Never** service rep summary (אי-שביעות רצון / בקשת איסוף / human_service / awaiting service_summary_confirm) when their primary ask is advisory matching for a replacement rug."
        )
      } else if (
        isOrderConfirmationYes(body) &&
        threadHasStatedCustomerIssue(history, body) &&
        !isReturnWithSalesAdvisoryInThread(history, body)
      ) {
        lines.push(
          "ORDER CONFIRM YES: כן/נכון/אוקיי confirms the pending order card — call lookup_order_status immediately with the bound order/phone. Never never-stuck on this turn."
        )
      }
      if (kbSelfServiceFaqThisTurn) {
        lines.push(
          "ORDER CONFIRM + KB FAQ: customer confirmed (or is confirming) the order card AND asks policy (fees/eligibility/care) — answer from KB first. Trailing כן/כן כן binds to the FAQ answer, NOT a stale handoff offer. action reply unless they explicitly ask for a rep."
        )
      } else if (isOrderConfirmationYes(body) && isNonReceiptShippingOpenerFromHistory(history)) {
        lines.push(
          "NON-RECEIPT ORDER CONFIRM YES (532314606): thread opened with לא קיבלתי/עדיין לא קיבלתי and כן confirms the order card — call lookup_order_status. If status is delivered: say the system shows delivered AND acknowledge their claim; list line items; ask which items they actually received. action reply — never warm-close or action end until partial delivery is clarified or rep summary is sent. Partial follow-up (רק/חוץ מ/חסר) → rep summary → human_service. Never service rep summary on the bare confirm turn alone."
        )
      } else if (
        !isReturnWithSalesAdvisoryInThread(history, body) &&
        (isOrderConfirmationYes(body) ||
          isPoliteOrderConfirmYes(body) ||
          isSoftKnownOrderConfirm(body)) &&
        (isShippingStatusQuestion(body) ||
          isOrderDeliveryStatusQuestion(body) ||
          isDeliveryEtaThread(history))
      ) {
        lines.push(
          "SHIPPING ORDER CONFIRM YES (532732459 / 532742549 / 532864454 / 533011641 / 533856219 / 534429742): כן / כן בבקשה / כן מ 20.09.26 (confirm + order date from the card) / כן. זו/זאת ההזמנה confirms the order card when the thread has a delivery-timing ask (מתי/מועד/תאריך אספקה/מתי אקבל — even mid-thread after FAQ) — call lookup_order_status and answer status plus ETA policy (no exact calendar date in ERP; courier calls on delivery day). Even when status is partial, share what the tool returned — never \"לא ניתן להציג סטטוס\" / \"אין תאריך מדויק\" + human_service on this turn. action reply — never warm-close (שמחתי לעזור) or action end until the timing question is addressed. Never infer order modification or human_sales unless they explicitly ask to change/cancel (לשנות/לבטל/עדכון). Never write מעביר without matching human_sales/human_service in the same JSON."
        )
      } else if (
        isDeliveryEtaThread(history) &&
        (isProductPhotoAsk(body) ||
          isOrderConfirmationYes(body) ||
          isSoftKnownOrderConfirm(body))
      ) {
        lines.push(
          "ORDER CONFIRM + PHOTO ON ETA (530087154): delivery-timing thread with pending order card — customer confirmed (כן/הן כן) and/or asked for a rug photo. Call lookup_order_status NOW — answer status + ETA policy for the opening מתי/מועד הגעה ask first. You cannot send product photos from chat; offer human_service for a model photo only after status, never skip lookup or hand off before answering ETA. action reply."
        )
      } else if (
        isServiceOrderIdentificationFlow(history, body) &&
        !isReturnWithSalesAdvisoryInThread(history, body) &&
        !kbSelfServiceFaqThisTurn
      ) {
        lines.push(
          "SERVICE ORDER ID (505886895 / 533051674): lookup was only to identify מס׳ הזמנה for an open service/quality issue (defect, shedding/משיר צמר, photos). After customer confirms the order card → rep summary bullets **must** include: מס׳ הזמנה + דיווח על בעיה/חשש (לפי הלקוח) from the thread + נשלחו תמונות if they sent images — never a generic lone «פנייה לשירות לקוחות» without the problem. Then summary check (awaiting service_summary_confirm) → human_service. Never shipping status, never «לשנות את ההזמנה» / human_sales / יועץ מכירות, never «לא ניתן להציג סטטוס משלוח», never אפשר לעזור במשהו נוסף as the main answer."
        )
      } else if (
        isOrderConfirmationYes(body) &&
        !threadHasStatedCustomerIssue(history, body) &&
        !kbSelfServiceFaqThisTurn
      ) {
        lines.push(
          "ORDER CONFIRM NO ISSUE STATED (534367153): order card confirmed but customer never described the problem (phone/name lookup only). Ask ONE short question what they need help with — action reply. Never service rep summary, never «פנייה לשירות לקוחות», never «משך ההמתנה» unless they explicitly stated wait duration in their words. Never invent issue labels."
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

  const providedOrderPhone = userProvidedPhone(body)
  const chatChannelPhone = channelPhone(input.whatsappPhone)
  if (
    providedOrderPhone &&
    chatChannelPhone &&
    providedOrderPhone !== chatChannelPhone
  ) {
    lines.push(
      `CUSTOMER ORDER PHONE IN MESSAGE (534379659): customer typed ${providedOrderPhone} — different from WhatsApp channel ${chatChannelPhone}. For returns.carpetshop.co.il portal links use ?phone=${providedOrderPhone} (the order phone they gave), NOT the channel phone. Keep handoff recap on the phone they stated.`
    )
  }

  if (
    isAlternatePhoneRequestPending(history) &&
    extractOrderReference(body, history) &&
    !userProvidedPhone(body)
  ) {
    lines.push(
      "ORDER RESEND DURING PHONE ASK (534088322): customer repeated the order number instead of the phone — acknowledge the order # and ask again for phone digits only. Never reply «לא זיהיתי מספר טלפון»."
    )
  }

  if (
    input.whatsappPhone &&
    channelPhone(input.whatsappPhone) &&
    !isOrderLookupCompletedInThread(history) &&
    !isOrderNumberRequestPending(history) &&
    !isPhoneLookupConfirmPending(history) &&
    !isOrderConfirmationPending(history) &&
    !orderIdGivenInThread(history) &&
    !isServiceLookupContext(history) &&
    (isShippingStatusQuestion(body) || isOrderDeliveryStatusQuestion(body))
  ) {
    lines.push(
      'PHONE-FIRST LOOKUP (534048082): shipment/ETA ask and the chat phone is already known. Call lookup_order_status now — the tool searches that phone itself and returns the order card if it finds one. Do NOT ask for מספר הזמנה and do NOT tell them to write "לפי הטלפון" before the tool has searched. Ask for an order number only after the tool reports nothing on that phone. If they cannot give a number, ask whether the order was registered on that phone; if not, ask for the other phone (unless they already sent one) and look that up.'
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
    history.some(
      (message) =>
        message.role === "assistant" &&
        message.content.includes("הזמנתך") &&
        message.content.includes("איסוף עצמי")
    ) &&
    (isOrderDeliveryStatusQuestion(body) ||
      isShippingStatusQuestion(body) ||
      isDeliveryEstimateQuestion(body))
  ) {
    lines.push(
      "AWAITING DISPATCH (533179535): an older automated message named a self-pickup order. They are asking when the order arrives. Call lookup_order_status on the chat phone and do NOT pass that old SO. Shipping status 4 is ממתין להפצה — waiting for dispatch. Never answer טרם מוכנה לאיסוף עצמי and never say שוייך לשליח for status 4. action reply."
    )
  }

  if (
    orderIdGivenInThread(history) &&
    extractOrderReference(body, history)?.replace(/\D/g, "").length === 5 &&
    !extractOrderNumber(body)
  ) {
    lines.push(
      `REFERENCE ON KNOWN ORDER (533606875): ${extractOrderReference(body, history)} is the customer order # (REFERENCE), not a failed phone answer and not a missing ERP order. Call lookup_order_status now. It may be the same order as the tracking SO already in the thread. Never say you could not pull it from the system.`
    )
  }

  if (isEnRouteNotYetArrivedUpdate(body, history)) {
    lines.push(
      `EN ROUTE NOT YET ARRIVED (533790731): you already said the shipment is loaded on the driver and on the way. They are only updating that it has not arrived. Do NOT call lookup_order_status again and do NOT ask for מספר הזמנה. NEVER mention בקשה לדחיית מסירה, מיום X, or *3076 — they did not ask to postpone. Say: ${EN_ROUTE_NOT_YET_ARRIVED_REPLY} action reply.`
    )
  }

  if (
    isOrderLookupCompletedInThread(history) &&
    (isShippingThreadFromHistory(history) || isOrderStatusDeliveredInThread(history)) &&
    /(?:טלפון\s*נוסף|מס(?:פר)?\s*נוסף|ש(?:י)?תקשר(?:ו)?\s*(?:רק\s*)?(?:ל|ע(?:ל|ם)?)|(?:ל)?עדכ(?:ן|ון)\s*(?:מס(?:פר)?|טלפון).*ש(?:ליח|משלוח))/i.test(
      body
    )
  ) {
    lines.push(
      "DELIVERY CONTACT PHONE (534370893): after shipping status, customer wants courier calls on a different/additional number (טלפון נוסף / שיתקשרו רק ל…). Chat phone and order phone may differ — ack the requested number when stated. Bot cannot update courier contacts → human_service in the SAME JSON with short transfer + order # + callback request. Courier WhatsApp 077-9725055 only as optional backup — never action reply with only self-service + להעביר?"
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
  } else if (isExchangeOriginalPackagingPolicyPending(history)) {
    lines.push(
      "EXCHANGE PACKAGING BARRIER (533332336 / 533502989): you just explained exchange requires unused + original packaging. If the customer says the rug is not in original packaging / opened / no box — acknowledge honestly (policy normally requires original packaging; advisor may review), then action human_sales in the same JSON. Never lookup_inventory, never ask for SKU to check branch stock on this turn."
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
      "EXCHANGE SKU PENDING (533511440 / A/B): paraphrased מק״ט ask counts — target SKU is optional. Short hello/ping only (הי/היי) → **`action: reply`**: acknowledge you're here, re-ask מק״ט once OR call `create_switch_request` with null `targetSku` when they cannot supply it. **Never** `human_sales` with «לא הצלחתי לפתוח בקשת החלפה» before switch intake completes."
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

  if (
    isOrderCancellationSummaryLabel(body) &&
    !isOrderLookupCompletedInThread(history) &&
    !isReturnPortalSelfServiceThread(history)
  ) {
    lines.push(
      "PRE-DELIVERY CANCEL OPENING (348040437 / 464488405 / 530313226 / 534295968 / 534268241): customer wants to cancel (may also mention missing receipt/invoice — that is NOT post-receipt received; may name an undelivered line — עדיין לא סופק / אין במלאי). Same turn: returns portal link with phone prefill + say you are transferring to stop delivery → action human_service + crm_department service in the **same** JSON. Never action reply when you write מעביר/העברתי. Never lookup_order_status only for packaging/shipping status + warm-close (שמחתי לעזור). Never open with order-level משלוח נמסר/נמסר בשליח when they cancel a line they say never arrived — per-line Pre Order status only if lookup already ran. A new order afterward is for the rep — service owns cancel + callback first."
    )
  } else if (isReturnEligibilityQuestion(body, history)) {
    lines.push(
      "Return ELIGIBILITY FAQ (hypothetical — not executing a return now): answer immediately from return policy — 14 days from receipt, unused + original packaging, branch or paid courier, returns portal to open the request. Confirm their planned day (e.g. Sunday) is within the window. Do NOT call lookup_order_status."
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

  if (isStoreCreditValidityExtensionRequest(body)) {
    lines.push(
      "STORE CREDIT VALIDITY EXTENSION (325658694): branch return + credit kept for future purchase — customer needs to extend credit validity. Empathize briefly, bullet case + phone, action human_service + crm_department service in the **same** JSON when you write מעביר לנציג. Never action reply with declarative מעביר."
    )
  }

  if (isExpiredCreditNoCallbackReEscalation(history, body)) {
    lines.push(
      "EXPIRED CREDIT NO-CALLBACK RE-ESCALATION (392297515): customer returned after prior human_service on expired-credit approval — empathize briefly, recap case + phone, write העברתי/מעביר לנציג שירות **now** with action human_service + crm_department service in the **same** JSON. No second 'זה מדויק?' summary — assign immediately. Never action reply with העברתי/העברתי."
    )
  }

  if (postHandoffNoResponseReEscalation) {
    const handoffKind = postHandoffKind(null, history) ?? "human_service"
    const department =
      handoffKind === "human_sales"
        ? "human_sales + crm_department sales"
        : "human_service + crm_department service"
    lines.push(
      `POST-HANDOFF NO-RESPONSE RE-ESCALATION (306743535): customer returned after a prior handoff complaining nobody responded (אין מענה / לא חוזרים / עבר זמן). Empathize briefly for the delay. Recap the **full open case** from thread history (exchange, return, product choice — not a fresh sales intake). Re-mark urgent and set action ${department} in the **same** JSON when you write סימנתי/העברתי/מעלה בעדיפות. **Never** restart sales intake quiz or summarize as a new "שטיח לסלון" request. **Never** say מעביר עכשיו as if first transfer — they already waited. No second service_summary_confirm if already confirmed.`
    )
  }

  if (
    !isExpiredCreditNoCallbackReEscalation(history, body) &&
    /זיכוי/i.test(body) &&
    /(?:פג(?:\s+תוקפ)?|תוקף|עבר\s+חודש)/i.test(body) &&
    /(?:אישור|לא\s+חזר|דיברת|פנ(?:ית|יתי)|שבוע)/i.test(body)
  ) {
    lines.push(
      "EXPIRED CREDIT APPROVAL (392297515): expired קוד זיכוי + waiting for service approval/callback — service rep summary with bullets + 'זה מדויק?' using **אעביר** (future) only — action reply + awaiting service_summary_confirm. Never אני מעביר/העברתי in intro before confirm; then human_service."
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

  if (isBackInStockVariantFollowUp(body, history)) {
    lines.push(
      'BACK-IN-STOCK VARIANT FOLLOW-UP (534357895): sales handoff already happened for a restock alert — customer thanks and adds another color/variant (e.g. גם על הקרם בז׳). Acknowledge both products in a bullet recap for the advisor; set `"crm_department": "sales"`. **`action: reply`** with «רשמתי גם… היועץ יבדוק ויעדכן» — **never** repeat «העברתי את השיחה» / «מעולה, העברתי» / a second `human_sales` unless they explicitly ask for a rep again. Never FAQ/inventory pivot.'
    )
  }

  if (isBedRugSizingConsultation(body) && !hasOngoingSalesIntake(history)) {
    lines.push(
      'BED RUG SIZING OPENING (534057154): which rug/size under bed or for bedroom — `"crm_department": "sales"`, start sales intake (חדר שינה / מידות מיטה or room). Size guide or visualization link is optional one-liner only — never FAQ-only, never recommend a size, never human_service.'
    )
  }

  if (
    (isOutdoorBalconyRugConsultation(body) || isOutdoorBalconyRugThread(history)) &&
    !hasOngoingSalesIntake(history)
  ) {
    lines.push(
      'OUTDOOR BALCONY RUG OPENING (534278859): outdoor/balcony/garden rug purchase or sizing (שטיחי חוץ, מרפסת, גינה, גודל מומלץ לפינת ישיבה) — `"crm_department": "sales"`, start sales intake (outdoor space / seating area size). Brief durability facts from KB are fine one-liner — never FAQ-only deferral loop, never recommend a size, never human_service.'
    )
  }

  if (pastOrderSizeRecallPending) {
    lines.push(
      'PAST ORDER SIZE RECALL (534159887): customer asks what size they ordered before — call lookup_order_status on the channel phone first. After order confirm, answer size from line items. If they also ask whether you are human (נציג אנושי) — say briefly you are the bot, then continue lookup; do not skip to handoff. Never claim you have no access without running the tool. Never invent a product/model name not stated by the customer in this thread. human_sales only after lookup fails or they explicitly want an advisor to reorder.'
    )
  }

  if (orderProductIdentityPending) {
    lines.push(
      'ORDER PRODUCT IDENTITY (294198093): customer asks which carpet / what material is on their order — call lookup_order_status on the channel phone → order confirm → after confirm list line items (product name). For material: use product name + KB when available; if not in order data, say briefly and offer human_service only if they need more detail or lookup fails. Never apologize and hand off without lookup. Never reply with shipping status alone when they asked product identity/material. action reply until answered or lookup fails.'
    )
  }

  if (isSkuCorrectionAfterStockAnswer(history, body)) {
    lines.push(
      "SKU CORRECTION AFTER STOCK (534109519): you already answered stock for the correct מק״ט in the previous turn; customer is clarifying an earlier typo — brief ack only (reuse the last stock/preorder answer), **never** lookup_inventory again, **never** contradict the prior answer, **never** warm-close (ערב טוב/שמחתי לעזור). Stay `action: reply`; offer human_sales only if they ask to buy."
    )
  }

  const inventorySku =
    extractSku(body) ??
    (isSkuRequestPending(history) ? extractRecentSku(body, history) : null)
  if (
    inventorySku &&
    shouldHandleBranchInventory(body, history) &&
    !isPostPurchaseAlternateSizeThread(history, body) &&
    !isSkuCorrectionAfterStockAnswer(history, body)
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

  if (isMembershipClubCheckoutQuestion(body) && isOrderCancellationSummaryLabel(body)) {
    lines.push(
      "CHECKOUT PAYMENT SPLIT CANCEL (534268241): BUYME/voucher/מועדון + credit balance checkout charged wrong and customer wants to cancel — you cannot reverse charges from here. Same turn: empathize, say transferring to service rep to cancel and verify charges → action human_service + crm_department service in the **same** JSON. Never action reply when you write מעביר/העברתי. Rep owns cancel + charge verification; optional portal link if pre-delivery."
    )
  } else if (isMembershipClubCheckoutQuestion(body)) {
    lines.push(
      "MEMBERSHIP / RELOADABLE CHECKOUT: answer SHORT from membership-clubs-payments KB — if their program is listed, confirm we work with it; completing the order with that card usually needs a service rep (like קוד זיכוי). Offer human_service — never a long payment-methods dump, never 'אין לי מידע'. If they ask נציג אנושי → handoff immediately."
    )
  }

  if (isCampaignQuestion(body) && !isCouponCodeRequest(body)) {
    lines.push(
      "CAMPAIGN VALIDITY (327887473): customer asked if a promotion/% is active or ended — call get_campaigns now. Answer from live data (end date, active/expired). Never say לא הצלחתי לבדוק מבצעים without calling the tool. A named model (e.g. סידני 02) in the question does not block lookup — answer campaign status first; human_sales only if they need purchase advice beyond dates."
    )
  }

  if (isCouponCodeRequest(body)) {
    lines.push(
      "COUPON CODE: call get_campaigns now. Share coupon_code from API only for **active** campaigns (valid dates). Never invent codes. Never say 'לא הבנתי' on קוד הנחה / typos like הנלה — treat as coupon ask."
    )
  }

  if (postPurchaseKind === "missing_item") {
    lines.push(
      "MISSING ITEM / PARTIAL DELIVERY: service case, NOT document copy. lookup_order_status → order confirm (no product list on card) → after כן, if customer already named the missing product in thread (e.g. הגיע רק… מדבקות) skip numbered pick and go to rep summary; only when multiple line items AND missing product not yet named → numbered pick → rep summary with פריט חסר → human_service. If they add another issue (בנוסף + stain/defect) merge both in one summary. Never fetch_digital_document."
    )
  }

  if (
    isDuplicateOrExtraItemComplaint(body) ||
    history.some(
      (message) =>
        message.role === "user" && isDuplicateOrExtraItemComplaint(message.content)
    )
  ) {
    lines.push(
      'DUPLICATE / EXTRA ITEM (533672658): same product twice / extra unit not ordered — **service**, `"crm_department": "service"`. lookup_order_status only to identify מס׳ הזמנה → rep summary (פריט נוסף/כפול לא מוזמן, תיאום איסוף) → human_service. **Never** reply with delivery status alone (נמסר/שמחתי לעזור/action end). If they also ask for a **new purchase** (בנוסף + המלצה/שטיח לסלון) — finish service summary first, note the sales ask for the rep; do not pivot to sales intake before handoff.'
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
          : `FORWARDED WEEZMO TEMPLATE / KNOWN ORDER ${forwardedWeezmoOrder} (532748267 / 534031731): the receipt/tracking link already names this order. Call lookup_order_status now. The tool returns the order card — שבוצעה לפני … ימים באתר או בסניף, סכום, מס׳ הזמנה # (never SO when # exists). Send that card. Do NOT ask for מספר הזמנה or phone. Do NOT write "מדובר בהזמנה SO… שמופיעה בקישור המעקב". On כן, lookup returns live status for ${forwardedWeezmoOrder} only. Not a document-copy request.`
        : "FORWARDED WEEZMO TEMPLATE: automated receipt is order context, not a document copy. Do not open איזה סוג מסמך. If they ask about delivery, confirm the tracking order already in the thread — do not ask for a new order number."
    )
  }

  if (isTrackingLinkLocationQuestion(body)) {
    const url = trackingUrlFromThread(history)
    lines.push(
      url
        ? `TRACKING LINK (534031731): they asked where the tracking link is. Paste this exact URL in the reply: ${url}. Do not answer with shipment status, and do not say the link is in an earlier message without pasting it. action reply.`
        : "TRACKING LINK (534031731): they asked where the tracking link is. Paste the tracking.carpetshop.co.il URL already in the thread. Do not answer with shipment status."
    )
  }

  if (
    isOrderLookupCompletedInThread(history) &&
    !customerExplicitlyRequestsHuman(body) &&
    (isOrderDeliveryStatusQuestion(body) ||
      isDeliveryEstimateQuestion(body) ||
      (/היום/.test(body) && /יגיע|מגיע/.test(body)))
  ) {
    lines.push(
      "RESOLVED ETA CLOSE (534031731): live status was already sent. Answer מתי/היום from that status (en route means היום, no exact hour, השליח יתקשר). A complete answer that ends with בכיף / המשך יום טוב / שמחתי לעזור is action end so the CRM inquiry closes. Never action reply on that goodbye."
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
    (isDigitalDocumentRequest(body) ||
      isActiveDigitalDocumentFlow(history, body) ||
      isDirectReceiptPhoneIntakeThread(history)) &&
    !shouldReleaseStructuredDocumentFlow(history, body)
  ) {
    lines.push(
      "DOCUMENT COPY (קבלה / חשבונית / העתק): fetch_digital_document only — getDocument API by phone. Never lookup_order_status or getOrders for invoice/receipt requests."
    )
  }

  if (isDirectReceiptPhoneIntakeThread(history) && isPhoneLookupConfirmPending(history)) {
    lines.push(
      "RECEIPT COPY AFTER ETA (533106217): bot opened document phone confirm without a type menu — fetch_digital_document only. Alternate phone with no doc → retry channel phone before handoff. Never lookup_order_status or לא מצאתי הזמנות פעילות."
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

  if (isPhoneLookupConfirmPending(history)) {
    const customerOrder = orderReferenceFromCustomerHistory(history, body)
    if (customerOrder && !isKnownOrderConfirmPending(history)) {
      lines.push(
        `PHONE CONFIRM + ORDER ID (534150047): customer already sent ${customerOrder} and is confirming the chat phone. On כן call lookup_order_status with that order id and the confirmed phone — never phone-only search that ignores the SO. Answer delivery ETA from live status; never human_service before lookup runs.`
      )
    }
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

  if (
    botOfferedReceiptOrderConfirm(history) &&
    !isKnownOrderConfirmPending(history) &&
    isSoftKnownOrderConfirm(body)
  ) {
    const known = orderIdGivenInThread(history)
    lines.push(
      `RECEIPT ORDER CONFIRM BINDING (534269217): you asked if they mean order ${known ?? "from receipt"} (זו ההזמנה?) and customer confirmed (כנראה/כניראה/כן or phone ownership). Call lookup_order_status with ${known ?? "that SO"} now — answer order/shipping status for the opening "מה קורה עם ההזמנה" ask. Never claim you cannot see status or human_service before lookup. action reply.`
    )
  }

  if (
    isKnownOrderConfirmPending(history) &&
    /^כן(?:\s|[,.!?]|$)/i.test(body.trim()) &&
    /(?:בדוק|תבדק|לבדוק)/i.test(body)
  ) {
    lines.push(
      "KNOWN ORDER STATUS CHECK YES (533760226): כן תבדוק/תבדקו confirms your status-check offer on the named SO — call lookup_order_status immediately and answer shipping status. Never service rep summary, never אי-שביעות רצון, never human_service on this turn."
    )
  }

  if (isKnownOrderConfirmPending(history)) {
    const known = orderIdGivenInThread(history)
    if (isNonReceiptShippingOpenerFromHistory(history)) {
      lines.push(
        `KNOWN ORDER CONFIRM + NON-RECEIPT (532314606): thread opened with לא קיבלתי/עדיין לא קיבלתי and you asked if they mean order ${known ?? "from the receipt"}. כן confirms — call lookup_order_status with that id now. If delivered: acknowledge system vs customer claim, list line items, ask which arrived — action reply, never action end. Partial clarification → rep summary → human_service. Never re-ask for מספר הזמנה or phone.`
      )
    } else if (isDeliveryEtaThread(history)) {
      lines.push(
        `KNOWN ORDER CONFIRM + ETA (532716685 / 533011641 / 532732459 / 528863688 / 533856219 / 534269217): thread opened with delivery timing (מתי/מועד/תאריך אספקה/מה קורה עם ההזמנה) and you asked if they mean order ${known ?? "from the receipt"}. כן OR כנראה/כניראה OR כן בבקשה OR כן זאת/זו ההזמנה OR bot-frustration merged with confirm (אני מדבר עם בוט + כן) OR כן תבדוק/תבדקו OR phone ownership (המס/טלפון הזה שלי) OR a shipping/packaging timeline follow-up (כמה זמן עד אריזה, מתי יגיע) → call lookup_order_status with that id now. If they ask where to find the order number — explain briefly (confirmation email/SMS, invoice # prefix, SO on tracking link) and re-ask if ${known ?? "that SO"} is theirs. Answer status plus ETA policy (no exact calendar date in ERP; courier calls on delivery day) — even when status is partial or ambiguous, share what the tool returned and the policy; never "לא ניתן להציג סטטוס" + human_service on this turn. Pre Order line → explain הזמנה מוקדמת and the expected date. action reply — never warm-close (שמחתי לעזור) or action end until the timing question is addressed. Never re-ask for מספר הזמנה or phone. Never service rep summary or אי-שביעות רצון. Never "לא הצלחתי להבין". Never human_service unless they ask for a rep.`
      )
    } else {
      lines.push(
        `KNOWN ORDER CONFIRM (404732305 / 508272038 / 530810101 / 532581645 / 532767659 / 533760226 / 534269217): you already asked if they mean order ${known ?? "from the receipt"}. כן OR כנראה/כניראה OR כן תבדוק/תבדקו OR phone ownership (המס/טלפון הזה שלי) OR a shipping/packaging timeline follow-up (כמה זמן עד אריזה, מתי יגיע, מה קורה עם ההזמנה, לא מגיעה, לא חזרו, קישור למעקב ללא שינוי, היה במלאi/יום למחרת, לא קרה) means call lookup_order_status with that id now — never re-ask for מספר הזמנה or phone. Never service rep summary or אי-שביעות רצון on an expedite/status-check thread. Never claim you cannot see status. A Pre Order line IS the status — explain הזמנה מוקדמת and the expected date; never repeat their in-stock/next-day site wording as HoM fact. action reply — never human_service before lookup. Never "לא הצלחתי להבין".`
      )
    }
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

  if (isKnownOrderConfirmPending(history) && isShippingAddressChangeAsk(body, history)) {
    const known = orderIdGivenInThread(history)
    const botOfferedEtaCheck = [...history]
      .reverse()
      .find((message) => message.role === "assistant")
    const deliveryCheckOpen =
      Boolean(botOfferedEtaCheck) &&
      /(?:כדי לבדוק|לבדוק)\s+מתי|מתי\s+(?:זה\s+)?(?:מגיע|יגיע)/i.test(
        botOfferedEtaCheck!.content
      )
    if (deliveryCheckOpen || isShippingThreadFromHistory(history)) {
      lines.push(
        `ADDRESS + ETA COMPOUND (534127311): they asked to change delivery address AND when it arrives — order ${known ?? "from receipt"} is already pending confirm. Call lookup_order_status with that id NOW and answer ETA from live status. Address change cannot be done here → human_service in the same turn after ETA (fresh order = better chance before ship). Never human_service without lookup when a delivery-time question is still open. Never re-ask for מספר הזמנה.`
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
    hasExplicitRugDimensionsInText(body) &&
    !isSalesIntakeCompleteWithOptionalPhotoPending(history) &&
    (hasOngoingSalesIntake(history) || isActiveProductSalesPrepThread(history))
  ) {
    lines.push(
      'SALES PHOTO + SIZE (534083625): room photo **and** stated rug dimensions in the same turn — ack once (קיבלתי את התמונה), bullet recap (product from thread, size, use case), **`action: human_sales`** + **`crm_department: sales`** in the **same** JSON (מעביר ליועץ מכירות). **Never** write אעביר/מעביר and then ask another intake question (pets, room). Missing optional fields → note for advisor in recap.'
    )
  } else if (
    /\[media:image:/i.test(body) &&
    isSalesSizingPhotoSubstitutePending(history)
  ) {
    lines.push(
      'SALES SIZING PHOTO SUBSTITUTE (534254797): customer chose a room photo **instead of** typing sofa/room dimensions — the photo **is** the sizing answer. Ack once (קיבלתי את התמונה), bullet recap (product ask from thread, room, photo for advisor), **`action: human_sales`** + **`crm_department: sales`** in the **same** JSON (מעביר ליועץ מכירות). **Never** ask sofa size again or write אעביר/מעביר with `action: reply` only.'
    )
  } else if (
    /\[media:image:/i.test(body) &&
    isServiceEvidencePhotoRequestPending(history)
  ) {
    lines.push(
      'SERVICE DEFECT / LABEL PHOTO (504655399 / 534098184 / 534161594): you asked for damage/defect evidence or a label photo on the package for the service rep — customer sent it. Ack photos, note what you see or what they reported, continue service intake → rep summary → human_service. Set `"crm_department": "service"`. **Never** sales room question ("לאיזה חלל"), never יועץ העיצוב, never `human_sales`.'
    )
  } else if (
    /\[media:image:/i.test(body) &&
    (isSalesPhotoRequestPending(history) ||
      hasOngoingSalesIntake(history) ||
      hasRoomPhotoInHistory(history))
  ) {
    lines.push(
      "SALES ROOM PHOTO: reference for the human advisor only — **one** ack line (תודה, קיבלתי את התמונה) without אעביר/מעביר until `action: human_sales`, then next intake step (usually pets or דרישות מיוחדות). Never stack a second קיבלתי/אוקיי קיבלתי and never re-ask for a photo they just sent. **Never re-ask pets or any other intake step already answered in the thread.** Do NOT describe/analyze the image."
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
  } else if (/\[media:image:/i.test(body) && isWrongItemDeliveryPhotoTurn(body)) {
    lines.push(
      'WRONG-ITEM DELIVERY PHOTO (533657825): photo + proof of what was ordered at the store / wrong item received — **service**, not sales. Set `"crm_department": "service"`. Ack photo, empathize, start service intake (lookup order if needed → rep summary). **Never** sales room question ("לאיזה חלל"), never יועץ העיצוב, never `human_sales`.'
    )
  } else if (
    /\[media:image:/i.test(body) &&
    isServicePhotoAnalysisContext(history, body)
  ) {
    lines.push(
      'DEFECT / DAMAGE PHOTO (534098184): defect or warranty-concern thread — **service**, not sales. Set `"crm_department": "service"`. Ack photo, describe visible concern without confirming liability, continue service intake (more photos / order # if needed). **Never** `human_sales` or יועץ מכירות — hand off with `human_service` when intake is ready.'
    )
  } else if (
    /\[media:image:/i.test(body) &&
    isKnownOrderConfirmPending(history) &&
    isShippingThreadFromHistory(history)
  ) {
    const known = orderIdGivenInThread(history)
    lines.push(
      `KNOWN ORDER CONFIRM PHOTO (531872131): you asked if they mean order ${known ?? "from tracking"} — receipt/tracking screenshot = confirmation. Call lookup_order_status with that id (read SO/# from the image if needed). Answer delivery status + ETA policy for the opening מתי/מועד הגעה ask. action reply — never service rep summary or human_service on this turn.`
    )
  } else if (
    /\[media:image:/i.test(body) &&
    isOrderNumberRequestPending(history) &&
    (isShippingThreadFromHistory(history) || isShippingStatusCheckOfferedInThread(history))
  ) {
    lines.push(
      "SHIPPING INVOICE PHOTO (285505270): shipping/ETA thread — you asked for order # or phone and customer sent receipt/invoice image (even bare photo). Read IN… / SO… / #… from vision, call lookup_order_status, answer status + ETA policy. Only if lookup fails → service rep summary (awaiting service_summary_confirm) with future אעביר — never skip lookup and jump to rep summary for shipping status."
    )
  } else if (/\[media:image:/i.test(body)) {
    lines.push(
      'PHOTO RECEIVED (533695023 / 320713782): this turn contains a customer image — it **already arrived**. Never write that the photo/link did not arrive and never ask them to resend it. You cannot identify a rug model from a photo (story screenshot / "איך השטיח נקרא באתר?") — ack "קיבלתי את התמונה" and hand off to יועץ מכירות with a short summary of what they asked. **Same JSON must include `action: human_sales` + `crm_department: sales`** — never write מעביר/אעביר/מעביר אליו with `action: reply` only (Action ↔ transfer wording). Skip unless an order/service flow is active.'
    )
  } else if (/\[media:video:/i.test(body)) {
    lines.push(
      'VIDEO RECEIVED (534094675): customer sent a video — **cannot watch video**. Respond to their **written caption/text** only; never never-stuck / "משהו נתקע". Ack the message warmly. If a service question is still open (e.g. purchase-location confirm), continue that thread after ack. Post-sale design feedback to a rep by name → brief ack + offer `human_sales` if they want a יועץ. Never ask them to resend the video.'
    )
  }

  const imageTurn = /\[media:image:/i.test(body) ? userTurnFromBody(body) : null
  if (
    imageTurn &&
    shouldAnalyzeCustomerImage({ history, turn: imageTurn, lastAgent: null })
  ) {
    if (
      !isExchangeIntakeActive(history) &&
      (isServicePhotoAnalysisContext(history, body) ||
        isServiceOrderIdentificationFlow(history, body))
    ) {
      lines.push(
        "SERVICE PHOTO VISION (vision on): briefly note visible damage/concern the customer reported — never pre-judge liability (no 'פגם מלכתחילה'). Continue service intake → rep summary → human_service when ready."
      )
    } else if (isOrderNumberRequestPending(history) || isOrderDocumentScreenshotTurn(body)) {
      lines.push(
        "ORDER RECEIPT SCREENSHOT (vision on): read SO… / #36805 / IN… / RC… or a phone number from the image, then call lookup_order_status with that value — order identification, not fetch_digital_document. Never restart document-type menu."
      )
    }
  }

  const threadVerifiesOrderedItems =
    (requiresOrderIdentification(body, history) &&
      isServicePhotoAnalysisContext(history, body)) ||
    history.some(
      (message) =>
        message.role === "user" &&
        requiresOrderIdentification(message.content, history.slice(0, history.indexOf(message))) &&
        /\[media:image:/i.test(message.content)
    )
  if (
    threadVerifiesOrderedItems &&
    !orderIdGivenInThread(history) &&
    !isOrderConfirmationPending(history)
  ) {
    lines.push(
      'ORDER CARD SOURCE (533912766): customer verifies model/SKU on their order — call lookup_order_status. Phone lookup without customer-sent order # or tracking link this thread → say "לפי מספר הטלפון שלך מצאתי…", never "קישור המעקב" / "שמופיעה בקישור". Card: "נדמה לי שמצאתי… — זו ההזמנה?" + awaiting order_confirm. After confirm → line items/order document, not shipping status.'
    )
  }

  if (
    (isSalesPhotoRequestPending(history) ||
      pendingSalesIntakeQuestionKind(history) === "style_photo" ||
      pendingSalesIntakeQuestionKind(history) === "photo") &&
    isSalesPhotoDeclineAnswer(body) &&
    !/\[media:image:/i.test(body)
  ) {
    lines.push(
      'SALES PHOTO DECLINE (534274234): optional room photo was offered — לא/אין/לא נוח/דילוג means **skip photo**, not handoff. Ack (אין בעיה, נדלג), continue intake → דרישות מיוחדות, then summary+human_sales. **`action: reply`** on this turn — **never** `human_sales` on photo decline alone.'
    )
  }

  const salesBranchStockPivot =
    isAwaitingSalesIntakeAnswer(history) &&
    hasOngoingSalesIntake(history) &&
    (isBranchInventoryQuestion(body) || isInventoryQuestion(body))

  if (salesBranchStockPivot) {
    lines.push(
      'SALES + BRANCH STOCK PIVOT (431273377): during catalog sales intake the customer pivoted to store stock / buy today — this is NOT their answer to the room quiz. Pause intake; set `"crm_department": "sales"`. Ask once for מק״ט (format 31503138-200290) + preferred area if missing, then call `lookup_inventory` when SKU is available. Stay `action: reply` — never `human_sales` until lookup runs or they explicitly ask for an advisor. Never re-ask the pending room question this turn.'
    )
  }

  if (
    isAwaitingSalesIntakeAnswer(history) &&
    hasOngoingSalesIntake(history) &&
    !salesBranchStockPivot &&
    !postHandoffNoResponseReEscalation
  ) {
    lines.push(
      salesIntakeMode() === "llm"
        ? "SALES INTAKE QUIZ (LLM-led): you asked the last intake question — interpret their answer in thread context; never re-ask room/product/pets/practical already answered in the thread. On לא יודע/לא בטוח/לא alone: reassure, note for advisor, advance (pets → photo → practical → summary+human_sales). **Never** write ציינתי/העברתי/אעביר ליועץ mid-quiz with action reply (534144877) — ack (תודה, רשמתי) + next question, or final summary+human_sales. Never empty reply or silence — always the next question or final summary+human_sales."
        : "SALES INTAKE QUIZ: the bot asked a scripted intake question — answer it and advance to the next step (room photo, דרישות מיוחדות, or confirmation summary). Short לא/אין/ללא counts as an answer to that step. **Never** ציינתי/העברתי/אעביר ליועץ mid-quiz with action reply — save advisor notes for summary+human_sales. Always a complete Hebrew question or summary — never stub words like placeholder/TODO or empty reply."
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
  if (
    salesIntake.pets != null &&
    hasOngoingSalesIntake(history) &&
    petsQuestionWasAsked(history) &&
    !postHandoffNoResponseReEscalation
  ) {
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

  if (
    salesIntake.targetSpace === "חדר שינה" &&
    /(?:^|\s)(?:ל)?חדר\s+שינה(?:\s|$)/i.test(body) &&
    hasOngoingSalesIntake(history)
  ) {
    lines.push(
      'BEDROOM SPACE COMPLETE (501830806): "חדר שינה"/"לחדר שינה" completes the space step — advance to bed/sofa size, pets, or optional room photo. **Never** ask nursery/children/couples sub-type (תינוקות/ילדים/זוגי). If they also sent a room photo, ack once and continue intake — do not re-ask space.'
    )
  }

  if (
    pendingSalesIntakeQuestionKind(history) === "space" &&
    /^(?:ל)?סלון(?:\s|$|[,.!?])/i.test(body.trim()) &&
    hasOngoingSalesIntake(history)
  ) {
    lines.push(
      'LIVING ROOM SPACE COMPLETE (350490796): "סלון"/"לסלון" completes the space step — advance to sofa size (מידת הספה/גודל הסלון), pets, or optional room photo. **`action: reply`** — never `human_sales` until intake quiz is complete.'
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
