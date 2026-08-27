import { hasImmediateBusinessAsk } from "@/lib/agents/greeting"
import { isBranchListQuestion } from "@/lib/agents/branches"
import { isBareSkuMessage, isBranchInventoryQuestion } from "@/lib/agents/inventory-lookup"
import {
  isFaqTopicSwitch,
  isSalesTopicSwitch,
  isServiceTopicSwitch,
  isTopicPivotPhrase,
} from "@/lib/agents/topic-switch"
import {
  isShippingPolicyQuestion,
  isShippingStatusQuestion,
} from "@/lib/agents/shipping"

const HANDOFF_AFFIRMATION_PREFIX =
  /^(?:כן|בטח|יאללה|אשמח|בבקשה|סבבה|בסדר|מעולה|ok|yes|👍)(?:[\s,.!?]+)/iu

const HANDOFF_DECLINE_PREFIX = /^(?:לא|לא\s+תודה|עזוב|no)(?:[\s,.!?]+)/iu

const INACTIVITY_ACK_PREFIX =
  /^(?:כן|כן\s+אני|פה|אני\s+פה|עדיין\s+פה|אני\s+כאן|כאן|yes|ok|👍)(?:[\s,.!?]+)/iu

const PURE_AFFIRMATION_TAIL =
  /^(?:תודה|בבקשה|pls|please|אשמח|מעולה)?(?:[\s,.!?]*)$/iu

/** Strip a leading yes / ack word and punctuation. */
export function remainderAfterLeadingAffirmation(text: string) {
  return text
    .trim()
    .replace(HANDOFF_AFFIRMATION_PREFIX, "")
    .replace(INACTIVITY_ACK_PREFIX, "")
    .trim()
}

export function hasEmbeddedBusinessAsk(text: string) {
  const body = text.trim()
  if (!body) return false
  return (
    hasImmediateBusinessAsk(body) ||
    isTopicPivotPhrase(body) ||
    isFaqTopicSwitch(body) ||
    isBranchListQuestion(body) ||
    isBranchInventoryQuestion(body) ||
    isBareSkuMessage(body) ||
    isShippingPolicyQuestion(body) ||
    isShippingStatusQuestion(body) ||
    isServiceTopicSwitch(body) ||
    isSalesTopicSwitch(body) ||
    /\?/.test(body) ||
    body.split(/\s+/).filter(Boolean).length >= 5
  )
}

export function startsWithHandoffAffirmation(text: string) {
  return /^(?:כן|בטח|יאללה|אשמח|בבקשה|סבבה|בסדר|מעולה|ok|yes|👍)/iu.test(text.trim())
}

export function isPureHandoffAffirmation(text: string) {
  const body = text.trim()
  if (!startsWithHandoffAffirmation(body)) return false
  const remainder = remainderAfterLeadingAffirmation(body)
  if (!remainder) return true
  return PURE_AFFIRMATION_TAIL.test(remainder)
}

export function isHandoffAffirmationWithExtra(text: string) {
  const body = text.trim()
  if (isPureInactivityAck(body) || isInactivityAckWithExtra(body)) return false
  if (!startsWithHandoffAffirmation(body)) return false
  const remainder = remainderAfterLeadingAffirmation(body)
  if (!remainder || PURE_AFFIRMATION_TAIL.test(remainder)) return false
  return hasEmbeddedBusinessAsk(remainder) || remainder.split(/\s+/).length >= 3
}

export function isPureHandoffDecline(text: string) {
  const body = text.trim()
  if (!/^(?:לא|לא\s+תודה|עזוב|no)(?:[\s,.!?]|$)/iu.test(body)) return false
  const remainder = body.replace(HANDOFF_DECLINE_PREFIX, "").trim()
  return !remainder || remainder.split(/\s+/).length <= 2
}

export function startsWithInactivityAck(text: string) {
  return /^(?:כן|כן\s+אני|פה|אני\s+פה|עדיין\s+פה|אני\s+כאן|כאן|yes|ok|👍)/iu.test(
    text.trim()
  )
}

export function isPureInactivityAck(text: string) {
  const body = text.trim()
  if (!startsWithInactivityAck(body)) return false
  const remainder = remainderAfterLeadingAffirmation(body)
  if (!remainder) return true
  return PURE_AFFIRMATION_TAIL.test(remainder) && body.length <= 24
}

export function isInactivityAckWithExtra(text: string) {
  const body = text.trim()
  if (!startsWithInactivityAck(body)) return false
  if (isPureInactivityAck(body)) return false
  return hasEmbeddedBusinessAsk(body) || body.split(/\s+/).length >= 4
}

/** Prior bot turn (before ping) looks like it expects a follow-up answer. */
export function isFinalizationQuestion(content: string) {
  return (
    /האם\s+(?:זה\s+)?נכון\s+עד\s+כה|אני\s+צודק/.test(content) ||
    /האם\s+להעביר\s+א(?:ת|ת)\s+הפנייה/.test(content) ||
    /האם\s+להעביר\s+(?:את\s+השיחה\s+)?(?:ל)?נציג/.test(content) ||
    /שנעביר\s+א(?:ת|ת)\s+השיחה\s+לנציג/.test(content)
  )
}

export function isConfirmationAffirmationWithExtra(text: string) {
  const body = text.trim()
  if (isInactivityAckWithExtra(body)) return false
  if (/^(?:כן(?:\s+כן)?(?:\s+אני)?\s+)?(?:עדיין\s+)?(?:כאן|פה)/iu.test(body)) return false
  if (!/^(?:כן|נכון|בדיוק|מדויק|yes)/iu.test(body)) return false
  const remainder = body.replace(/^(?:כן|נכון|בדיוק|מדויק|yes)(?:[\s,.!?]+)/iu, "").trim()
  if (!remainder) return false
  if (isBranchInventoryQuestion(body) || isBranchInventoryQuestion(remainder)) return false
  return hasEmbeddedBusinessAsk(remainder) || remainder.split(/\s+/).length >= 3
}

/** Bot just asked for SKU, link, or another customer reply — do not append closure. */
export function replyAwaitingCustomerInput(reply: string) {
  const text = reply.trim()
  if (!text) return false
  return (
    /(?:מק(?:״|"|')?ט|קישור\s+ל(?:דף)?|שלח(?:\/|)?(?:ו|י)?\s*קישור|אשמח\s+לקבל|אצטרך|אוכל\s+לקבל|יש\s+ל(?:ך|כם)\s+א(?:ת|ת))/.test(
      text
    ) ||
    /כדי\s+לבדוק\s+מלאי/.test(text) ||
    /\?\s*$/.test(text.split("\n").pop()?.trim() ?? "")
  )
}

export function buildConfirmationResumeOffer() {
  return "כשתרצו/י — נחזור לסיכום ונמשיך."
}

export function buildHandoffResumeOffer() {
  return "כשתרצו/י — אפשר להמשיך עם העברה ליועץ, רק תגידו כן."
}
