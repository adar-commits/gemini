import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  selectFaqKb,
  selectFaqKbFull,
  shouldIncludeCarpetFaqKb,
  shouldIncludeCarpetTerminologyKb,
  shouldIncludePozitiveKb,
} from "@/lib/agents/kb"

describe("selectFaqKb", () => {
  it("includes exchange fee table when customer asks about החלפה", () => {
    const kb = selectFaqKb("מה מדיניות החלפה לשטיח?")
    assert.match(kb, /160\*230: 85 ILS/)
    assert.match(kb, /300\*400: 300 ILS/)
  })

  it("includes refund/exchange section in default slice when user text is empty", () => {
    const kb = selectFaqKb("")
    assert.match(kb, /Home pickup\/delivery fees/)
    assert.match(kb, /300\*400: 300 ILS/)
  })

  it("includes Pozitive product FAQ when customer asks about פוף", () => {
    assert.equal(shouldIncludePozitiveKb("איך מרכיבים פוף מילו?"), true)
    const kb = selectFaqKb("איך מרכיבים פוף מילo?")
    assert.match(kb, /pozitive-products|Pozitive \(פופים/)
    assert.match(kb, /pozitive-tutorial-videos/)
    assert.match(kb, /פתיתי ספוג/)
  })

  it("includes Pozitive KB in full export", () => {
    const kb = selectFaqKbFull()
    assert.match(kb, /pozitiveshop\.co\.il\/pages\/faq/)
    assert.match(kb, /MILO/)
  })

  it("includes carpet product FAQ when customer asks about rug care", () => {
    assert.equal(shouldIncludeCarpetFaqKb("איך פותחים את אריזת השטיח?"), true)
    const kb = selectFaqKb("השטיח משיר שיער מה עושים?")
    assert.match(kb, /carpet \/ rug product FAQ/)
    assert.match(kb, /נשיר|פלומ/)
  })

  it("includes carpet terminology when customer uses style terms", () => {
    assert.equal(shouldIncludeCarpetTerminologyKb("מה זה שטיח שאגי?"), true)
    const kb = selectFaqKb("מה ההבדל בין קילים לפרסי?")
    assert.match(kb, /מילון מונחים/)
    assert.match(kb, /שאגי|קילים/)
  })
})
