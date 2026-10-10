import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const OPENING =
  "היי, אשמח לקבל עדכון כשהמידה S - 120*170 של שטיח באני גרז' BUNNY חוזרת למלאי"

const BOT_OFFER =
  "*הום בוט :)*\nהיי דקלה! 😊 קיבלתי את הבקשה שלך לגבי שטיח באני גרז' (BUNNY) במידה S, 120*170. בינתיים אולי אמצא לך שטיח דומה שזמין כבר עכשיו?"

const BOT_REFERENCE =
  "*הום בוט :)*\nבשמחה! 🙂 רק לוודא: לחפש לפי המידה והצורה של שטיח באני גרז' 120*170?"

function historyBeforeHandoff(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    { role: "assistant", content: BOT_OFFER },
    { role: "user", content: "אפשר" },
    { role: "assistant", content: BOT_REFERENCE },
  ]
}

/** Replay 534115284 — handoff recap must not invent products (e.g. JOY) the customer never named. */
describe("back-in-stock recap accuracy 534115284", () => {
  it("prompt binds step-3 recap to thread-stated models only", () => {
    const line = prompt.split("\n").find((l) => l.includes("Back-in-stock notification"))
    assert.ok(line)
    assert.match(line!, /534115284/)
    assert.match(line!, /only.*explicitly said/i)
    assert.match(line!, /never.*invent/i)
  })

  it("confirm turn hint forbids adding models not in the thread", () => {
    const hints = buildConversationHints({ body: "כן", history: historyBeforeHandoff() })
    assert.match(hints ?? "", /534115284/)
    assert.match(hints ?? "", /never.*add other SKUs/i)
    assert.match(hints ?? "", /action human_sales/i)
    assert.match(hints ?? "", /do not invent JOY when they only said BUNNY/i)
  })
})
