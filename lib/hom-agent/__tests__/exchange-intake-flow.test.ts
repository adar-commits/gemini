import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildDissatisfactionRescueReply,
  resolveDissatisfactionRescueFollowUp,
} from "@/lib/agents/dissatisfaction"
import {
  buildExchangeKindQuestion,
  buildExchangeIntakeStartReply,
  EXCHANGE_INTAKE_STARTED_MARKER,
  extractExchangeIntake,
  inferExchangeReasonCode,
  isExchangeIntakeActive,
  isExchangeReadyForSwitchRequest,
  needsExchangeKindQuestion,
} from "@/lib/agents/exchange-intake"
import { isReturnExchangePolicyFaqQuestion } from "@/lib/agents/policy-subjects"
import { executeCreateSwitchRequest } from "@/lib/hom-agent/tools/switch-request"
import { executeLookupOrderStatus } from "@/lib/hom-agent/tools/order-status"
import { runStructuredReturnOptionsPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

function menuHistory(phone = "+972508713127"): HistoryMessage[] {
  return [{ role: "assistant", content: buildDissatisfactionRescueReply(phone) }]
}

describe("exchange intake flow", () => {
  it("menu → החזרה stays portal path without switch tool", async () => {
    const history = menuHistory()
    const preTurn = runStructuredReturnOptionsPreTurn({
      turn: { text: "רוצה להחזיר", media: [] },
      history,
      phone: "+972508713127",
    })
    assert.equal(preTurn.kind, "handled")
    if (preTurn.kind !== "handled") return
    assert.match(preTurn.reply, /returns\.carpetshop\.co\.il/)

    const tool = await executeCreateSwitchRequest({
      body: "רוצה להחזיר",
      phone: "+972508713127",
      history,
      exchangeKind: "same_model_color",
    })
    assert.equal(tool.ok, false)
  })

  it("menu → החלפה starts intake without immediate human_sales", () => {
    const history = menuHistory()
    assert.equal(resolveDissatisfactionRescueFollowUp("החלפה", "sales_offer"), "exchange_intake")
    const preTurn = runStructuredReturnOptionsPreTurn({
      turn: { text: "החלפה", media: [] },
      history,
    })
    assert.equal(preTurn.kind, "handled")
    if (preTurn.kind !== "handled") return
    assert.equal(preTurn.action, "reply")
    assert.match(preTurn.reply, new RegExp(EXCHANGE_INTAKE_STARTED_MARKER))
  })

  it("exchange intake active blocks lookup until intake started", async () => {
    const history = menuHistory()
    const blocked = await executeLookupOrderStatus({
      body: "SO26005938",
      phone: "+972508713127",
      history,
    })
    assert.equal(blocked.ok, false)

    const started: HistoryMessage[] = [
      ...history,
      { role: "assistant", content: buildExchangeIntakeStartReply() },
    ]
    assert.equal(isExchangeIntakeActive(started), true)
  })

  it("order confirmed → kind question pending", () => {
    const history: HistoryMessage[] = [
      { role: "assistant", content: buildExchangeIntakeStartReply() },
      { role: "user", content: "SO26005938" },
      {
        role: "assistant",
        content: "נדמה לי שמצאתי את ההזמנה SO26005938 — זו ההזמנה?",
      },
      { role: "user", content: "כן" },
      { role: "assistant", content: "בדקתי, לגבי הזמנה SO26005938 הסטטוס הוא נמסר." },
    ]
    assert.equal(isExchangeIntakeActive(history), true)
    assert.equal(needsExchangeKindQuestion(history), true)
    assert.match(buildExchangeKindQuestion(), /איזה\s+סוג\s+החלפה/)
  })

  it("kind A from color reply and reason code for kind C", () => {
    const history: HistoryMessage[] = [
      { role: "assistant", content: buildExchangeIntakeStartReply() },
      { role: "assistant", content: buildExchangeKindQuestion() },
      { role: "user", content: "רוצה צבע אחר" },
    ]
    const intake = extractExchangeIntake(history, "")
    assert.equal(intake.exchangeKind, "same_model_color")
    assert.equal(inferExchangeReasonCode("לא נראה כמו בתמונה באתר"), "different_from_website")
  })

  it("switch tool refused before order confirm", async () => {
    const history: HistoryMessage[] = [
      { role: "assistant", content: buildExchangeIntakeStartReply() },
      { role: "assistant", content: buildExchangeKindQuestion() },
      { role: "user", content: "צבע אחר" },
    ]
    const tool = await executeCreateSwitchRequest({
      body: "31503138-200290",
      phone: "0508713127",
      history,
      exchangeKind: "same_model_color",
      targetSku: "31503138-200290",
    })
    assert.equal(tool.ok, false)
  })

  it("exchange policy FAQ does not activate intake", () => {
    assert.equal(isReturnExchangePolicyFaqQuestion("מה מדיניות החלפה?"), true)
    assert.equal(isExchangeIntakeActive([]), false)
  })

  it("ready for API when kind C has reason", () => {
    const history: HistoryMessage[] = [
      { role: "assistant", content: buildExchangeIntakeStartReply() },
      {
        role: "assistant",
        content: "בדקתי, לגבי הזמנה SO26005938 הסטטוס הוא נמסר.",
      },
      { role: "assistant", content: buildExchangeKindQuestion() },
      { role: "user", content: "שטיח אחר לגמרי" },
      {
        role: "assistant",
        content: "מה לא אהבתם במוצר? זה חשוב כדי שנוכל להמשיך עם בקשת ההחלפה.",
      },
      { role: "user", content: "פשוט לא אהבתי את הצבע בפועל" },
    ]
    assert.equal(isExchangeReadyForSwitchRequest(history, ""), true)
  })
})
