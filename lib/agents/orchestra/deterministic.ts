import { guessMasterRoute } from "@/lib/agents/route-intent"
import {
  isShippingPolicyQuestion,
  isShippingStatusQuestion,
} from "@/lib/agents/shipping"
import { hasOngoingSalesIntake, isSalesConsultationTrigger } from "@/lib/agents/sales-intake"
import {
  isFaqTopicSwitch,
  isSalesTopicSwitch,
  isServiceTopicSwitch,
} from "@/lib/agents/topic-switch"
import { isHumanHandoffPending } from "@/lib/agents/off-topic"
import { isProductAvailabilityQuestion } from "@/lib/agents/product-handoff"
import { isOpeningTurn } from "@/lib/agents/greeting"
import type {
  ConversationPhase,
  OrchestraContext,
  OrchestraEntities,
  OrchestraRouteHint,
} from "@/lib/agents/orchestra/types"

export function extractEntities(body: string, historyText: string): OrchestraEntities {
  const text = `${historyText}\n${body}`
  const products = [
    ...text.matchAll(/שטיח\s+([א-תa-z0-9 \-]{2,40})/giu),
    ...text.matchAll(/(?:דגם|מילאן|קזבל|גארד|JOY|SYDNEY)[^\n,.!?]{0,30}/giu),
  ]
    .map((match) => match[0].trim())
    .slice(0, 4)

  const spaces: string[] = []
  if (/סלון/.test(text)) spaces.push("סלון")
  if (/חדר\s+שינה/.test(text)) spaces.push("חדר שינה")
  if (/חדר\s+ילדים/.test(text)) spaces.push("חדר ילדים")
  if (/מסדרון/.test(text)) spaces.push("מסדרון")

  const orderHints = [
    ...text.matchAll(/(?:ה)?זמנה|משלוח|מעקב|אספקה|tracking|order/giu),
  ].map((m) => m[0])

  const dates = [...text.matchAll(/\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?/g)].map((m) => m[0])

  const budget =
    text.match(/עד\s+([\d,]+)\s*(?:ש["״']?ח|₪)/iu)?.[1] ??
    text.match(/תקציב(?:\s+של)?\s+([\d,]+)/iu)?.[1] ??
    null

  return {
    products: [...new Set(products)],
    spaces: [...new Set(spaces)],
    order_hints: [...new Set(orderHints)].slice(0, 3),
    dates: [...new Set(dates)].slice(0, 3),
    budget_hint: budget,
  }
}

export function detectDeterministicPhase(ctx: OrchestraContext): ConversationPhase {
  const { body, history, lastAgent, lastAction, userTurnCount } = ctx
  const historyText = history.map((m) => m.content).join("\n")

  if (isHumanHandoffPending(history)) return "handoff_pending"
  if (hasOngoingSalesIntake(history) || (lastAgent === "sales" && /האם זה נכון עד כה|אני צודק/.test(historyText))) {
    return "sales_intake"
  }
  if (isOpeningTurn(userTurnCount) && /^(שלום|היי|אהלן|בוקר|ערב)/iu.test(body.trim())) {
    return "opening"
  }
  if (isShippingStatusQuestion(body)) return "shipping_tracking"
  if (isShippingPolicyQuestion(body) || isFaqTopicSwitch(body)) return "policy_info"
  if (isProductAvailabilityQuestion(body)) return "product_specific"
  if (isServiceTopicSwitch(body) || lastAgent === "service") return "post_purchase_service"
  if (/לא\s+מרוצ|לא\s+מתאים|לא\s+אהב/i.test(body)) return "dissatisfaction"
  if (isSalesConsultationTrigger(body) || isSalesTopicSwitch(body) || lastAgent === "sales") {
    return isSalesConsultationTrigger(body) ? "discovery" : "sales_intake"
  }
  if (lastAction === "end" || /^(תודה|ביי|להתראות)/iu.test(body.trim())) return "closing"
  return "ambiguous"
}

export function detectDeterministicRoute(ctx: OrchestraContext): OrchestraRouteHint {
  const route = guessMasterRoute(ctx.body)
  if (route) return route
  if (isShippingStatusQuestion(ctx.body)) return "ROUTE_TO_SHIPPING_STATUS"
  if (isFaqTopicSwitch(ctx.body)) return "ROUTE_TO_INFO_AGENT"
  if (isServiceTopicSwitch(ctx.body)) return "ROUTE_TO_SERVICE_AGENT"
  if (isSalesTopicSwitch(ctx.body)) return "ROUTE_TO_SALES_AGENT"
  if (ctx.lastAgent === "faq") return "faq"
  if (ctx.lastAgent === "sales") return "sales"
  if (ctx.lastAgent === "service") return "service"
  return null
}
