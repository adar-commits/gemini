import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildGreetingReply,
  buildOpeningGreetingEcho,
  dedupeGreetingBotName,
  ensureSingleCustomerHeader,
  formatOutboundMessages,
  prependOpeningGreetingReply,
  sanitizeBotGenderSlashes,
  sanitizeBotEmojis,
  sanitizeBotVoiceGender,
  sanitizeCustomerAddress,
} from "@/lib/agents/greeting"
import { CUSTOMER_HEADER } from "@/lib/agents/types"

describe("greeting reply", () => {
  it("uses masculine voice and a single bot name", () => {
    const reply = buildGreetingReply()
    assert.match(reply, /^(\*הום בוט :\)\*\n)/)
    assert.match(reply, /שמח שפנית/)
    assert.doesNotMatch(reply, /😀/)
    assert.doesNotMatch(reply, /שמח\/ה/)
    assert.doesNotMatch(reply, /כאן הום בוט/)
  })

  it("sanitizes slash gender forms from LLM output", () => {
    assert.equal(
      sanitizeBotGenderSlashes("שמח/ה שפנית — מצטער/ת לשמוע"),
      "שמח שפנית — מצטער לשמוע"
    )
  })

  it("keeps masculine bot voice and replaces awkward closings", () => {
    assert.equal(sanitizeBotVoiceGender("אני שמחה לעזור"), "אני שמח לעזור")
    assert.match(sanitizeBotVoiceGender("יום טוב! שיהיה בשורות טובות"), /יום נפלא/)
    assert.doesNotMatch(sanitizeBotVoiceGender("יום טוב! שיהיה בשורות טובות"), /בשורות/)
  })

  it("strips decorative emoji from operational messages", () => {
    const raw =
      "קודם אמצא את ההזמנה שלכם בזריזות 🔍 האם היא רשומה על המספר ממנו אני מתכתב?"
    const cleaned = sanitizeBotEmojis(raw)
    assert.doesNotMatch(cleaned, /🔍/)
    assert.match(cleaned, /הזמנה/)
  })

  it("keeps WhatsApp-friendly emojis on greeting replies", () => {
    const cleaned = sanitizeBotEmojis("היי שלום! 😊 במה אוכל לעזור?")
    assert.match(cleaned, /😊/)
    assert.match(cleaned, /היי שלום/)
  })

  it("strips decorative emoji but keeps allowed ones on friendly replies", () => {
    const cleaned = sanitizeBotEmojis("בשמחה ☺️ וגם 😀")
    assert.match(cleaned, /☺/)
    assert.doesNotMatch(cleaned, /😀/)
  })

  it("keeps emojis on campaign informational replies", () => {
    const raw = `${CUSTOMER_HEADER}
בדקתי בשבילכם 😊

אכן היה מבצע 1+1 על הפופים, אך לצערי הוא כבר אינו בתוקף — נגמר לפני 3 ימים.

אם צריך — אפשר להעביר ליועץ מכירות לפרטים נוספים 🙏`
    const cleaned = sanitizeBotEmojis(raw)
    assert.match(cleaned, /😊/)
    assert.match(cleaned, /🙏/)
  })

  it("sanitizes SKU label to מק״ט example for customers", () => {
    const raw =
      'כדי לבדוק מלאi, אצטרך את מספר המק"ט (SKU) של המוצר. מה מעדיף?'
    const cleaned = sanitizeCustomerAddress(raw)
    assert.match(cleaned, /31503138-200290/)
    assert.doesNotMatch(cleaned, /SKU/i)
    assert.match(cleaned, /מה תעדיפו/)
  })

  it("replaces letter SKU placeholders with real מק״ט example", () => {
    const raw =
      'אני צריך את המק"ט (המספר עם המקף, למשל ABC-12345). השם לבד לא מספיק.'
    const cleaned = sanitizeCustomerAddress(raw)
    assert.match(cleaned, /31503138-200290/)
    assert.doesNotMatch(cleaned, /ABC-12345/i)
  })

  it("sanitizes masculine singular customer address to plural", () => {
    const raw =
      "איך תעדיף להמשיך? אפשר לחבר אותך ליועץ — שלח/י את הפרטים אם יש לך."
    const cleaned = sanitizeCustomerAddress(raw)
    assert.match(cleaned, /איך תרצו/)
    assert.doesNotMatch(cleaned, /תעדיף/)
    assert.match(cleaned, /לחבר אתכם/)
    assert.doesNotMatch(cleaned, /אותך/)
    assert.match(cleaned, /שלחו/)
    assert.match(cleaned, /יש לכם/)
    assert.doesNotMatch(cleaned, /\/י/)
  })

  it("removes duplicate bot name after the header", () => {
    const noisy = `${CUSTOMER_HEADER}
היי! כאן הום בוט :)
שמח/ה שפנית — במה אוכל לעזור היום?`
    const cleaned = dedupeGreetingBotName(sanitizeCustomerAddress(noisy))
    assert.doesNotMatch(cleaned, /כאן הום בוט/)
    assert.match(cleaned, /שמח שפנית/)
  })
})

