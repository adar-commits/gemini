import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { pickHomAgentModel } from "@/lib/agent-core/hard-case-model"
import type { HistoryMessage } from "@/lib/agents/types"

const SONNET = "anthropic/claude-sonnet-5"
const OPUS = "anthropic/claude-opus-5.5"

describe("pickHomAgentModel", () => {
  it("keeps Sonnet for a simple shipping question", () => {
    const pick = pickHomAgentModel({
      body: "איפה ההזמנה שלי?",
      turn: { text: "איפה ההזמנה שלי?", media: [] },
      history: [],
      defaultModel: SONNET,
    })
    assert.equal(pick.escalated, false)
    assert.equal(pick.model, SONNET)
    assert.equal(pick.tier, "T2")
  })

  it("escalates dissatisfaction without defect to Opus", () => {
    const pick = pickHomAgentModel({
      body: "קיבלתי את השטיח ולא אהבתי אותו",
      turn: { text: "קיבלתי את השטיח ולא אהבתי אותו", media: [] },
      history: [],
      defaultModel: SONNET,
    })
    assert.equal(pick.escalated, true)
    assert.equal(pick.model, OPUS)
    assert.equal(pick.tier, "T3")
    assert.equal(pick.reason, "dissatisfaction_or_policy_dispute")
  })

  it("escalates long multi-intent messages to Opus", () => {
    const body = [
      "אם אני מתלבט בין שני שטיחים אני יכול להשאיר אתכם?",
      "מה הסניף הכי קרוב לאילת?",
      "וגם אם המוצר יגיע פגום מה האפשרויות שלי?",
      "וגם האם אפשר לקבל החזר כספי במקום החלפה?",
    ].join("\n")
    const pick = pickHomAgentModel({
      body,
      turn: { text: body, media: [] },
      history: [],
      defaultModel: SONNET,
    })
    assert.equal(pick.escalated, true)
    assert.equal(pick.model, OPUS)
    assert.equal(pick.tier, "T3")
  })

  it("keeps Sonnet for a short service keyword without enough context", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "השטיח הגיע עם כתם" },
    ]
    const pick = pickHomAgentModel({
      body: "אני רוצה החזר כספי",
      turn: { text: "אני רוצה החזר כספי", media: [] },
      history,
      defaultModel: SONNET,
    })
    assert.equal(pick.escalated, false)
    assert.equal(pick.model, SONNET)
  })

  it("does not re-escalate Opus on the same hard-case reason in-session", () => {
    const pick = pickHomAgentModel({
      body: "קיבלתי את השטיח ולא אהבתי אותו",
      turn: { text: "קיבלתי את השטיח ולא אהבתי אותו", media: [] },
      history: [{ role: "user", content: "קיבלתי את השטיח ולא אהבתי אותו" }],
      defaultModel: SONNET,
      opusEscalatedReason: "dissatisfaction_or_policy_dispute",
    })
    assert.equal(pick.escalated, false)
    assert.equal(pick.model, SONNET)
    assert.match(pick.reason, /opus_followup/)
  })

  it("escalates complex service when the customer message is detailed enough", () => {
    const pick = pickHomAgentModel({
      body: "השטיח הגיע עם כתם גדול ואני רוצה החזר כספי מלא על ההזמנה",
      turn: {
        text: "השטיח הגיע עם כתם גדול ואני רוצה החזר כספי מלא על ההזמנה",
        media: [],
      },
      history: [],
      defaultModel: SONNET,
    })
    assert.equal(pick.escalated, true)
    assert.equal(pick.model, OPUS)
    assert.equal(pick.reason, "service_complexity")
  })
})
