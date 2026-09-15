import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isRugCleaningServiceQuestion } from "@/lib/agents/policy-subjects"

describe("rug cleaning service question detection", () => {
  it("matches whether HoM cleans rugs / odor treatment", () => {
    assert.equal(
      isRugCleaningServiceQuestion(
        "מבקשת לבדוק אם אתם מנקים שטיחים שאגי כולל נטרול ריח"
      ),
      true
    )
    assert.equal(
      isRugCleaningServiceQuestion("יש לכם שירות ניקוי שטיחים?"),
      true
    )
  })

  it("does not match general care how-to or unrelated FAQ", () => {
    assert.equal(isRugCleaningServiceQuestion("איך מנקים כתם על שטיח?"), false)
    assert.equal(isRugCleaningServiceQuestion("מה זה שטיח שאגי?"), false)
    assert.equal(isRugCleaningServiceQuestion("מה מדיניות החזרה?"), false)
  })
})
