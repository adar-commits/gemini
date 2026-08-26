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
import { isHumanHandoffAffirmation, isHumanHandoffDecline } from "@/lib/agents/off-topic"

/** Customer is answering the pending handoff yes/no question. */
export function isHandoffContextReply(body: string) {
  return isHumanHandoffAffirmation(body) || isHumanHandoffDecline(body)
}

/** New message changes subject — do not stay blocked waiting for handoff כן/לא. */
export function breaksPendingHandoff(body: string) {
  const text = body.trim()
  if (!text) return false
  if (isHandoffContextReply(text)) return false

  return (
    isTopicPivotPhrase(text) ||
    isFaqTopicSwitch(text) ||
    isBranchListQuestion(text) ||
    isBranchInventoryQuestion(text) ||
    isBareSkuMessage(text) ||
    isShippingPolicyQuestion(text) ||
    isShippingStatusQuestion(text) ||
    isServiceTopicSwitch(text) ||
    isSalesTopicSwitch(text)
  )
}

export function buildStuckHandoffReply() {
  return "לא לגמרי הבנתי — רוצה שנעביר לנציג שימשיך מכאן?"
}
