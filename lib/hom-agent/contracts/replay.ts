import {
  isActiveDigitalDocumentFlow,
  isDigitalDocumentRequest,
  shouldDeferDocumentFlowToOrderLookup,
  shouldReleaseStructuredDocumentFlow,
} from "@/lib/agents/digital-document-flow"
import {
  classifyPostPurchaseCase,
  isOrderModificationRequest,
  isRefundTimelineQuestion,
  isReturnPolicyQuestion,
  isReturnShippingFeeQuestion,
} from "@/lib/agents/inquiry-intent"
import { coerceKbSelfServiceFaqAction } from "@/lib/agents/kb-self-service-faq"
import {
  isReturnExchangePolicyFaqQuestion,
  isRugCleaningServiceQuestion,
} from "@/lib/agents/policy-subjects"
import { isBranchReviewLinkRequest } from "@/lib/agents/branch-google-reviews"
import { buildBranchReplyForText } from "@/lib/agents/branches"
import { isShippingStatusQuestion } from "@/lib/agents/shipping"
import { resolveCrmDepartmentForTurn } from "@/lib/crm/conversation-department"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import {
  runPreTurnGuards,
  runStructuredDocumentPreTurn,
  runStructuredKbSelfServiceFaqPreTurn,
  runStructuredOrderLookupPreTurn,
  runStructuredPostOrderCompletedPreTurn,
  runStructuredPostOrderExchangePreTurn,
  runStructuredExchangeExecutionPreTurn,
  runStructuredInventoryPreTurn,
  runStructuredReturnOptionsPreTurn,
  runStructuredSalesIntakePreTurn,
} from "@/lib/hom-agent/pre-turn"
import type {
  ContractAssertion,
  ContractReplayFailure,
  ContractReplayResult,
  ConversationContract,
  PreTurnHandler,
} from "@/lib/hom-agent/contracts/types"

const CLASSIFIERS: Record<string, (...args: string[]) => boolean> = {
  isReturnShippingFeeQuestion: (text) => isReturnShippingFeeQuestion(text),
  isReturnPolicyQuestion: (text) => isReturnPolicyQuestion(text),
  isReturnExchangePolicyFaqQuestion: (text) => isReturnExchangePolicyFaqQuestion(text),
  isRefundTimelineQuestion: (text) => isRefundTimelineQuestion(text),
  isRugCleaningServiceQuestion: (text) => isRugCleaningServiceQuestion(text),
  isOrderModificationRequest: (text) => isOrderModificationRequest(text),
  isDigitalDocumentRequest: (text) => isDigitalDocumentRequest(text),
  isShippingStatusQuestion: (text) => isShippingStatusQuestion(text),
  isBranchReviewLinkRequest: (text) => isBranchReviewLinkRequest(text),
  classifyPostPurchaseCase_missing_item: (text) =>
    classifyPostPurchaseCase(text) === "missing_item",
  classifyPostPurchaseCase_dissatisfaction: (text) =>
    classifyPostPurchaseCase(text) === "dissatisfaction",
  classifyPostPurchaseCase_defect: (text) => classifyPostPurchaseCase(text) === "defect",
  classifyPostPurchaseCase_return_pickup_pending: (text) =>
    classifyPostPurchaseCase(text) === "return_pickup_pending",
}

const DOCUMENT_FLOW: Record<
  string,
  (history: ConversationContract["history"], body: string) => boolean
> = {
  shouldReleaseStructuredDocumentFlow: (history, body) =>
    shouldReleaseStructuredDocumentFlow(history, body),
  shouldDeferDocumentFlowToOrderLookup: (history, body) =>
    shouldDeferDocumentFlowToOrderLookup(history, body),
  isActiveDigitalDocumentFlow: (history, body) =>
    isActiveDigitalDocumentFlow(history, body),
}

