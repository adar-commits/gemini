/**
 * FAQ / policy topic detection — aligned with lib/agents/kb/faq.md sections.
 * Used before sales intake so mid-flow policy questions get KB-grounded answers.
 */

import { normalizePhoneForOrderApi } from "@/lib/agents/phone-for-api"
import {
  isActiveReturnExchangePickupCase,
  isExchangeOnlyIntent,
  isExchangePolicyQuestion,
  isCreditCodeOnlineRedemptionRequest,
  isCreditRedemptionQuestion,
  isRefundTimelineQuestion,
  isReturnPolicyQuestion,
  mentionsExchangeIntent,
  mentionsReturnIntent,
} from "@/lib/agents/inquiry-intent"

export type PolicySubjectId =
  | "contact_hours"
  | "branches"
  | "about"
  | "payments"
  | "shipping_policy"
  | "returns_exchanges"
  | "product_care"
  | "online_consulting"
  | "accessibility"
  | "privacy"
  | "promotions"
  | "catalog_scope"
  | "terms"
  | "carpet_rental"

type PolicySubject = {
  id: PolicySubjectId
  kbSection: string
  patterns: RegExp[]
}

/** Returns portal is for cancellations/refunds only — never for product exchanges (החלפות). */
export const RETURNS_PORTAL_BASE_URL = "https://returns.carpetshop.co.il/"
export const RETURNS_PORTAL_URL = RETURNS_PORTAL_BASE_URL

export function buildReturnsPortalUrl(phone?: string | null) {
  if (!phone?.trim()) return RETURNS_PORTAL_BASE_URL
  const digits = normalizePhoneForOrderApi(phone.trim())
  if (!/^0\d{9}$/.test(digits)) return RETURNS_PORTAL_BASE_URL
  return `${RETURNS_PORTAL_BASE_URL}?phone=${encodeURIComponent(digits)}`
}

/** Upgrade bare portal links when WhatsApp channel phone is known. */
export function personalizeReturnsPortalUrls(text: string, phone?: string | null) {
  if (!phone?.trim()) return text
  const personalized = buildReturnsPortalUrl(phone)
  if (personalized === RETURNS_PORTAL_BASE_URL) return text
  return text.replace(
    /https?:\/\/returns\.carpetshop\.co\.il\/?(?:\?phone=[^\s\n]+)?/gi,
    personalized
  )
}

export const EXCHANGE_COURIER_FEES = `דמי שליח לאיסוף ומשלוח (לכיוון) לפי מידת השטיח:
• שטיח עד 160×230 — 85 ₪
• שטיח 200×290 — 100 ₪
• שטיח 240×340 — 150 ₪
• שטיח 300×400 — 300 ₪`

