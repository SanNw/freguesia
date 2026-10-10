import type { ProductNiche } from "./product-niche.js";

interface Candidate {
  id: string;
  niche: ProductNiche;
  score: number;
  createdAt: string;
}

/** Prefer the least recently served niche; then quality and age within that niche. */
export function selectPublicationCandidate<T extends Candidate>(
  candidates: T[],
  lastPublished: Partial<Record<ProductNiche, string>>,
): T | null {
  const oldestByNiche = new Map<ProductNiche, T>();
  for (const candidate of candidates) {
    const oldest = oldestByNiche.get(candidate.niche);
    if (
      !oldest ||
      Date.parse(candidate.createdAt) < Date.parse(oldest.createdAt)
    ) {
      oldestByNiche.set(candidate.niche, candidate);
    }
  }
  const niche = [...oldestByNiche.values()].sort((a, b) => {
    const activity =
      (Date.parse(lastPublished[a.niche] ?? "") || 0) -
      (Date.parse(lastPublished[b.niche] ?? "") || 0);
    if (activity) return activity;
    return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  })[0]?.niche;
  return (
    candidates
      .filter((candidate) => candidate.niche === niche)
      .sort(
        (a, b) =>
          b.score - a.score ||
          Date.parse(a.createdAt) - Date.parse(b.createdAt),
      )[0] ?? null
  );
}
