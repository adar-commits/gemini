import { buildNeverStuckReply } from "@/lib/agent-core/fallbacks"
import { stripAppendedDeliveryPolicyFromOrderStatus } from "@/lib/agents/shipping"
import { sanitizeDissatisfactionRescueReply } from "@/lib/agents/dissatisfaction"
import { sanitizeServiceDefectLiabilityReply } from "@/lib/agents/service-defect-wording"
import {
  buildReturnsPortalUrl,
  personalizeReturnsPortalUrls,
  sanitizeCreditRedemptionWording,
  sanitizeRefundPolicyWording,
} from "@/lib/agents/policy-subjects"
import {
  inferHumanHandoffAction,
  sanitizeRedundantHandoffConfirm,
} from "@/lib/agents/off-topic"
import { normalizeMessageText } from "@/lib/agents/memory"
import {
  dedupeGreetingBotName,
  ensureSingleCustomerHeader,
  isCasualGreeting,
  isSelfContainedGreetingReply,
  prependOpeningGreetingReply,
  sanitizeCustomerAddress,
} from "@/lib/agents/greeting"
import type { HistoryMessage } from "@/lib/agents/types"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import type { HomAgentOutput } from "@/lib/hom-agent/output-schema"

export function validateHomAgentReply(
  output: HomAgentOutput,
  userText: string,
  whatsappPhone?: string | null,
  history: HistoryMessage[] = []
): HomAgentOutput {
  let reply = output.reply?.trim() ?? ""
  if (!reply && output.action === "reply") {
    reply = buildNeverStuckReply()
  }

  reply = sanitizeCustomerAddress(reply)
  reply = sanitizeServiceDefectLiabilityReply(reply)
  reply = sanitizeDissatisfactionRescueReply(reply)
  reply = sanitizeRefundPolicyWording(reply)
  reply = sanitizeCreditRedemptionWording(reply)
  reply = sanitizeRedundantHandoffConfirm(reply)
  reply = stripAppendedDeliveryPolicyFromOrderStatus(reply)
  reply = sanitizeHallucinatedPortalUrls(reply, whatsappPhone)
  reply = personalizeReturnsPortalUrls(reply, whatsappPhone)
  reply = dedupeGreetingBotName(reply)
  reply = prependOpeningGreetingReply(reply, userText, history)

  if (reply && !shouldSkipHeader(userText, reply)) {
    reply = reply.replace(/^(?:\*הום בוט :\)\*\n?)+/g, `${CUSTOMER_HEADER}\n`)
    if (!reply.startsWith(CUSTOMER_HEADER) && !isSelfContainedGreetingReply(reply)) {
      if (!reply.startsWith("הום בוט :)")) {
        reply = `${CUSTOMER_HEADER}\n${reply}`
      } else {
        reply = reply.replace(/^הום בוט :\)\s*/, `${CUSTOMER_HEADER}\n`)
      }
    }
  }

  reply = ensureSingleCustomerHeader(reply)

  const antiRepeat = replaceRepeatedReply(reply, output, history)
  if (antiRepeat) return antiRepeat

  return { ...output, reply }
}

/**
 * Never send the exact same reply twice in a row — a repeat means the previous
 * answer did not help. Apologize and offer a human instead (owner rule).
 */
function replaceRepeatedReply(
  reply: string,
  output: HomAgentOutput,
  history: HistoryMessage[]
): HomAgentOutput | null {
  if (output.action !== "reply" || !reply.trim()) return null

  const lastAssistant = [...history]
    .reverse()
    .find((message) => message.role === "assistant" && message.content.trim())
  if (!lastAssistant) return null
  if (normalizeMessageText(lastAssistant.content) !== normalizeMessageText(reply)) {
    return null
  }

  const target = inferHumanHandoffAction(history, null)
  const targetLabel = target === "human_sales" ? "יועץ מכירות" : "נציג שירות"
  return {
    action: "reply",
    reply: `${CUSTOMER_HEADER}
סליחה, נראה שלא הצלחתי להבין אתכם נכון 🙏
האם להעביר את השיחה ל${targetLabel} שימשיך מכאן?`,
  }
}

const HALLUCINATED_PORTAL_RE = /https?:\/\/(?:www\.)?my\.hom-?group\.co\.il\/?/gi

function sanitizeHallucinatedPortalUrls(reply: string, whatsappPhone?: string | null) {
  if (!/my\.hom-?group\.co\.il/i.test(reply)) return reply
  const portalUrl = buildReturnsPortalUrl(whatsappPhone)
  if (/החלפ/i.test(reply)) {
    return reply
      .replace(HALLUCINATED_PORTAL_RE, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }
  return reply.replace(HALLUCINATED_PORTAL_RE, portalUrl)
}

function shouldSkipHeader(userText: string, reply: string) {
  if (isSelfContainedGreetingReply(reply)) return true
  if (isCasualGreeting(userText) && /^(?:שלום|היי|הי|אהלן)/i.test(reply.trim())) {
    return true
  }
  return reply.startsWith(CUSTOMER_HEADER)
}
