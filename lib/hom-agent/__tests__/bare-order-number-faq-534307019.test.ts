import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { shouldSkipInactivityPingForCompleteReply } from "@/lib/agents/inactivity-policy"
import { isBareOrderNumberDisclosureSettledThread } from "@/lib/agents/order-lookup"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const FAQ_ANSWER =
  "*הום בוט :)*\nמספר ההזמנה שלך הוא SO26025020. הוא מופיע גם בקבלה ששלחנו לך ובקישור למעקב."

const INVOICE =
  "שלום אלכס סטוייאנוב 👋, תודה על רכישתך בשטיח האדום, להלן קישור לחשבונית מס הדיגיטלית שלך: https://documents.carpetshop.co.il/documents/1b2a5c60-b921-46cd-9293-6418acdf2f7d נשמח לעמוד לרשותך בכל שאלה בערוצי הדיגיטל שלנו - תתחדשו ❤️"

/** Replay 534307019 — order # FAQ answered; must not hand off on quiet window / duplicate Master. */
describe("bare order number FAQ 534307019", () => {
  const history: HistoryMessage[] = [
    { role: "user", content: "מה המספר הזמנה ?" },
    { role: "assistant", content: FAQ_ANSWER, agent: "faq" },
    { role: "assistant", content: INVOICE },
  ]

  it("detects settled bare order-number disclosure after last user turn", () => {
    assert.equal(isBareOrderNumberDisclosureSettledThread(history), true)
  })

  it("skips inactivity ping while outbound invoice is last assistant line", () => {
    assert.equal(shouldSkipInactivityPingForCompleteReply(history, "faq"), true)
  })

  it("hints no human_service on duplicate pass", () => {
    const hints = buildConversationHints({
      history,
      body: "",
      whatsappPhone: "+972500000000",
    })
    assert.match(hints ?? "", /BARE ORDER NUMBER FAQ SETTLED \(534307019\)/)
    assert.match(hints ?? "", /never.*human_service/i)
  })

  it("prompt documents bare order number ask answered", () => {
    const prompt = readFileSync(
      join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"),
      "utf8"
    )
    const line = prompt.split("\n").find((l) => l.includes("534307019"))
    assert.ok(line)
    assert.match(line!, /מה מספר ההזמנה/)
    assert.match(line!, /never.*human_service/i)
  })
})