/** Main subjects per KB policy — expand patterns when customers report misses. */
export const POLICY_SUBJECTS: PolicySubject[] = [
  {
    id: "contact_hours",
    kbSection: "Contact, Store hours",
    patterns: [
      /\*3076|service@hom-group|שעות\s+(?:פעילות|פתיחה)|מתי\s+פתוח|איך\s+ליצור\s+קשר|מייל\s+שירות|צ(?:'|׳|')אט\s+עיצוב/i,
    ],
  },
  {
    id: "branches",
    kbSection: "Branches",
    patterns: [
      /(?:איזה|מה\s+ה|רשימ(?:ת|ה)\s+)?(?:ה)?סניפ|סניפים\s+יש|לסניף|כתובות?\s+(?:ה)?סניפ|איפה\s+(?:יש\s+)?(?:חנות|סניף)/i,
    ],
  },
  {
    id: "about",
    kbSection: "About",
    patterns: [/עלינו|מי\s+אתם|החברה|hom\s*group|השטיח\s+האדום|pozitive|elite\s*rugs?/i],
  },
  {
    id: "payments",
    kbSection: "Payments",
    patterns: [
      /אמצעי\s+תשלום|תשלומים|כמה\s+תשלומים|ל(?:שלם|פרוע)\s+ב(?:ביט|bit)|buyme|buy\s*me|חבר|פיס|אשראי|apple\s*pay|google\s*pay|צ(?:'|׳|')ק/i,
    ],
  },
  {
    id: "shipping_policy",
    kbSection: "Shipping policy",
    patterns: [
      /משלוח\s+חינם|עלות\s+(?:ה)?משלוח|כמה\s+(?:עולה|עלות)\s+(?:ה)?משלוח|זמ(?:ן|ני)\s+(?:אספקה|משלוח)|כמה\s+(?:ימים|זמן)\s+(?:לוקח|נמשך)\s+(?:ה)?משלוח|איסוף\s+עצמי|self[\s-]?pickup|הובלה\s+ע(?:ד|ד\s+ל)|קומ(?:ה|ות)\s+ר(?:אשונ)?/i,
    ],
  },
  {
    id: "returns_exchanges",
    kbSection: "Refund / exchange / cancellation",
    patterns: [
      /(?:איך\s+מ(?:חזיר|בטל)|מדיניות|פורטל\s+החזר)/i,
      /(?:^|\s)(?:החזר(?:ה|ות)?|להחזיר|החלפ(?:ה|ות)?|ביטול|זיכוי)(?:\s|$|[?.!,])/i,
      /(?:^|[\s,])ו?זיכוי/i,
      /(?:^|\s)אם\s+(?:א)?תחרט/i,
      /לא\s+מתאים|לא\s+מרוצ(?:ה)?|לא\s+אהב(?:תי)?/i,
      /(?:ואם|what\s+if).*(?:החזיר|החלפ|ביטול|תחרט|אחר(?:י)?)/i,
      /(?:החזיר|להחזיר).*(?:תחרט|בטעות)/i,
      /returns\.carpetshop/i,
    ],
  },
  {
    id: "product_care",
    kbSection: "FAQ page extra facts",
    patterns: [
      /הדמ(?:י|יה)|ויזואל|visualization|roomvo|איך\s+(?:פותחים|פורקים)\s+(?:את\s+)?(?:ה)?אריז|איך\s+מ(?:ניחים|פרסים)\s+(?:את\s+)?(?:ה)?שטיח|ניקוי|שטיפ(?:ה|ת)|כביס(?:ה|ת)|ייבוש|נשיר(?:ה|ת)|מג\b|אחס(?:ון|ן)|שטיח\s+תחתון|anti[\s-]?slip|underlay/i,
    ],
  },
  {
    id: "online_consulting",
    kbSection: "Online consulting terms",
    patterns: [
      /תקנון\s+ייעוץ|ייעוץ\s+אונליין|ייעוץ\s+ב(?:אתר|וואטס|whatsapp)|שירות\s+ייעוץ\s+(?:אונליין|מקוון)/i,
    ],
  },
  {
    id: "accessibility",
    kbSection: "Accessibility",
    patterns: [/נגיש(?:ות|)?|accessibility|nvda|קורא\s+מסך/i],
  },
  {
    id: "privacy",
    kbSection: "Privacy",
    patterns: [/פרטיות|privacy|מחיק(?:ה|ת)\s+נתונים|נתונים\s+אישיים/i,
    ],
  },
  {
    id: "promotions",
    kbSection: "Dated promotions",
    patterns: [/מבצע|הנח(?:ה|ות)|50\s*%|1\s*\+\s*1|קופון|campaign|בזק/i],
  },
  {
    id: "catalog_scope",
    kbSection: "Catalog scope",
    patterns: [
      /מוכרים\s+(?:גם\s+)?(?:ספ(?:ה|ות)|וילונות|ריהוט(?! על)|מזרנים)|do\s+you\s+sell/i,
    ],
  },
  {
    id: "terms",
    kbSection: "Terms of service",
    patterns: [/תקנון|terms\s+of\s+(?:service|use)|תנאי\s+שימוש/i],
  },
  {
    id: "carpet_rental",
    kbSection: "Carpet rental / try-before-buy",
    patterns: [
      /שכיר(?:ות|ת)|השכר(?:ה|ת)|לשכ(?:ור|יר)|rent(?:al)?|lease|להשאיל(?:\s+א(?:ת|ת))?\s+שטיח|שאיל(?:ת|ה)\s+שטיח|השאל(?:ת|ה)?\s+שטיח|ל(?:נסות|try)\s+(?:לפני|before)\s+(?:קנ|buy)|לנסות\s+(?:את\s+)?(?:ה)?שטיח|נסיון\s+(?:לפני|בבית)|try[\s-]?before|בין\s+(?:שני|כמה|מספר\s+)?(?:עיצובים|דגמים|שטיחים)|מתלבט(?:ים|)?\s+בין/i,
    ],
  },
]

export function matchPolicySubjects(text: string): PolicySubjectId[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const matched: PolicySubjectId[] = []
  const activePickupCase = isActiveReturnExchangePickupCase(trimmed)
  for (const subject of POLICY_SUBJECTS) {
    if (activePickupCase && subject.id === "returns_exchanges") continue
    if (subject.patterns.some((pattern) => pattern.test(trimmed))) {
      matched.push(subject.id)
    }
  }
  return matched
}

