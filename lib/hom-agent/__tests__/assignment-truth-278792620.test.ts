import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  crmHoldsHumanAssignment,
  externalAssignmentWouldReplaceHuman,
  shouldIgnoreLandbotAssignmentEvent,
} from "@/lib/crm/conversation-assign"
import { HOM_CRM_BOT_AGENT_CODE } from "@/lib/landbot/api-agent-ids"
import type { HistoryMessage } from "@/lib/agents/types"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"

const HUMAN = "1041736"

describe("assignment lock 278792620", () => {
  it("treats a rep code as a human lock and the API bot as not", () => {
    assert.equal(crmHoldsHumanAssignment(HUMAN), true)
    assert.equal(crmHoldsHumanAssignment(HOM_CRM_BOT_AGENT_CODE), false)
    assert.equal(crmHoldsHumanAssignment(null), false)
    assert.equal(crmHoldsHumanAssignment(""), false)
  })

  it("blocks Landbot from clearing a human or replacing them with the API bot", () => {
    assert.equal(externalAssignmentWouldReplaceHuman(HUMAN, HOM_CRM_BOT_AGENT_CODE), true)
    assert.equal(externalAssignmentWouldReplaceHuman(HUMAN, null), true)
    assert.equal(externalAssignmentWouldReplaceHuman(HUMAN, ""), true)
    assert.equal(externalAssignmentWouldReplaceHuman(HUMAN, "533841"), false)
    assert.equal(
      externalAssignmentWouldReplaceHuman(HOM_CRM_BOT_AGENT_CODE, "533841"),
      false
    )
  })

  it("ignores a Landbot unassign or API-bot assign while our human is stored", () => {
    assert.equal(
      shouldIgnoreLandbotAssignmentEvent({
        crmAgentCode: HUMAN,
        action: "unassign",
        eventAgentId: null,
      }),
      true
    )
    assert.equal(
      shouldIgnoreLandbotAssignmentEvent({
        crmAgentCode: HUMAN,
        action: "assign",
        eventAgentId: Number(HOM_CRM_BOT_AGENT_CODE),
      }),
      true
    )
    assert.equal(
      shouldIgnoreLandbotAssignmentEvent({
        crmAgentCode: HUMAN,
        action: "assign",
        eventAgentId: Number(HUMAN),
      }),
      false
    )
    assert.equal(
      shouldIgnoreLandbotAssignmentEvent({
        crmAgentCode: HOM_CRM_BOT_AGENT_CODE,
        action: "unassign",
        eventAgentId: null,
      }),
      false
    )
  })

  it("does not teach the model to claim the rep already has the case", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבסדר, אני מעביר עכשיו לנציג שירות.\n\nהנציג יקבל את כל הפרטים.",
      },
    ]
    const hints = buildConversationHints({
      body: "הזמנתי שטיח ב23/9 ועוד לא הגיע אשמח לדעת מתי הוא יגיע אלי",
      history,
    })
    assert.match(hints ?? "", /ASSIGNMENT TRUTH \(278792620\)/)
    assert.match(hints ?? "", /action reply/)
    const prompt = readFileSync("lib/hom-agent/prompts/hom-bot.md", "utf8")
    assert.match(prompt, /278792620/)
    assert.match(prompt, /never tell the customer the inquiry is already with a rep/)
  })
})
