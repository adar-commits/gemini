import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import { extractRequestedModel } from "@/lib/agents/product-handoff"
import type { HistoryMessage } from "@/lib/agents/types"

const OPENING =
  "היי אשמח לפרטים נוספים לגבי שטיח סידני 01 קרם SYDNEY שטיח סידני 01 קרם SYDNEY"

function historyThroughModelQuestion(): HistoryMessage[] {
  return [
    { role: "user", content: OPENING },
    {
      role: "assistant",
      content:
        "*הום בוט :)* היי רוני! בשמחה, נעזור עם שטיח סידני 01 קרם. כדי שיועץ המכירות יוכל להתאים את הפרטים, לאיזה חלל השטיח מיועד? סלון, חדר שינה, חדר ילדים או מקום אחר?",
    },
    { role: "user", content: "סלון" },
    {
      role: "assistant",
      content:
        "מעולה, סלון. מה גודל הסלון בערך, או כמה גדולה הספה? למשל 3×4 מ׳ או ספה תלת-מושבית. זה יעזור ליועץ להתאים את הפרטים.",
    },
    {
      role: "user",
      content: "אני רק רוצה לדעת אם אפשר לשלוח לפני נובמבר",
    },
    {
      role: "assistant",
      content:
        'היי לא, זו סחורה שהזמנו מחו"ל ולא ניתן להקדים את התאריך המשוער. יחד עם זאת, תמיד קונטיינרים מקדימים בכמה ימים',
    },
    { role: "user", content: "איך קוראים לדגם הזה?" },
  ]
}

/** Replay 533700177 — demonstrative model question must stay on Sydney, not Vega. */
describe("thread product binding (533700177)", () => {
  it("extracts Sydney as the requested model from the opening message", () => {
    assert.match(extractRequestedModel(OPENING) ?? "", /סידני|SYDNEY/i)
  })

  it("emits thread product binding hint on demonstrative model question", () => {
    const history = historyThroughModelQuestion()
    const body = "איך קוראים לדגם הזה?"
    const hints = buildConversationHints({ history, body }) ?? ""
    assert.match(hints, /533700177/)
    assert.match(hints, /סידני|SYDNEY/i)
    assert.match(hints, /Never send a different model/)
    assert.doesNotMatch(hints, /vega-cream-rec/i)
  })

  it("the bad reply linked to the wrong product", () => {
    const badReply = "https://www.carpetshop.co.il/products/vega-cream-rec"
    assert.doesNotMatch(badReply, /sydney/i)
  })
})
