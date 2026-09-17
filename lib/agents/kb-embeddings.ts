import { embed, embedMany } from "ai"

const EMBED_MODEL =
  process.env.KB_EMBED_MODEL?.trim() || "openai/text-embedding-3-small"

export const KB_EMBED_DIMENSIONS = 1536

function truncateForEmbed(text: string, maxChars = 6000) {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  return trimmed.slice(0, maxChars)
}

export async function embedKbQuery(text: string) {
  const { embedding } = await embed({
    model: EMBED_MODEL,
    value: truncateForEmbed(text, 2000),
  })
  return embedding
}

export async function embedKbDocuments(texts: string[]) {
  if (texts.length === 0) return []
  const { embeddings } = await embedMany({
    model: EMBED_MODEL,
    values: texts.map((text) => truncateForEmbed(text)),
  })
  return embeddings
}

/** Serialize for Supabase pgvector insert (PostgREST). */
export function embeddingToPgvector(embedding: number[]) {
  return `[${embedding.join(",")}]`
}
