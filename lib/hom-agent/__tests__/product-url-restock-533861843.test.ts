import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { runStructuredInventoryPreTurn } from "@/lib/hom-agent/pre-turn"

/** Replay 533861843 — product URL + restock ask must prompt for SKU, not FAQ size quiz. */
const OPENING =
  "היי אשמח לפרטים נוספים לגבי שטיח אמיליה בז' EMILIA https://www.carpetshop.co.il/products/emilia-beige-rec?_pos=26&_fid=beefb2ce8&_ss=c&variant=43794862506175 הוא צפוי לחזור למלאי?"

describe("product URL restock pre-turn 533861843", () => {
  it("binds opening URL + restock to inventory SKU prompt (sales path)", async () => {
    const result = await runStructuredInventoryPreTurn({
      turn: { text: OPENING, media: [] },
      history: [],
    })
    assert.equal(result.kind, "handled")
    assert.match(result.reply ?? "", /קיבלתי את הקישור/)
    assert.match(result.reply ?? "", /מק״ט/)
    assert.doesNotMatch(result.reply ?? "", /באיזו מידה/)
    assert.doesNotMatch(result.reply ?? "", /אין לי כאן תאריך/)
  })
})
