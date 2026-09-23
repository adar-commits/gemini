/** Identifier extraction for inventory — size/מק״ט from customer text vs link SKU. */

const DIMENSION_RE =
  /\b(\d{2,3})\s*[x×*./\u05d7]\s*(\d{2,3})\b/gi

const SIZE_CODE_RE =
  /\b(XXS|XS|S|M|L|XL|XXL|XXXL)\b/i

const SIZE_CODE_TO_DIMENSIONS: Record<string, string> = {
  XXS: "60×115",
  XS: "80×150",
  S: "120×170",
  M: "140×190",
  L: "160×230",
  XL: "200×290",
  XXL: "240×340",
  XXXL: "300×400",
}

export type StatedProductSize = {
  label: string
  width: number
  height: number
}

function normalizeDimensionPair(width: number, height: number) {
  const a = Math.min(width, height)
  const b = Math.max(width, height)
  return `${a}×${b}`
}

export function formatStatedSizeLabel(size: StatedProductSize) {
  return size.label
}

/** Parse explicit dimensions (240×320) or size codes (XXL) from customer text. */
export function extractStatedProductSize(text: string): StatedProductSize | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  DIMENSION_RE.lastIndex = 0
  const dimensionMatch = DIMENSION_RE.exec(trimmed)
  if (dimensionMatch?.[1] && dimensionMatch[2]) {
    const width = Number(dimensionMatch[1])
    const height = Number(dimensionMatch[2])
    if (Number.isFinite(width) && Number.isFinite(height)) {
      return {
        label: `${width}×${height}`,
        width,
        height,
      }
    }
  }

  const codeMatch = trimmed.match(SIZE_CODE_RE)
  if (codeMatch?.[1]) {
    const code = codeMatch[1].toUpperCase()
    const mapped = SIZE_CODE_TO_DIMENSIONS[code]
    if (mapped) {
      const [widthRaw, heightRaw] = mapped.split("×")
      const width = Number(widthRaw)
      const height = Number(heightRaw)
      if (Number.isFinite(width) && Number.isFinite(height)) {
        return { label: code, width, height }
      }
    }
  }

  return null
}

/** Variant suffix from Hom SKU (e.g. 31503138-200290 → 200×290). */
export function sizeLabelFromSku(sku: string): string | null {
  const match = sku.trim().match(/-(\d{3})(\d{3})$/)
  if (!match?.[1] || !match[2]) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width < 40 || height < 40) return null
  return `${width}×${height}`
}

export function statedSizeMatchesSku(stated: StatedProductSize, sku: string) {
  const fromSku = sizeLabelFromSku(sku)
  if (!fromSku) return true
  const [widthRaw, heightRaw] = fromSku.split("×")
  const skuWidth = Number(widthRaw)
  const skuHeight = Number(heightRaw)
  if (!Number.isFinite(skuWidth) || !Number.isFinite(skuHeight)) return true

  const statedNorm = normalizeDimensionPair(stated.width, stated.height)
  const skuNorm = normalizeDimensionPair(skuWidth, skuHeight)
  if (statedNorm === skuNorm) return true

  // Allow small rounding (240×340 vs 240×320 class — still a mismatch worth confirming).
  return stated.width === skuWidth && stated.height === skuHeight
}

export function findStatedSizeInTexts(texts: string[]) {
  for (const text of texts) {
    const stated = extractStatedProductSize(text)
    if (stated) return stated
  }
  return null
}
