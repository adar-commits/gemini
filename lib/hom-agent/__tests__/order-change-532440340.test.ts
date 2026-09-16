import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isTransferPromisedInThread,
  shouldSkipInactivityForHumanWait,
} from "@/lib/agents/human-waiting"
import {
  isWaitingForHumanRepReply,
  isInactivityStillHereReply,
} from "@/lib/agents/inactivity"
import { isOrderModificationRequest } from "@/lib/agents/inquiry-intent"
import { isOrderLookupCompletedInThread } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import {
  runPreTurnGuards,
  runStructuredOrderLookupPreTurn,
  runStructuredPostOrderExchangePreTurn,
} from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const PHONE = "+972528484703"

function historyThroughUnknownStatus(): HistoryMessage[] {
  return [
    { role: "user", content: "היי" },
    {
      role: "assistant",
      content: "*הום בוט :)*\nהיי! 😊 שמח שפנית — במה אוכל לעזור היום?",
    },
    { role: "user", content: "שינוי הזמנה" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nקודם אמצא את ההזמנה… האם היא רשומה על המספר ממנו אני מתכתב כרגע? (052-8484703)",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nאוקיי נדמה לי שמצאתי את ההזמנה… (מס׳ הזמנה #76996) נכון?",
    },
    { role: "user", content: "כן" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבדקתי, ההזמנה נמצאה, אך לא ניתן להציג כרגע סטטוס משלוח חד-משמעי. הפנייה תועבר להמשך טיפול.",
    },
  ]
}

/** Replay 532440340 / 052-8484703 — order change must hand off, not loop lookup. */
describe("order change after unknown shipping status (532440340)", () => {
  it("detects bare שינוי הזמנה as modification request", () => {
    assert.equal(isOrderModificationRequest("שינוי הזמנה"), true)
  })

  it("structured order pre-turn hands off on unknown delivery status", async () => {
    const history = historyThroughUnknownStatus().slice(0, 6)
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: "כן", media: [] },
      history,
      phone: PHONE,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.match(result.reply, /לא ניתן להציג כרגע סטטוס משלוח/)
  })

  it("does not treat waiting-for-rep as inactivity still-here ack", () => {
    const body = "כן, אני מחכה לנציג שלכם"
    assert.equal(isInactivityStillHereReply(body), false)
    assert.equal(isWaitingForHumanRepReply(body), true)
  })

  it("pre-turn handoffs when customer waits for rep after transfer promise", () => {
    const history: HistoryMessage[] = [
      ...historyThroughUnknownStatus(),
      {
        role: "assistant",
        content: "*הום בוט :)*\nAsaf, עדיין כאן?",
      },
    ]
    const result = runPreTurnGuards({
      turn: { text: "כן, אני מחכה לנציג שלכם", media: [] },
      history,
      customerName: "Asaf",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.equal(result.action, "human_service")
    assert.doesNotMatch(result.reply, /איך אוכל להמשיך לעזור/)
  })

  it("skips inactivity ping after transfer was promised", () => {
    const history = historyThroughUnknownStatus()
    assert.equal(isTransferPromisedInThread(history), true)
    assert.equal(
      shouldSkipInactivityForHumanWait({
        lastAction: "reply",
        history,
      }),
      true
    )
  })

  it("starts exchange intake instead of restarting phone lookup", () => {
    const history = historyThroughUnknownStatus()
    assert.equal(isOrderLookupCompletedInThread(history), true)

    const exchangeMessage =
      "אני רוצה להחליף את המוצר עם מוצר אחר\nאו לבטל ולהזמין מחדש\nמה נהיה?"
    const result = runStructuredPostOrderExchangePreTurn({
      turn: { text: exchangeMessage, media: [] },
      history,
      phone: PHONE,
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.match(result.reply, /נמשיך עם החלפה/)
    assert.equal(result.action, "reply")
  })

  it("hints order modification on שינוי הזמנה opener", () => {
    const hints = buildConversationHints({
      body: "שינוי הזמנה",
      history: [],
      whatsappPhone: "0528484703",
    })
    assert.match(hints ?? "", /ORDER MODIFICATION/i)
  })
})