async function runPreTurnHandler(
  handler: PreTurnHandler,
  contract: ConversationContract
) {
  const turn = { text: contract.turn.text, media: [] as const }
  const input = {
    turn,
    history: contract.history,
    phone: contract.turn.phone,
    lastAgent: null as const,
  }

  switch (handler) {
    case "guards":
      return runPreTurnGuards(input)
    case "kb_faq":
      return runStructuredKbSelfServiceFaqPreTurn(input)
    case "document":
      return await runStructuredDocumentPreTurn(input)
    case "order":
      return await runStructuredOrderLookupPreTurn(input)
    case "return_options":
      return runStructuredReturnOptionsPreTurn(input)
    case "exchange_execution":
      return runStructuredExchangeExecutionPreTurn(input)
    case "post_order_exchange":
      return runStructuredPostOrderExchangePreTurn(input)
    case "post_order_completed":
      return await runStructuredPostOrderCompletedPreTurn(input)
    case "sales_intake":
      return runStructuredSalesIntakePreTurn(input)
    case "inventory":
      return await runStructuredInventoryPreTurn(input)
    default: {
      const never: never = handler
      throw new Error(`Unknown pre-turn handler: ${never}`)
    }
  }
}

async function evaluateAssertion(
  contract: ConversationContract,
  assertion: ContractAssertion,
  index: number
): Promise<ContractReplayFailure[]> {
  const failures: ContractReplayFailure[] = []
  const push = (message: string) => {
    failures.push({ contractId: contract.id, assertionIndex: index, message })
  }

  if (assertion.type === "preTurn") {
    const result = await runPreTurnHandler(assertion.handler, contract)
    const handled = result.kind === "handled"
    const expectedHandled = assertion.expect === "handled"

    if (handled !== expectedHandled) {
      push(
        `preTurn ${assertion.handler}: expected ${assertion.expect}, got ${result.kind}`
      )
      return failures
    }

    if (handled && assertion.action && result.kind === "handled") {
      if (result.action !== assertion.action) {
        push(
          `preTurn ${assertion.handler}: expected action ${assertion.action}, got ${result.action}`
        )
      }
      for (const token of assertion.replyMustInclude ?? []) {
        if (!result.reply.includes(token)) {
          push(`preTurn reply must include "${token}"`)
        }
      }
      for (const token of assertion.replyMustNotInclude ?? []) {
        if (result.reply.includes(token)) {
          push(`preTurn reply must not include "${token}"`)
        }
      }
    }
    return failures
  }

  if (assertion.type === "hints") {
    const hints =
      buildConversationHints({
        body: contract.turn.text,
        history: contract.history,
        whatsappPhone: contract.turn.phone,
      }) ?? ""

    for (const pattern of assertion.hintMustMatch ?? []) {
      if (!new RegExp(pattern, "i").test(hints)) {
        push(`hints must match /${pattern}/i`)
      }
    }
    for (const pattern of assertion.hintMustNotMatch ?? []) {
      if (new RegExp(pattern, "i").test(hints)) {
        push(`hints must not match /${pattern}/i`)
      }
    }
    return failures
  }

  if (assertion.type === "classifier") {
    const fn = CLASSIFIERS[assertion.name]
    if (!fn) {
      push(`unknown classifier: ${assertion.name}`)
      return failures
    }
    const text = assertion.args?.[0] ?? contract.turn.text
    const actual = fn(text)
    if (actual !== assertion.expect) {
      push(
        `classifier ${assertion.name}(${JSON.stringify(text)}): expected ${assertion.expect}, got ${actual}`
      )
    }
    return failures
  }

  if (assertion.type === "coerce") {
    const coerced = coerceKbSelfServiceFaqAction(
      { action: assertion.inputAction, reply: "test" },
      contract.turn.text,
      contract.history
    )
    if (coerced.action !== assertion.expectAction) {
      push(
        `coerce ${assertion.inputAction}: expected ${assertion.expectAction}, got ${coerced.action}`
      )
    }
    return failures
  }

  if (assertion.type === "crm") {
    const resolved = resolveCrmDepartmentForTurn({
      llmDepartment: assertion.llmDepartment ?? undefined,
      history: contract.history,
      body: contract.turn.text,
    })
    if (!resolved) {
      push(`crm: expected department ${assertion.department}, got null`)
      return failures
    }
    if (resolved.department !== assertion.department) {
      push(
        `crm: expected department ${assertion.department}, got ${resolved.department}`
      )
    }
    if (assertion.source && resolved.source !== assertion.source) {
      push(`crm: expected source ${assertion.source}, got ${resolved.source}`)
    }
    return failures
  }

  if (assertion.type === "documentFlow") {
    const fn = DOCUMENT_FLOW[assertion.name]
    if (!fn) {
      push(`unknown documentFlow check: ${assertion.name}`)
      return failures
    }
    const actual = fn(contract.history, contract.turn.text)
    if (actual !== assertion.expect) {
      push(
        `documentFlow ${assertion.name}: expected ${assertion.expect}, got ${actual}`
      )
    }
    return failures
  }

  return failures
}

