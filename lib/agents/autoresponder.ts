/** Detect inbound WhatsApp autoresponders / away messages from other businesses. */
export function isWhatsappAutoresponder(body: string) {
  const text = body.trim()
  if (!text || text.length > 600) return false

  if (/הום|hom[\s-]?group|השטיח\s+האדום|carpetshop|pozitive|red\s*carpet/i.test(text)) {
    return false
  }

  return (
    /תודה\s+שיצר(?:ת|תם|ת)\s+קשר\s+ע(?:ם|ם)/i.test(text) ||
    /(?:עיצוב\s+פנים|סטיילינג|ייעוץ\s+עיצוב|אדריכלות).*איך\s+(?:אפשר|נוכל)\s+לעזור/i.test(text) ||
    /ז(?:ה|ו)\s+הודע(?:ה)?\s+אוטומטית/i.test(text) ||
    /automatic\s+reply|out\s+of\s+office/i.test(text) ||
    (/^‏/.test(text) && /יצר(?:ת|תם)\s+קשר/i.test(text) && text.split(/\s+/).length >= 8)
  )
}
