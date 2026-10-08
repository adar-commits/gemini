import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isShippingThreadFromHistory } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENER = "היי אשמח לדעת מתי השטיח שהזמנתי יגיע"
const BOT_ORDER_CARD =
  "*הום בוט :)*\nמצאתי הזמנה שבוצעה לפני 46 ימים בראשון לציון, על סך 1,000 ש״ח. זו ההזמנה? (מס׳ הזמנה SO26020168)"
const CONFIRM_AND_PHOTO = "הן כן יש לך תמונה של השטיח?"
const PHOTO_ONLY = "יש לך תמונה של השטיח?"
const BAD_REPLY =
  "*הום בוט :)*\nתודה על האישור מכאן אני לא יכול לשלוח תמונה של השטיח שבהזמנה. נציג שירות יכול לבדוק את מועד ההגעה של הזמנה SO26020168 וגם לשלוח תמונה של הדגם. להעביר לנציג שירות?"

/** Replay 530087154 — ETA opener + confirm + photo must lookup, not handoff-first. */
describe("shipping eta photo confirm 530087154", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: OPENER },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמצאתי הזמנה שבוצעה לפני 46 ימים בראשון לציון, על סך 195 ש״ח. זו ההזמנה? (מס׳ הזמנה SO26020169)",
    },
    { role: "user", content: "לא הזמנה לשטיח גדול סלון" },
    { role: "assistant", content: BOT_ORDER_CARD },
  ]

  it("thread is shipping from ETA opener", () => {
    assert.equal(isShippingThreadFromHistory(history), true)
  })

  it("prompt teaches lookup before handoff on ETA + photo confirm", () => {
    const line = prompt.split("\n").find((l) => l.includes("530087154"))
    assert.ok(line, "missing ETA confirm + photo rule for 530087154")
    assert.match(line!, /lookup_order_status/)
    assert.match(line!, /תמונה/)
  })

  it("hints bind merged confirm + photo to lookup on ETA thread", () => {
    const hints = buildConversationHints({ body: CONFIRM_AND_PHOTO, history }) ?? ""
    assert.match(hints, /ORDER CONFIRM \+ PHOTO ON ETA \(530087154\)|SHIPPING ORDER CONFIRM YES/)
    assert.match(hints, /lookup_order_status/)
    assert.doesNotMatch(hints, /EXPLICIT REP REQUEST/)
  })

  it("hints bind photo-only follow-up after prior confirm to lookup", () => {
    const withConfirm: HistoryMessage[] = [...history, { role: "user", content: "כן" }]
    const hints = buildConversationHints({ body: PHOTO_ONLY, history: withConfirm }) ?? ""
    assert.match(hints, /KNOWN ORDER CONFIRM \+ ETA|ORDER CONFIRM \+ PHOTO ON ETA \(530087154\)/)
    assert.match(hints, /lookup_order_status/)
  })

  it("bad reply offered handoff without lookup", () => {
    assert.match(BAD_REPLY, /לא יכול לשלוח תמונה/)
    assert.match(BAD_REPLY, /מועד ההגעה/)
    assert.match(BAD_REPLY, /להעביר לנציג/)
  })
})
