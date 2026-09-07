import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { executeFetchDigitalDocument } from "@/lib/hom-agent/tools/document"

describe("fetch_digital_document misuse guard", () => {
  it("rejects tool call when there is no document intent/context", async () => {
    const result = await executeFetchDigitalDocument({
      body: "היי אשמח לקבל מענה",
      history: [],
      phone: "+972547495083",
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal((result as { errorCode?: string }).errorCode, "document_misroute")
  })

  it("still allows a real receipt request", async () => {
    const result = await executeFetchDigitalDocument({
      body: "אפשר לשלוח קבלה בבקשה?",
      history: [],
      phone: "+972547495083",
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.match(result.reply, /\*הום בוט/)
  })
})
