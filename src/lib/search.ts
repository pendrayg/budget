/** Un texte comparable : en minuscules, sans accents (« Électricité » → « electricite »). */
export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/** Le nom contient-il chaque mot cherché, accents et majuscules ignorés ? Une recherche vide garde tout. */
export function matchesSearch(name: string, query: string): boolean {
  const text = normalize(name)
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word))
}
