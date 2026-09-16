function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function pushLink(links: string[], value: unknown) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  if (trimmed && isHttpUrl(trimmed)) links.push(trimmed)
}

function extractLinksFromResultItem(links: string[], item: unknown) {
  if (item == null || typeof item !== "object") return
  const record = item as Record<string, unknown>
  if (typeof record.link === "string") {
    pushLink(links, record.link)
    return
  }
  if (typeof record.pdf_link === "string") pushLink(links, record.pdf_link)
}

function extractLinksFromEnvelope(links: string[], envelope: unknown) {
  if (envelope == null || typeof envelope !== "object") return
  const record = envelope as Record<string, unknown>

  if ("result" in record) {
    pushLink(links, record.result)
    return
  }

  const data = record.data
  if (data == null || typeof data !== "object") return
  const dataRecord = data as Record<string, unknown>
  if (!Array.isArray(dataRecord.results)) return
  for (const item of dataRecord.results) extractLinksFromResultItem(links, item)
}

/** Parse all document links from a getDocument webhook payload (legacy or results-array shape). */
export function parseDocumentLinksFromPayload(data: unknown): string[] {
  const links: string[] = []

  if (Array.isArray(data)) {
    for (const item of data) extractLinksFromEnvelope(links, item)
  } else {
    extractLinksFromEnvelope(links, data)
  }

  return [...new Set(links)]
}

/** First document link from a getDocument payload, or null when none found. */
export function parseDocumentLinkFromPayload(data: unknown): string | null {
  return parseDocumentLinksFromPayload(data)[0] ?? null
}