export async function replayContract(
  contract: ConversationContract
): Promise<ContractReplayResult> {
  const failures: ContractReplayFailure[] = []

  for (let index = 0; index < contract.assertions.length; index += 1) {
    const batch = await evaluateAssertion(contract, contract.assertions[index], index)
    failures.push(...batch)
  }

  if (contract.snapshot) {
    const kb = runStructuredKbSelfServiceFaqPreTurn({
      turn: { text: contract.turn.text, media: [] },
      history: contract.history,
      phone: contract.turn.phone,
    })
    const action =
      kb.kind === "handled" ? kb.action : contract.snapshot.action
    if (action !== contract.snapshot.action) {
      failures.push({
        contractId: contract.id,
        assertionIndex: -1,
        message: `snapshot action: expected ${contract.snapshot.action}, got ${action}`,
      })
    }
    if (kb.kind === "handled") {
      for (const token of contract.snapshot.replyMustInclude ?? []) {
        if (!kb.reply.includes(token)) {
          failures.push({
            contractId: contract.id,
            assertionIndex: -1,
            message: `snapshot reply must include "${token}"`,
          })
        }
      }
      for (const token of contract.snapshot.replyMustNotInclude ?? []) {
        if (kb.reply.includes(token)) {
          failures.push({
            contractId: contract.id,
            assertionIndex: -1,
            message: `snapshot reply must not include "${token}"`,
          })
        }
      }
    }
  }

  return { contractId: contract.id, ok: failures.length === 0, failures }
}

export async function replayAllContracts(
  contracts: ConversationContract[]
): Promise<ContractReplayResult[]> {
  const results: ContractReplayResult[] = []
  for (const contract of contracts) {
    results.push(await replayContract(contract))
  }
  return results
}

/** Collision-pair legislator: both sides must route differently. */
export function assertCollisionPairDistinct(
  leftText: string,
  rightText: string,
  leftRoute: string,
  rightRoute: string
) {
  if (leftRoute === rightRoute) {
    throw new Error(
      `Collision pair routes must differ: "${leftText}" and "${rightText}" both → ${leftRoute}`
    )
  }
}

export function legislatorRouteForRefundTimeline(text: string) {
  return isRefundTimelineQuestion(text) ? "refund_timeline" : "other"
}

export function legislatorRouteForReturnLocation(text: string) {
  if (/איפה\s+(?:מחזיר|להחזיר)|איך\s+מחזיר|לסניף\s+להחזיר/i.test(text)) {
    return "return_location"
  }
  if (isReturnPolicyQuestion(text) && !isRefundTimelineQuestion(text)) {
    return "return_location"
  }
  return "other"
}

export function legislatorRouteForBranchReview(text: string) {
  return isBranchReviewLinkRequest(text) ? "branch_review_link" : "other"
}

export function legislatorRouteForBranchList(text: string) {
  if (/איזה\s+סניפים|כתובת\s+סניף|שעות\s+פתיחה/i.test(text)) {
    const reply = buildBranchReplyForText(text)
    if (reply && !isBranchReviewLinkRequest(text)) return "branch_list"
  }
  return "other"
}

export function legislatorRouteForReturnPolicy(text: string) {
  return isReturnPolicyQuestion(text) && !/רוצה\s+להחזיר/i.test(text)
    ? "return_policy"
    : "other"
}

export function legislatorRouteForReturnRequest(text: string) {
  return /רוצה\s+להחזיר|להחזיר\s+את\s+השטיח/i.test(text) &&
    classifyPostPurchaseCase(text) !== "defect"
    ? "return_request"
    : "other"
}

export function legislatorRouteForOrderStatus(text: string) {
  return isShippingStatusQuestion(text) ? "order_status" : "other"
}

export function legislatorRouteForShippingPolicy(text: string) {
  return /כמה\s+עולה\s+משלוח|מדיניות\s+משלוח/i.test(text) ? "shipping_policy" : "other"
}

export function legislatorRouteForDissatisfaction(text: string) {
  return classifyPostPurchaseCase(text) === "dissatisfaction"
    ? "dissatisfaction"
    : "other"
}

export function legislatorRouteForDefect(text: string) {
  return classifyPostPurchaseCase(text) === "defect" ? "defect" : "other"
}