export function isFaqPolicyQuestion(body: string) {
  return matchPolicySubjects(body).length > 0
}

export function buildExchangePolicyBody() {
  return `ניתן להחליף מוצר שהתקבל באחת משתי האפשרויות:
1. החלפה בסניפי הרשת
2. איסוף מהבית ומשלוח של המוצר החדש — בתשלום (שליח)

${EXCHANGE_COURIER_FEES}

ניתן לבצע החלפה בתוך 14 יום מקבלת המוצר, כשהמוצר לא היה בשימוש, שלם וארוז באריזתו המקורית.
החלפה מתבצעת בסניפי הרשת או דרך נציג שירות — לא דרך פורטל ההחזרות (הפורטל מיועד להחזרות וביטולים בלבד).`
}

export function buildReturnPolicyBody(phone?: string | null) {
  const portalUrl = buildReturnsPortalUrl(phone)
  return `ניתן להחזיר מוצר שהתקבל (ביטול/זיכוי) באחת משתי האפשרויות:
1. החזרה לסניפי הרשת
2. איסוף מהבית באמצעות שליח — בתשלום (לפי גודל השטיח)

בכל החזרה, גם כאשר מחזירים את המוצר בסניף, יש לפתוח בקשת החזרה דרך פורטל ההחזרות:
${portalUrl}
ניתן לבצע החזרה בתוך 14 ימים מקבלת המוצר, כשהמוצר לא היה בשימוש, שלם וארוז באריזתו המקורית ובהתאם לתנאי ההחזרה.`
}

export function buildCombinedReturnExchangePolicyBody(phone?: string | null) {
  return `${buildExchangePolicyBody()}

לחלופין, אם מעדיפים החזרה וזיכוי (לא החלפה):
${buildReturnPolicyBody(phone)}`
}

export function buildExchangePolicyReply() {
  return `${buildExchangePolicyBody()}

אם רוצים להמשיך עם החלפה דרך שליח — אעביר לנציג שירות. אם מעדיפים להגיע לסניפי הרשת, אשמח לשלוח את רשימת הסניפים. במה להמשיך?`
}

export function buildReturnCancellationPolicyReply(phone?: string | null) {
  return `${buildReturnPolicyBody(phone)}

אפשר לעזור במשהו נוסף?`
}

/** Policy FAQ about returns/exchanges — not active pickup or execution requests. */
export function isReturnExchangePolicyFaqQuestion(body: string) {
  const text = body.trim()
  if (!text) return false
  if (isActiveReturnExchangePickupCase(text)) return false
  if (isRefundTimelineQuestion(text)) return true
  if (isExchangePolicyQuestion(text)) return true
  if (isReturnPolicyQuestion(text)) return true
  return matchPolicySubjects(text).includes("returns_exchanges")
}

/** Pick the right deterministic policy text — portal only for returns/cancellations. */
export function resolveReturnExchangePolicyReply(body: string, phone?: string | null) {
  if (isRefundTimelineQuestion(body)) return buildRefundTimelinePolicyReply(phone)
  if (mentionsReturnIntent(body) && mentionsExchangeIntent(body)) {
    return `${buildCombinedReturnExchangePolicyBody(phone)}

אפשר לעזור במשהו נוסף?`
  }
  if (isExchangePolicyQuestion(body) || isExchangeOnlyIntent(body)) {
    return buildExchangePolicyReply()
  }
  if (mentionsReturnIntent(body)) {
    return buildReturnCancellationPolicyReply(phone)
  }
  return `${buildCombinedReturnExchangePolicyBody(phone)}

אפשר לעזור במשהו נוסף?`
}

/** @deprecated Use resolveReturnExchangePolicyReply(body) */
export function buildReturnExchangePolicyReply(body = "") {
  return resolveReturnExchangePolicyReply(body)
}

export function buildRefundTimelinePolicyReply(phone?: string | null) {
  const portalUrl = buildReturnsPortalUrl(phone)
  return `הזיכוי מתבצע בהקדם האפשרי ולא יאוחר מ-7 ימי עסקים ממועד ביטול העסקה, בכפוף לאישור שהמוצר לא היה בשימוש (בדיקת המעבדה).

גם בהחזרה בסניף יש לפתוח בקשת החזרה בפורטל:
${portalUrl}

אם כבר מסרתם את המוצר ופתחתם בקשה — בדרך כלל הזיכוי מופיע עד 7 ימי עסקים ממועד ביטול העסקה. לבדיקת סטטוס ספציפי אפשר לפנות לשירות בטלפון *3076.

אם צריך עוד משהו — אני כאן.`
}

