/** Customer first-person feminine — bot must not mirror onto itself. */
const CUSTOMER_FEMININE_SELF_RE =
  /(?:מתלבט(?:ת|ות)|מחפש(?:ת|ות)|אני\s+שמח(?:ה|ות)|אני\s+יכול(?:ה|ות)|אני\s+צריכ(?:ה|ות)|אני\s+מוד(?:אג(?:ת|ות)|ה)|אני\s+בטוח(?:ה|ות))/u

export function customerUsesFeminineSelfReference(text: string) {
  const body = text.trim()
  if (!body) return false
  return CUSTOMER_FEMININE_SELF_RE.test(body)
}

export const BOT_VOICE_NO_MIRROR_HINT =
  "BOT VOICE — DO NOT MIRROR CUSTOMER GENDER: the customer used feminine Hebrew for themselves (e.g. מתלבטת). הום בוט stays masculine or impersonal — never מבינה/מכוונה/שמחה about yourself. Prefer impersonal empathy: \"ברור שקשה לבחור\", \"יש בזה התלבטות\", \"קשה לבחור בין כמה דגמים\" — not \"מבינה את ההתלבטות\"."
