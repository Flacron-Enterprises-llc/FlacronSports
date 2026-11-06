const MAX_CHUNK = 220

/** Browsers cut a long utterance off, so a report is read in sentence-sized pieces. */
export function speechChunks(text: string): string[] {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]*\s*/g) ?? []
  const chunks: string[] = []
  let current = ""
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > MAX_CHUNK) {
      chunks.push(current.trim())
      current = ""
    }
    current += sentence
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

export const speechLang = (locale: string): string => (locale === "fr" ? "fr-FR" : "en-US")
