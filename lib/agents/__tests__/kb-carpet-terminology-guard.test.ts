import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldIncludeCarpetTerminologyKb } from "@/lib/agents/kb"

describe("carpet terminology KB guard (plan F)", () => {
  it("includes glossary when rug context is explicit", () => {
    assert.equal(shouldIncludeCarpetTerminologyKb("מה זה שטיח שאגי?"), true)
    assert.equal(shouldIncludeCarpetTerminologyKb("מה ההבדל בין קילים לפרסי?"), true)
  })

  it("does not attach glossary on isolated material/style words", () => {
    assert.equal(shouldIncludeCarpetTerminologyKb("classic"), false)
    assert.equal(shouldIncludeCarpetTerminologyKb("wool"), false)
    assert.equal(shouldIncludeCarpetTerminologyKb("kids room"), false)
  })
})
