import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { isOrderCancellationSummaryLabel } from "@/lib/agents/service-intake"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/**
 * 534406245 — cancel + how-to; FAQ answered preorder status only; portal came only after reaffirm.
 */
describe("cancel how-to after status-only 534406245", () => {
  const opening =
    "שלום אני רוצה לבטל את ההזמנה שלי כיצד אוכל לעשות זאת?"

  it("detects pre-delivery cancel on opening wording", () => {
    assert.equal(isOrderCancellationSummaryLabel(opening), true)
  })

  it("prompt teaches cancel + how must include portal, not preorder-only", () => {
    const line = prompt.split("\n").find((l) => l.includes("Cancel + how (534406245)"))
    assert.ok(line, "missing cancel + how rule")
    assert.match(line!, /464488405/)
    assert.match(line!, /returns portal/)
    assert.match(line!, /never.*preorder ETA/i)
  })

  it("opening turn gets pre-delivery cancel hint", () => {
    const hints = buildConversationHints({
      history: [],
      body: opening,
      whatsappPhone: "0537737444",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /PRE-DELIVERY CANCEL OPENING/)
    assert.match(hints!, /534406245/)
    assert.match(hints!, /returns portal link/)
  })

  it("after status-only reply without portal, reaffirm still gets pre-delivery cancel hint", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: opening },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nבדקתי, סטטוס ההזמנה במערכת: בביצוע. הזמנה מוקדמת… חידוש מלאי בסביבות 15/11/2026.",
      },
    ]
    const hints = buildConversationHints({
      history,
      body: "אני רוצה לבטל אותה",
      whatsappPhone: "0537737444",
    })
    assert.notEqual(hints, null)
    assert.match(hints!, /PRE-DELIVERY CANCEL OPENING/)
    assert.match(hints!, /534406245/)
    assert.match(hints!, /never.*end at preorder ETA/i)
  })
})
