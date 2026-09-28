import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")

/**
 * 533563716 — bot asked for a photo to identify a rug; customer sent the photo with a long caption
 * copied from the designer's site. Bot replied "קיבלתי את הטקסט ... אם עוד לא שלחת, אפשר לשלוח
 * צילום מסך" + human_sales. The image had arrived — acknowledge the photo, do not ask again.
 */
describe("photo with caption counts as received 533563716", () => {
  const line = prompt.split("\n").find((l) => l.includes("Photo with caption") && l.includes("533563716"))

  it("treats media markers as an already-received image", () => {
    assert.ok(line, "missing photo-with-caption rule")
    assert.match(line, /\[media:image:…\]/)
    assert.match(line, /\[תמונה…\]/)
    assert.match(line, /already arrived/)
  })

  it("acknowledges the photo and hands off to sales without re-asking", () => {
    assert.ok(line)
    assert.match(line, /קיבלתי את התמונה/)
    assert.match(line, /never\*\* ask for a screenshot/)
    assert.match(line, /אם עוד לא שלחת/)
    assert.match(line, /action: human_sales/)
  })
})
