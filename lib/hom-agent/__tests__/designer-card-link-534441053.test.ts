import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const prompt = readFileSync(join(process.cwd(), "lib/hom-agent/prompts/hom-bot.md"), "utf8")
const faq = readFileSync(join(process.cwd(), "lib/agents/kb/faq.md"), "utf8")

const FIRST_ASK =
  "היי ישראל :) זה נדב מהמשרד אדריכלות של נעם לוי אשמח ללינקים המתאימים בכדי שנעם תפתח אצלכם כרטיס תודה רבה נדב"

const REPEAT_ASK =
  "היי ישראל\nאפשר בבקשה לינק לפתיחת כרטיס מעצבים?\nאעביר לנעם האדריכלית שתפתח אחד"

const BAD_REPLY =
  "*הום בוט :)*\nהיי נדב, מצטער שעדיין לא חזרו אליך\n\nאין לי כאן לינק לפתיחת כרטיס מעצבים. את התהליך מנהל יועץ מכירות, והוא ישלח לך את הלינק בשביל נעם."

/** 534441053 — architect office asks for designer card link; bot must not deny link exists. */
describe("designer card opening link (534441053)", () => {
  it("prompt teaches designers page on card link ask", () => {
    const line = prompt.split("\n").find((l) => l.includes("534441053"))
    assert.ok(line)
    assert.match(line!, /pages\/designers/)
    assert.match(line!, /אין לי כאן לינק לפתיחת כרטיס מעצבים/)
    assert.match(line!, /action: reply/)
  })

  it("prompt binds repeat chase to human_sales without denying link", () => {
    const line = prompt.split("\n").find((l) => l.includes("534441053"))
    assert.ok(line)
    assert.match(line!, /human_sales/)
    assert.match(line!, /do not.*deny|still \*\*do not\*\* deny/i)
  })

  it("KB lists designers entry URL", () => {
    assert.match(faq, /pages\/designers/)
  })

  it("documents production no-link reply on repeat chase", () => {
    assert.match(BAD_REPLY, /אין לי כאן לינק לפתיחת כרטיס מעצבים/)
    assert.match(REPEAT_ASK, /לינק לפתיחת כרטיס מעצבים/)
    assert.match(FIRST_ASK, /נעם/)
  })
})
