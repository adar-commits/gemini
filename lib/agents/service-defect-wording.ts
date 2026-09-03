/** Neutral service wording — acknowledge concern without admitting defect liability. */

const DEFECT_LIABILITY_LINE_RE =
  /(?:^|\n)\s*(?:\*[^*]+\*\s*)?(?:מכיוון\s+ש[^\n]*?)?(?:מדובר\s+ב(?:פגם|ליקוי)|(?:ז(?:ה|את|ו)|ה(?:וא|יא))\s+פגם|פגם\s+(?:ש(?:הגיע|היה)|מ(?:לכתחילה|הייצור|המפעל))|(?:בוודאות|בהחלט)\s+(?:ש)?(?:מ)?(?:דובר\s+)?(?:ב)?פגם)[^\n]*/gim

const DEFECT_LIABILITY_INLINE_RE =
  /(?:מדובר\s+ב(?:פגם|ליקוי)|פגם\s+(?:ש(?:הגיע|היה)|מ(?:לכתחילה|הייצור))|(?:ז(?:ה|את|ו)|ה(?:וא|יא))\s+פגם(?:\s+ש(?:הגיע|היה))?)/gi

/** Customer-visible rep report label — report, do not confirm defect. */
export const DEFECT_ISSUE_REPORT_LABEL = "דיווח על בעיה / חשש לגבי המוצר (לפי הלקוח)"

export function sanitizeServiceDefectLiabilityReply(text: string) {
  let reply = text.replace(DEFECT_LIABILITY_LINE_RE, "\n")
  reply = reply.replace(DEFECT_LIABILITY_INLINE_RE, "נבדוק את הנושא")
  return reply.replace(/\n{3,}/g, "\n\n").trim()
}
