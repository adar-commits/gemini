import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { customerUsesFeminineSelfReference } from "@/lib/agents/bot-voice"
import { sanitizeBotVoiceGender } from "@/lib/agents/greeting"

describe("bot voice gender", () => {
  it("detects feminine customer self-reference", () => {
    assert.equal(
      customerUsesFeminineSelfReference(
        "סלון, בגודל 240*340 והייתי רוצה להתמקד בדגמים. נורא קשר לי לבחור בינהם — אני מתלבטת"
      ),
      true
    )
    assert.equal(customerUsesFeminineSelfReference("אני מחפש שטיח לסלון"), false)
  })

  it("fixes empathy mirroring drift without touching order status", () => {
    assert.equal(
      sanitizeBotVoiceGender("מבינה את ההתלבטות — כשיש כמה דגמים"),
      "מבין את ההתלבטות — כשיש כמה דגמים"
    )
    assert.equal(
      sanitizeBotVoiceGender("ההזמנה מוכנה למשלוח"),
      "ההזמנה מוכנה למשלוח"
    )
  })
})
