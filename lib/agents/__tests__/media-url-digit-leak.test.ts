import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { stripMediaAndUrls } from "@/lib/agents/phone-for-api"
import {
  extractOrderReference,
  extractPhoneFromText,
  userProvidedPhone,
} from "@/lib/agents/order-lookup"
import { runStructuredOrderLookupPreTurn } from "@/lib/hom-agent/pre-turn"
import type { HistoryMessage } from "@/lib/agents/types"

// The exact trainer message that hijacked a sales-intake photo into order lookup:
// the Landbot customer id (529869497) inside the media URL matches the Israeli
// mobile pattern 0?5XXXXXXXX.
const ROOM_PHOTO_MESSAGE =
  "[תמונה][media:image:https://storage.googleapis.com/media.landbot.io/256062/customers/529869497/1422L51Z7F7VPF2SU41IKRJ9AMEXOCLM.jpg]"

describe("media URL digit leak", () => {
  it("strips media placeholders and URLs before digit scanning", () => {
    assert.equal(stripMediaAndUrls(ROOM_PHOTO_MESSAGE), "[תמונה]")
  })

  it("does not extract a phone or order reference from a media URL", () => {
    assert.equal(extractPhoneFromText(ROOM_PHOTO_MESSAGE), null)
    assert.equal(userProvidedPhone(ROOM_PHOTO_MESSAGE), null)
    assert.equal(extractOrderReference(ROOM_PHOTO_MESSAGE), null)
  })

  it("still extracts a real typed phone alongside media", () => {
    assert.equal(
      extractPhoneFromText(`${ROOM_PHOTO_MESSAGE}\n0501234567`),
      "0501234567"
    )
  })

  it("room photo mid sales-intake reaches the LLM, not order lookup", async () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "אני מחפש שטיח לסלון" },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nמעולה, נרשם שיהיה מתאים לבעלי חיים. אפשר לשלוח תמונה של החלל? זה יעזור ליועץ העיצוב להתאים את השטיח בול.",
      },
    ]
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: ROOM_PHOTO_MESSAGE, media: [] },
      history,
      phone: "+972547495083",
    })
    assert.equal(result.kind, "skip")
  })

  it("a bare phone with no order context is not hijacked into order lookup", async () => {
    const result = await runStructuredOrderLookupPreTurn({
      turn: { text: "תתקשרו אליי בבקשה 050-1234567", media: [] },
      history: [],
      phone: "+972547495083",
    })
    assert.equal(result.kind, "skip")
  })
})
