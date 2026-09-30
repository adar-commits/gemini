import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/**
 * 348040437 — opening: "אשמח שנציג יתקשר אלי אני רוצה לבטל עסקה ולבצע חדשה".
 * FAQ agent answered packaging status + "שמחתי לעזור" instead of cancel + human_service.
 */
describe("cancel + callback opening 348040437", () => {
  const opening =
    "אשמח שנציג יתקשר אלי אני רוצה לבטל עסקה ולבצע חדשה"
  const history: HistoryMessage[] = [{ role: "user", content: "היי" }]

  it("prompt teaches pre-delivery cancel, not status-only lookup", () => {
    const line = prompt
      .split("\n")
      .find((l) => l.includes("Cancel + callback in opening message") && l.includes("348040437"))
    assert.ok(line, "missing cancel + callback opening rule")
    assert.match(line!, /464488405/)
    assert.match(line!, /Never.*lookup_order_status/)
    assert.match(line!, /warm-close/)
  })

  it("hints pre-delivery cancel execution on opening turn", () => {
    const hints = buildConversationHints({
      history,
      body: opening,
      whatsappPhone: "0546665360",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /PRE-DELIVERY CANCEL OPENING \(348040437/)
    assert.match(hints!, /action human_service/)
    assert.match(hints!, /Never lookup_order_status only/)
    assert.match(hints!, /warm-close/)
  })

  it("no cancel-opening hint after order already confirmed in thread", () => {
    const afterConfirm: HistoryMessage[] = [
      ...history,
      { role: "user", content: opening },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאוקיי נדמה לי שמצאתי את ההזמנה… (מס׳ הזמנה #12345)",
      },
      { role: "user", content: "כן" },
      {
        role: "assistant",
        content: "*הום בוט :)*\nבדקתי, ההזמנה נארזה…",
      },
    ]
    const hints = buildConversationHints({
      history: afterConfirm,
      body: "אני רוצה לבטל",
      whatsappPhone: "0546665360",
    })
    assert.doesNotMatch(hints ?? "", /PRE-DELIVERY CANCEL OPENING \(348040437/)
  })
})
