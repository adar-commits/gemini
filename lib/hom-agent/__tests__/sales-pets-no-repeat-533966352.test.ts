import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { extractSalesIntake } from "@/lib/agents/sales-intake"
import { buildConversationHints } from "@/lib/hom-agent/conversation-hints"
import type { HistoryMessage } from "@/lib/agents/types"

afterEach(() => {
  delete process.env.SALES_INTAKE_MODE
})

/** Replay 533966352 — after לא on pets, room photo must not trigger another pets question. */
describe("sales pets no repeat (533966352)", () => {
  const historyBeforeRoomPhoto: HistoryMessage[] = [
    {
      role: "user",
      content:
        "אני מחפש שטיח בסגנון של דגם בל שלכם רק עם פסים ישרים ולא קווין מעוגלים. בצבע קרם או בז׳ לסלון.",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nבכיף מאור, שטיח בסגנון של בל עם פסים ישרים, בקרם או בז׳ לסלון. אעביר את זה ליועץ המכירות שיתאים לך דגמים. כדי שיהיה לו מה להציע: מה גודל הספה או המידות הכלליות של הסלון (למשל 4×5 מ׳)?",
    },
    { role: "user", content: "הספה ברוחב 3 מטר" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nמעולה, רשמתי ספה ברוחב 3 מטר.\n\nהשטיח צריך להתאים גם לבעלי חיים?",
    },
    { role: "user", content: "לא" },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nרשמתי, בלי בעלי חיים. יש דרישות מיוחדות? למשל קל לניקוי, עמידות לילדים, או משהו אחר. ואם נוח לך, אפשר לשלוח גם תמונה אחת ברורה של הסלון. זה יעזור ליועץ העיצוב.",
    },
  ]

  const roomPhotoBody =
    "זה הסלון [media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/533715674/7HEPJU09PBVXFZ3X9RXKOCQFZTWMI38F.jpg]"

  it("extracts pets=none from לא after pets question", () => {
    const intake = extractSalesIntake(historyBeforeRoomPhoto, roomPhotoBody)
    assert.equal(intake.pets, "none")
  })

  it("emits pets-already-answered and room-photo hints on photo turn", () => {
    process.env.SALES_INTAKE_MODE = "llm"
    const hints = buildConversationHints({
      body: roomPhotoBody,
      history: historyBeforeRoomPhoto,
      phone: "+972547495083",
    })
    assert.match(hints ?? "", /PETS ALREADY ANSWERED/i)
    assert.match(hints ?? "", /never re-ask room\/product\/pets/i)
    assert.doesNotMatch(hints ?? "", /בעלי חיים — האם השטיח אמור להתאים/i)
  })
})