export function buildRefundStatusHandoffReply() {
  return `קיבלנו. אם השטיח כבר נאסף — ההחזר הכספי מתבצע עד 7 ימי עסקים ממועד ביטול העסקה.
כדי לבדוק את הסטטוס המדויק של ההחזר, אפשר להעביר לצוות השירות שיוכלו לתת מענה מדויק. להעביר לנציג שירות?`
}

export function buildCreditRedemptionPolicyReply(phone?: string | null) {
  const portalUrl = buildReturnsPortalUrl(phone)
  return `אשמח לעזור! כדי שאוכל לכוון נכון — על איזה זיכוי מדובר?

1. זיכוי כספי (החזר לכרטיס אשראי) — אם כבר אושר ההחזר, הוא מתבצע עד 7 ימי עסקים ממועד ביטול העסקה.

2. קוד זיכוי — אם קיבלתם קוד זיכוי, ניתן לממש בסניפי הרשת או באתר. למימוש באתר אעביר את השיחה לנציג שירות.

אם מדובר בפתיחת בקשת החזרה/ביטול חדשה, אפשר לעשות זאת דרך פורטל ההחזרות:
${portalUrl}
מה מתאים למצב שלכם?`
}

export function buildCreditCodeOnlineHandoffReply() {
  return `מובן — למימוש קוד זיכוי באתר אעביר את השיחה לנציג שירות שיסייע בהמשך.`
}

/** Fix LLM drift — credit code is not self-service online; never say שובר. */
export function sanitizeCreditRedemptionWording(reply: string) {
  let text = reply
  text = text.replace(/קוד\s+זיכוי\s*[/\\|]\s*שובר/gi, "קוד זיכוי")
  text = text.replace(/(?:\/|\s+או\s+)שובר(?=[\s,.)\]|$])/gi, "")
  text = text.replace(
    /(?:אפשר\s+)?(?:להזין|לממש)[^\n]*(?:עמוד\s+)?(?:ה)?תשלום[^\n]*/gi,
    "אם קיבלתם קוד זיכוי, ניתן לממש בסניפי הרשת או באתר. למימוש באתר אעביר את השיחה לנציג שירות."
  )
  text = text.replace(
    /(?:ב)?שדה\s+['"]?(?:קוד\s+)?(?:קופון\s*[/\\|]\s*)?זיכוי['"]?[^\n.]*/gi,
    "למימוש באתר אעביר את השיחה לנציג שירות."
  )
  return text
}

/** Fix LLM drift on refund timeline — KB counts from cancellation, not warehouse arrival. */
export function sanitizeRefundPolicyWording(reply: string) {
  let text = reply
  text = text.replace(/תוך\s+עד\s+7\s*ימי\s*עסקים/gi, "עד 7 ימי עסקים")
  text = text.replace(/(?:מתבצע|מופיע)\s+תוך\s+(?:עד\s+)?7/gi, (match) =>
    match.replace(/תוך\s+/, "")
  )
  text = text.replace(
    /מרגע\s+ש(?:ה)?(?:מוצר\s+)?(?:מגיע|הגיע)(?:\s+חזרה)?\s+ל(?:מ)?חסן/gi,
    "ממועד ביטול העסקה"
  )
  return text
}

export function buildCantVisitBranchReturnReply(phone?: string | null) {
  const portalUrl = buildReturnsPortalUrl(phone)
  return `אני מבין שקשה להגיע לסניף.
ניתן להחזיר או להחליף גם באיסוף מהבית בתשלום — נציג שירות יתאם איתכם את האיסוף.

בכל החזרה יש לפתוח בקשה בפורטל:
${portalUrl}

לתיאום איסוף מהבית אפשר גם לפנות לשירות בטלפון *3076.`
}

export function buildWarehouseShipHandoffReply() {
  return `אני מבין שמבקשים לשלוח שטיח מהאחסון.
העברתי את הפנייה לנציג שירות שיתאם את המשלוח ויחזור אליך.`
}

export function buildCarpetRentalPolicyReply() {
  return `בנוגע להשאלת שטיח / שכירות לנסיון — זו לא שירות קבועה שמוצעת לכל לקוח.
במקרים מסוימים, למשל כשמתלבטים בין שני עיצובים, יועץ המכירות יכול לבדוק אפשרות לשכירות או ניסיון (לעיתים לפי המוצר הזול מבין השניים) — מקרה-מקרה, לפי שיקול דעת היועץ בלבד.
לפרטים מדויקים אפשר להעביר ליועץ מכירות — רוצים שאעביר?`
}

export function isCarpetRentalQuestion(body: string) {
  return matchPolicySubjects(body).includes("carpet_rental")
}
