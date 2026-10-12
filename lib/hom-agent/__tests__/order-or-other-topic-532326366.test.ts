import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { orderIdGivenInThread } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const ORDER_OR_OTHER_ASK =
  "*הום בוט :)* היי חן, בוקר טוב! מדובר בהזמנה ⁦#76959⁩, או שיש משהו אחר שאפשר לעזור בו?"

/** Replay 532326366 — same-order confirm after order-or-other ask must not re-handoff. */
describe("order or other topic 532326366", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "אשמח לשוחח עם נציג" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* בשמחה. מעביר לנציג שירות. מעולה, העברתי את השיחה לנציג שירות.",
    },
    { role: "user", content: "תודה" },
    {
      role: "assistant",
      content: "*הום בוט :)* בשמחה! הנציג כבר קיבל את הפנייה.",
    },
    { role: "user", content: "היי" },
    { role: "assistant", content: ORDER_OR_OTHER_ASK },
  ]

  const body = "אותה הזנה\nהזמנה"

  it("names order #76959 from bot order-or-other ask", () => {
    assert.equal(orderIdGivenInThread(history), "76959")
  })

  it("hints lookup and no stale human_service", () => {
    const hints = buildConversationHints({ body, history }) ?? ""
    assert.match(hints, /ORDER OR OTHER TOPIC YES \(532326366\)/)
    assert.match(hints, /76959/)
    assert.match(hints, /NEVER human_service/)
    assert.match(hints, /lookup_order_status/)
  })

  it("prompt teaches order-or-other clarify without stale handoff", () => {
    const line = prompt.split("\n").find((l) => l.includes("532326366"))
    assert.ok(line, "missing 532326366 order-or-other rule")
    assert.match(line!, /משהו אחר/)
    assert.match(line!, /human_service/)
  })
})
