/**
 * FAQ / policy topic detection — aligned with lib/agents/kb/faq.md sections.
 * Used before sales intake so mid-flow policy questions get KB-grounded answers.
 */

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

/** Main subjects per KB policy — expand patterns when customers report misses. */
export const POLICY_SUBJECTS: PolicySubject[] = [
  {
    id: "contact_hours",
    kbSection: "Contact, Store hours",
    patterns: [
      /\*3076|service@hom-group|שעות\s+(?:פעילות|פתיחה)|מתי\s+פתוח|איך\s+ליצור\s+קשר|מייל\s+שירות|צ(?:'|׳|)אט\s+עיצוב/i,
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
      /אמצעי\s+תשלום|תשלומים|כמה\s+תשלומים|ל(?:שלם|פרוע)\s+ב(?:ביט|bit)|buyme|buy\s*me|חבר|פיס|אשראי|apple\s*pay|google\s*pay|צ(?:'|׳|)ק/i,
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
    patterns: [/פרטיות|privacy|מחיק(?:ה|ת)\s+נתונים|נתונים\s+אישיים/i],
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
      /שכיר(?:ות|ת)|השכר(?:ה|ת)|לשכ(?:ור|יר)|rent(?:al)?|lease|להשאיל(?:\s+א(?:ת|ת))?\s+שטיח|שאיל(?:ת|ה)\s+שטיח|ל(?:נסות|try)\s+(?:לפני|before)\s+(?:קנ|buy)|בין\s+(?:שני|כמה|מספר\s+)?(?:עיצובים|דגמים|שטיחים)|מתלבט(?:ים|)?\s+בין/i,
    ],
  },
]

export function matchPolicySubjects(text: string): PolicySubjectId[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const matched: PolicySubjectId[] = []
  for (const subject of POLICY_SUBJECTS) {
    if (subject.patterns.some((pattern) => pattern.test(trimmed))) {
      matched.push(subject.id)
    }
  }
  return matched
}

export function isFaqPolicyQuestion(body: string) {
  return matchPolicySubjects(body).length > 0
}

export function buildReturnExchangePolicyReply() {
  return `ניתן להחליף מוצר שקיבלתם בסניפי הרשת, או להחזירו — בנקודות ההחזרה או באיסוף מהבית (בכפוף לתשלום).
פרטים מלאים: https://returns.carpetshop.co.il/
החלפה או החזרה — בתוך 14 יום מקבלת המוצר, כשהמוצר שלם וללא פגם או לכלוך.

רוצים לבצע החזרה על הזמנה שכבר קיבלתם? כתבו "החזרה" ונמשיך.`
}

export function buildCarpetRentalPolicyReply() {
  return `בנוגע לשכירות שטיח — זו לא שירות קבועה לכל לקוח.
במקרים מסוימים, למשל כשמתלבטים בין שני עיצובים, יועץ המכירות יכול לבדוק אפשרות לשכירות או ניסיון (לעיתים לפי המוצר הזול מבין השניים) — לפי שיקול דעת היועץ בלבד, מקרה-מקרה.
לפרטים מדויקים מומלץ לפנות ליועץ מכירות.`
}
