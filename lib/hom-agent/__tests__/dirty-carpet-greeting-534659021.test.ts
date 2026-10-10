import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { isServiceHandoffSummaryText } from "@/lib/agents/service-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

const BAD_SUMMARY =
  "*הום בוט :)*\nכדי שהנציג לא יצטרך לשאול שוב, זה מה שאעביר לו:\n• מס׳ הזמנה: ⁦78031⁩\n• פנייה לשירות לקוחות\n• משך ההמתנה: שבוע\nזה מדויק, או שחסר משהו?"

const OPENING =
  "היי,שבוע טוב, הזמנו מכם 4 שטיחים הזמנה 133467 אחד השטיחים הגיע מלוכלך,אני אשמח לבדיקה מה ניתן לעשות בנושא ואם ניתן להחליף ולשלוח שטיח נקי חדש במקום.מצב תמונה . [תמונה][media:image:https://storage.googleapis.com/media.landbot.io/example.jpg]"

function historyThroughOrderConfirm(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    {
      role: "assistant",
      content:
        "*הום בוט :)* לא מצאתי את ההזמנה ⁦133467⁩ על הטלפון (054-7003816). מה מספר הטלפון שבוצעה עליו ההזמנה?",
    },
    { role: "user", content: "0535303816" },
    {
      role: "assistant",
      content:
        "*הום בוט :)* מצאתי הזמנה שבוצעה לפני 10 ימים באתר אינטרנט, על סך 2,796 ש״ח. זו ההזמנה? (מס׳ הזמנה ⁦78031⁩)",
      awaiting: "order_confirm",
    },
    { role: "user", content: "כן" },
  ]
}

/** Replay 534659021 — «שבוע טוב» greeting must not become wait-duration in service recap. */
describe("dirty carpet greeting service recap (534659021)", () => {
  it("flags the bad production summary missing defect and inventing wait from greeting", () => {
    assert.equal(isServiceHandoffSummaryText(BAD_SUMMARY), true)
    assert.match(BAD_SUMMARY, /משך ההמתנה: שבוע/)
    assert.doesNotMatch(BAD_SUMMARY, /מלוכלך/)
    assert.doesNotMatch(BAD_SUMMARY, /החלפ/)
  })

  it("prompt forbids «שבוע טוב» as wait duration in rep summary", () => {
    const block = prompt.slice(
      prompt.indexOf("**Greeting «שבוע טוב» (534659021):**"),
      prompt.indexOf("**Order confirm, no issue stated yet (534367153):**")
    )
    assert.match(block, /534659021/)
    assert.match(block, /שבוע טוב/)
    assert.match(block, /משך ההמתנה/)
  })

  it("hints full defect recap after order confirm — not greeting-as-wait", () => {
    const history = historyThroughOrderConfirm().slice(0, -1)
    const hints = buildConversationHints({ history, body: "כן" }) ?? ""
    assert.match(hints, /534659021|505886895/)
    assert.match(hints, /שבוע טוב/)
    assert.match(hints, /never a generic lone «פנייה לשירות לקוחות»/i)
    assert.doesNotMatch(hints, /ORDER CONFIRM NO ISSUE STATED \(534367153\)/)
  })
})
