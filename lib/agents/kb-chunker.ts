export type KbChunk = {
  sectionId: string
  title: string
  content: string
  source: string
}

export function chunkMarkdownBySection(
  markdown: string,
  source: string,
  maxChunkChars = 1200
): KbChunk[] {
  const parts = markdown.split(/^## /m)
  const header = (parts.shift() ?? "").trim()
  const chunks: KbChunk[] = []

  if (header.length > 0) {
    chunks.push({
      sectionId: `${source}:header`,
      title: "header",
      content: header,
      source,
    })
  }

  for (const part of parts) {
    const newline = part.indexOf("\n")
    const title = (newline === -1 ? part : part.slice(0, newline)).trim()
    const body = `## ${part.trim()}`
    const sectionId = `${source}:${title.toLowerCase().replace(/\s+/g, "-").slice(0, 80)}`

    if (body.length <= maxChunkChars) {
      chunks.push({ sectionId, title, content: body, source })
      continue
    }

    const paragraphs = body.split(/\n\n+/)
    let buffer = ""
    let index = 0
    for (const paragraph of paragraphs) {
      const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph
      if (next.length > maxChunkChars && buffer) {
        chunks.push({
          sectionId: `${sectionId}:${index}`,
          title,
          content: buffer,
          source,
        })
        buffer = paragraph
        index += 1
      } else {
        buffer = next
      }
    }
    if (buffer.trim()) {
      chunks.push({
        sectionId: `${sectionId}:${index}`,
        title,
        content: buffer,
        source,
      })
    }
  }

  return chunks
}

export function scoreChunkForQuery(chunk: KbChunk, query: string) {
  const q = query.toLowerCase()
  const hay = `${chunk.title}\n${chunk.content}`.toLowerCase()
  let score = 0
  for (const token of q.split(/\s+/).filter((t) => t.length >= 3)) {
    if (hay.includes(token)) score += 1
  }
  if (hay.includes(q) && q.length >= 4) score += 3
  return score
}
