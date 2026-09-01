import { stripAppendedDeliveryPolicyFromOrderStatus } from "@/lib/agents/shipping"
import { sanitizeDissatisfactionRescueReply } from "@/lib/agents/dissatisfaction"
import {
  RETURNS_PORTAL_URL,
  sanitizeCreditRedemptionWording,
  sanitizeRefundPolicyWording,
} from "@/lib/agents/policy-subjects"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import {
  dedupeGreetingBotName,
  ensureSingleCustomerHeader,
  isCasualGreeting,
  isSelfContainedGreetingReply,
  sanitizeCustomerAddress,
} from "@/lib/agents/greeting"
import type { HomAgentOutput } from "@/lib/hom-agent/output-schema"

export function validateHomAgentReply(
  output: HomAgentOutput,
  userText: string
): HomAgentOutput {
  let reply = output.reply?.trim() ?? ""
  if (!reply && output.action === "reply") {
    reply = buildNeverStuckReply()
  }

  reply = sanitizeCustomerAddress(reply)
  reply = sanitizeDissatisfactionRescueReply(reply)
  reply = sanitizeRefundPolicyWording(reply)
  reply = sanitizeCreditRedemptionWording(reply)
  reply = stripAppendedDeliveryPolicyFromOrderStatus(reply)
  reply = sanitizeHallucinatedPortalUrls(reply)
  reply = dedupeGreetingBotName(reply)

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

  return { ...output, reply }
}

const HALLUCINATED_PORTAL_RE = /https?:\/\/(?:www\.)?my\.hom-?group\.co\.il\/?/gi

function sanitizeHallucinatedPortalUrls(reply: string) {
  if (!/my\.hom-?group\.co\.il/i.test(reply)) return reply
  if (/החלפ/i.test(reply)) {
    return reply
      .replace(HALLUCINATED_PORTAL_RE, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }
  return reply.replace(HALLUCINATED_PORTAL_RE, RETURNS_PORTAL_URL)
}

function shouldSkipHeader(userText: string, reply: string) {
  if (isSelfContainedGreetingReply(reply)) return true
  if (isCasualGreeting(userText) && /^(?:שלום|היי|הי|אהלן)/i.test(reply.trim())) {
    return true
  }
  return reply.startsWith(CUSTOMER_HEADER)
}
