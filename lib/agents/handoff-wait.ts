import { isBranchListQuestion } from "@/lib/agents/branches"
import { isInventoryQuestion } from "@/lib/agents/inventory-lookup"
import { isProductDetailsRequest } from "@/lib/agents/product-handoff"
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
import {
  isPureHandoffAffirmation,
  isPureHandoffDecline,
  isHandoffAffirmationWithExtra,
} from "@/lib/agents/compound-reply"

/** Customer is answering the pending handoff yes/no question — pure כן/לא only. */
export function isHandoffContextReply(body: string) {
  return isPureHandoffAffirmation(body) || isPureHandoffDecline(body)
}

/** New message changes subject — or yes/no plus an extra ask. */
export function breaksPendingHandoff(body: string) {
  const text = body.trim()
  if (!text) return false
  if (isHandoffAffirmationWithExtra(text)) return true
  if (isHandoffContextReply(text)) return false

  return (
    isTopicPivotPhrase(text) ||
    isFaqTopicSwitch(text) ||
    isBranchListQuestion(text) ||
    isInventoryQuestion(text) ||
    isProductDetailsRequest(text) ||
    isShippingPolicyQuestion(text) ||
    isShippingStatusQuestion(text) ||
    isServiceTopicSwitch(text) ||
    isSalesTopicSwitch(text)
  )
}

export function buildStuckHandoffReply() {
  return "לא לגמרי הבנתי — רוצה שאעביר לנציג שימשיך מכאן?"
}
