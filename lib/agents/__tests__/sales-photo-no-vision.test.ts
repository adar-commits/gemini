import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildSalesIntakeReply,
  buildSalesPhotoReceivedReply,
  shouldAckSalesRoomPhotoWithoutVision,
} from "@/lib/agents/sales-intake"
import { runStructuredSalesPhotoPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

const PHOTO_URL =
  "https://storage.googleapis.com/media.landbot.io/256062/customers/531457144/F9D26YF01LYJWAWBZDAVCJNZ078VNE60.jpg"

describe("sales room photo — no vision analysis", () => {
  const historyBeforePhoto: HistoryMessage[] = [
    {
      role: "user",
      content: "היי אשמח לפרטים נוספים לגבי שטיח סידני קרם/אפור",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nהיי! לגבי פרטים מדויקים הכי טוב לחבר אתכם ליועץ מכירות.\n\nלאיזה חלל מיועד השטיח?",
    },
    {
      role: "user",
      content: "אני מתלבטת\nאיזה צבע\nמתאים אצלי\nבסלון",
    },
    {
      role: "assistant",
      content:
        "*הום בוט :)*\nברור, בחירת צבע זה בדיוק הדבר שכדאי לראות.\n\nאפשר לשלוח תמונה אחת ברורה של החלל? זה יעזור מאוד ליועץ העיצוב.",
    },
  ]

  const photoTurn = {
    text: "לא מתאים",
    media: [{ kind: "image" as const, url: PHOTO_URL }],
  }

  it("routes sales photo ack without vision during color consult", () => {
    assert.equal(
      shouldAckSalesRoomPhotoWithoutVision(historyBeforePhoto, photoTurn, "faq"),
      true
    )
  })

  it("does not describe the room or rug in the photo ack", () => {
    const reply = buildSalesPhotoReceivedReply(
      historyBeforePhoto,
      `לא מתאים\n[תמונה][media:image:${PHOTO_URL}]`,
      photoTurn
    )
    assert.match(reply, /קיבלתי/)
    assert.match(reply, /יועץ/)
    assert.doesNotMatch(reply, /רואים/)
    assert.doesNotMatch(reply, /שטיח.*(?:שם|כרגע)/)
    assert.doesNotMatch(reply, /מדבר אליכם/)
    assert.doesNotMatch(reply, /בהיר|אפור-בז/)
  })

  it("pre-turn handles photo deterministically", () => {
    const result = runStructuredSalesPhotoPreTurn({
      turn: photoTurn,
      history: historyBeforePhoto,
      lastAgent: "faq",
    })
    assert.equal(result.kind, "handled")
    if (result.kind !== "handled") return
    assert.doesNotMatch(result.reply, /רואים/)
  })

  it("asks for one clear photo in the intake question", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "שטיח לסלון" },
      {
        role: "assistant",
        content: "*הום בוט :)*\nמה מידת הספה או הגודל הכללי של הסלון?",
      },
      { role: "user", content: "2 על 3" },
      {
        role: "assistant",
        content: "*הום בוט :)*\nהאם אמור להתאים לבעלי חיים?",
      },
      { role: "user", content: "לא" },
    ]
    const next = buildSalesIntakeReply(history, "")
    assert.match(next, /תמונה אחת ברורה/)
  })

  it("does not double-ack or re-ask photo after sales intake photo (531032031)", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "היי רציתי לדעת האם אפשר להזמין מידה ספציפית ?" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nלגבי מידה מותאמת אישית — יש שטיחים שמגיעים במידות סטנדרטיות מהקטלוג.\n\nבינתיים, כדי שנוכל לכוון נכון — לאיזה חלל השטיח מיועד?",
      },
      { role: "user", content: "סלון" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nמעולה, סלון\n\nכדי לעזור ליועץ העיצוב להתאים את ההצעה, אפשר לשלוח בערך את מידות הסלון או את גודל הספה?",
      },
      { role: "user", content: "אני צריך מידה 160/210" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nמידה 160/210 — רשמתי.\n\nהאם השטיח אמור להתאים גם לבעלי חיים בבית?",
      },
      { role: "user", content: "לא" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאין בעיה\n\nאפשר לשלוח תמונה אחת ברורה של הסלון? זה עוזר ליועץ העיצוב לדייק בהמלצה.",
      },
    ]
    const photoUrl =
      "https://storage.googleapis.com/media.landbot.io/256062/customers/531032031/R4NHE9JSV9MBFNYR229ZQ0E6K4ETSVCP.jpg"
    const photoTurn = {
      text: `[תמונה][media:image:${photoUrl}]`,
      media: [{ kind: "image" as const, url: photoUrl }],
    }
    const reply = buildSalesPhotoReceivedReply(
      history,
      photoTurn.text,
      photoTurn
    )
    assert.match(reply, /קיבלתי את התמונ/)
    assert.match(reply, /דרישות מיוחדות/)
    assert.doesNotMatch(reply, /אוקיי, קיבלתי/)
    assert.doesNotMatch(reply, /בשמחה — אפשר לשלוח תמונה/)
    assert.doesNotMatch(reply, /אפשר לשלוח תמונה אחת ברורה/)
  })

  it("notes one photo is enough when customer sends multiple images", () => {
    const history: HistoryMessage[] = [
      ...historyBeforePhoto,
      {
        role: "user",
        content: `[תמונה][media:image:${PHOTO_URL}]`,
      },
      {
        role: "assistant",
        content: "*הום בוט :)*\nתודה, קיבלתי את התמונה — אעביר ליועץ העיצוב.\n\nהאם השטיח אמור להתאים לבעלי חיים?",
      },
    ]
    const secondPhotoTurn = {
      text: "",
      media: [
        {
          kind: "image" as const,
          url: "https://storage.googleapis.com/media.landbot.io/256062/customers/531457144/NYHRV02N98DOF6HUH5HZOVSEPJWPJZIF.jpg",
        },
      ],
    }
    const reply = buildSalesPhotoReceivedReply(
      history,
      `[תמונה][media:image:${secondPhotoTurn.media[0].url}]`,
      secondPhotoTurn
    )
    assert.match(reply, /תמונה אחת ברורה מספיקה/)
    assert.doesNotMatch(reply, /רואים/)
  })
})