describe("customer header formatting", () => {
  it("merges duplicate headers inside one reply", () => {
    const noisy = `${CUSTOMER_HEADER}
היי! 👋

${CUSTOMER_HEADER}
אני מבין שמחכים לשטיח.`
    const cleaned = ensureSingleCustomerHeader(noisy)
    assert.equal((cleaned.match(/\*הום בוט :\)\*/g) ?? []).length, 1)
    assert.match(cleaned, /היי/)
    assert.match(cleaned, /מחכים לשטיח/)
  })

  it("strips header from follow-up bubbles in one burst", () => {
    const { messages, headerSent } = formatOutboundMessages(
      [
        `${CUSTOMER_HEADER}\nהיי! 👋`,
        `${CUSTOMER_HEADER}\nאני מבין שמחכים לשטיח.`,
      ],
      { headerAlreadySent: false }
    )
    assert.equal(messages.length, 2)
    assert.match(messages[0], /^\*הום בוט :\)\*/)
    assert.doesNotMatch(messages[1], /^\*הום בוט :\)\*/)
    assert.match(messages[1], /מחכים לשטיח/)
    assert.equal(headerSent, true)
  })

  it("strips header when prior bubble already sent one", () => {
    const { messages } = formatOutboundMessages([`${CUSTOMER_HEADER}\nשאלה נוספת?`], {
      headerAlreadySent: true,
    })
    assert.doesNotMatch(messages[0], /^\*הום בוט :\)\*/)
    assert.match(messages[0], /שאלה נוספת/)
  })
})

describe("opening greeting echo", () => {
  it("prepends mirrored hello on first substantive turn with hello + ask", () => {
    assert.equal(buildOpeningGreetingEcho("היי שלום אני רוצה לדעת"), "היי שלום! 😊")

    const raw = `${CUSTOMER_HEADER}
קודם אמצא את ההזמנה שלכם בזריזות, האם היא רשומה על המספר ממנו אני מתכתב כרגע? (054-7495083)
אם לא, אשמח לקבל אותו.`

    const reply = prependOpeningGreetingReply(raw, "היי שלום אני רוצה לדעת אם קיבלתי את השטיח", [
      { role: "user", content: "איפוס" },
      { role: "assistant", content: "*הום בוט :)*\nהשיחה אופסה. אפשר להתחיל מחדש." },
    ])
    assert.match(reply, /היי שלום! 😊/)
    assert.match(reply, /קודם אמצא את ההזמנה/)
  })

  it("does not prepend greeting mid-thread", () => {
    const raw = `${CUSTOMER_HEADER}\nעוד שאלה`
    const reply = prependOpeningGreetingReply(raw, "היי", [
      { role: "user", content: "שאלה קודמת" },
      { role: "assistant", content: "תשובה" },
    ])
    assert.equal(reply, raw)
  })
})
