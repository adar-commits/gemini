import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { HistoryMessage } from "@/lib/agents/types"
import {
  authorizedLookupPhoneFromHistory,
  buildPhoneLookupConfirmPrompt,
  formatDisplayPhone,
  isChannelPhoneSelfReference,
  isOrderNumberRequestPending,
  isPhoneLookupConfirmPending,
  resolveLookupPhoneFromHistory,
  userProvidedPhone,
} from "@/lib/agents/order-lookup"
import { validatePriorityApiPayload } from "@/lib/agents/phone-for-api"

describe("authorizedLookupPhoneFromHistory", () => {
  it("returns null until customer confirms channel phone", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: buildPhoneLookupConfirmPrompt("+972547495083"),
        agent: "master",
      },
    ]
    assert.equal(authorizedLookupPhoneFromHistory(history, "+972547495083"), null)
  })

  it("returns channel phone after customer confirms", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: buildPhoneLookupConfirmPrompt("+972547495083"),
        agent: "master",
      },
      { role: "user", content: "כן", agent: null },
    ]
    assert.equal(
      authorizedLookupPhoneFromHistory(history, "+972547495083"),
      "0547495083"
    )
  })

  it("authorizes alternate phone typed after declining channel confirm", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: buildPhoneLookupConfirmPrompt("+972547380553"),
        agent: "master",
      },
      { role: "user", content: "לא", agent: null },
      { role: "user", content: "0547380553", agent: null },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nאוקיי נדמה לי שמצאתי את ההזמנה, בוצעה לפני 3 ימים באתר אינטרנט על סך 174.9 ש׳׳ח, נכון? (מס׳ הזמנה SO26020975)",
        agent: "master",
      },
    ]
    assert.equal(
      authorizedLookupPhoneFromHistory(history, "+972523925554"),
      "0547380553"
    )
    assert.equal(
      resolveLookupPhoneFromHistory(history, "+972523925554", "כן בדיוק"),
      "0547380553"
    )
  })

  it("returns typed phone after alternate-phone prompt", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "מה מספר הטלפון שבוצעה עליו ההזמנה?",
        agent: "master",
      },
      { role: "user", content: "050-6703444", agent: null },
    ]
    assert.equal(
      authorizedLookupPhoneFromHistory(history, "+972547495083"),
      "0506703444"
    )
  })

  it("does not scrape random phones from unrelated history", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "היי, התקשרתי למספר 050-1111111", agent: null },
      { role: "assistant", content: "במה אוכל לעזור?", agent: "faq" },
    ]
    assert.equal(resolveLookupPhoneFromHistory(history, "+972547495083"), null)
  })

  it("prefers phone typed in the current message", () => {
    assert.equal(userProvidedPhone("הטלפון שלי 052-3925554"), "0523925554")
    assert.equal(
      resolveLookupPhoneFromHistory([], "+972547495083", "052-3925554"),
      "0523925554"
    )
  })

  it("formats display phone as 05X-XXXXXXX", () => {
    assert.equal(formatDisplayPhone("+972523925554"), "(052-3925554)")
    assert.equal(formatDisplayPhone("0523925554"), "(052-3925554)")
    assert.equal(formatDisplayPhone("+972547495083"), "(054-7495083)")
  })

  it("resolves channel phone from current-turn soft yes before history append", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: buildPhoneLookupConfirmPrompt("+972547495083"),
        agent: "master",
      },
    ]
    assert.equal(
      resolveLookupPhoneFromHistory(history, "+972547495083", "כן נראה לי"),
      "0547495083"
    )
    assert.equal(
      authorizedLookupPhoneFromHistory(history, "+972547495083"),
      null
    )
  })

  it("binds המספר שלי to channel phone after order/phone ask — no re-confirm", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nמה מספר ההזמנה או מספר הטלפון שאיתו בוצעה ההזמנה?",
        agent: "faq",
      },
    ]
    assert.equal(isOrderNumberRequestPending(history), true)
    assert.equal(isChannelPhoneSelfReference("המספר שלי"), true)
    assert.equal(
      resolveLookupPhoneFromHistory(history, "+972547495083", "המספר שלי"),
      "0547495083"
    )
    assert.equal(isChannelPhoneSelfReference("050-6703444"), false)
  })

  it("binds זה המספר טלפון שלי after phone confirm ask — no second confirm", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nמה מספר ההזמנה או הטלפון שמשויך להזמנה?",
        agent: "faq",
      },
    ]
    const phrase = "זה המספר טלפון שלי"
    assert.equal(isChannelPhoneSelfReference(phrase), true)
    assert.equal(
      resolveLookupPhoneFromHistory(history, "+972547495083", phrase),
      "0547495083"
    )

    const confirmHistory: HistoryMessage[] = [
      ...history,
      { role: "user", content: phrase, agent: null },
      {
        role: "assistant",
        content:
          "*הום בוט :)*\nהאם היא רשומה על המספר ממנו אני מתכתב כרגע? (054-7495083)",
        agent: "faq",
      },
    ]
    assert.equal(isPhoneLookupConfirmPending(confirmHistory), true)
    assert.equal(
      resolveLookupPhoneFromHistory(confirmHistory, "+972547495083", "זה הטלפון שלי"),
      "0547495083"
    )
  })
})

describe("validatePriorityApiPayload", () => {
  it("accepts valid mobile phones for getOrders/getDocument", () => {
    assert.equal(
      validatePriorityApiPayload({ actionType: "getOrders", value: "0547495083" }).ok,
      true
    )
  })

  it("blocks order numbers and garbage phones", () => {
    assert.equal(
      validatePriorityApiPayload({ actionType: "getOrders", value: "12345678" }).ok,
      false
    )
    assert.equal(
      validatePriorityApiPayload({ actionType: "getDocument", value: "99999" }).ok,
      false
    )
  })

  it("accepts hyphenated SKUs only for getInventoryBranch", () => {
    assert.equal(
      validatePriorityApiPayload({
        actionType: "getInventoryBranch",
        value: "31501090-200290",
      }).ok,
      true
    )
    assert.equal(
      validatePriorityApiPayload({
        actionType: "getInventoryBranch",
        value: "topaz-cream-green",
      }).ok,
      false
    )
    assert.equal(
      validatePriorityApiPayload({
        actionType: "getInventoryBranch",
        value: "0547495083",
      }).ok,
      false
    )
  })

  it("accepts getCampaigns with all or campaign hint", () => {
    assert.equal(
      validatePriorityApiPayload({ actionType: "getCampaigns", value: "all" }).ok,
      true
    )
    assert.equal(
      validatePriorityApiPayload({ actionType: "getCampaigns", value: "השטיח האדום" }).ok,
      true
    )
    assert.equal(
      validatePriorityApiPayload({ actionType: "getCampaigns", value: "" }).ok,
      true
    )
  })
})
