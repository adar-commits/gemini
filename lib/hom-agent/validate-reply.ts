import { buildNeverStuckReply } from "@/lib/agent-core/fallbacks"
import { CUSTOMER_HEADER } from "@/lib/agents/types"
import {
  dedupeGreetingBotName,
  isCasualGreeting,
  isSelfContainedGreetingReply,
  sanitizeBotGenderSlashes,
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

  reply = sanitizeBotGenderSlashes(reply)
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

  return { ...output, reply }
}

function shouldSkipHeader(userText: string, reply: string) {
  if (isSelfContainedGreetingReply(reply)) return true
  if (isCasualGreeting(userText) && /^(?:שלום|היי|הי|אהלן)/i.test(reply.trim())) {
    return true
  }
  return reply.startsWith(CUSTOMER_HEADER)
}
