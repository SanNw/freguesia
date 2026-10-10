/**
 * Shared utilities for title tokenization, similarity, and MMR-based diversity selection.
 */

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((token) => token.length > 2),
  );
}

export function titleSimilarity(left: string, right: string): number {
  const a = titleTokens(left);
  const b = titleTokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

export interface RankedItem<T> {
  item: T;
  score: number;
  publishedAt?: Date | string | null;
}

export interface MMRConfig<T> {
  /** Relevance vs diversity trade-off (1 = pure relevance, 0 = pure diversity). */
  lambda: number;
  /** Items with similarity >= threshold against an already-selected item are skipped. */
  similarityThreshold?: number;
  /** Extracts the comparable title from an item. Required for diversity-aware selection. */
  getTitle: (item: T) => string;
}

const DEFAULT_MMR_CONFIG = {
  lambda: 0.7,
  similarityThreshold: 0.85,
} as const;

/**
 * Logarithmic recency decay: fresh items keep boost ~1.0, older items decay
 * towards a floor of 0.3. Items without a timestamp are treated as neutral (1.0).
 */
export function recencyBoost(
  publishedAt: Date | string | null | undefined,
): number {
  if (!publishedAt) return 1.0;
  const date =
    publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  const time = date.getTime();
  if (!Number.isFinite(time)) return 1.0;
  const ageDays = (Date.now() - time) / (1000 * 60 * 60 * 24);
  if (ageDays <= 0) return 1.0;
  return Math.max(0.3, 1.0 / Math.log10(ageDays + 10));
}

/**
 * Maximal Marginal Relevance selection.
 *
 * MMR(item) = λ * score(item) - (1 - λ) * max_sim(item, selected)
 *
 * Picks the highest-scored item first, then iteratively picks the item that
 * maximizes MMR while skipping near-duplicates (>= similarityThreshold).
 */
export function mmrSelect<T>(
  candidates: RankedItem<T>[],
  targetCount: number,
  config: Partial<MMRConfig<T>> & Pick<MMRConfig<T>, "getTitle">,
): RankedItem<T>[] {
  const { lambda, similarityThreshold, getTitle } = {
    ...DEFAULT_MMR_CONFIG,
    ...config,
  };
  if (candidates.length <= targetCount) return [...candidates];

  const maxSimAgainstSelected = (
    item: T,
    selected: RankedItem<T>[],
  ): number => {
    let maxSim = 0;
    for (const sel of selected) {
      const sim = titleSimilarity(getTitle(item), getTitle(sel.item));
      if (sim > maxSim) maxSim = sim;
    }
    return maxSim;
  };

  const selected: RankedItem<T>[] = [];
  const remaining = [...candidates].sort((a, b) => b.score - a.score);

  // First pick is always the highest-scored candidate.
  selected.push(remaining.shift()!);

  while (selected.length < targetCount && remaining.length > 0) {
    let bestIdx = -1;
    let bestMMR = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      if (
        similarityThreshold &&
        maxSimAgainstSelected(candidate.item, selected) >= similarityThreshold
      ) {
        continue; // near-duplicate of something already selected
      }
      const mmrScore =
        lambda * candidate.score -
        (1 - lambda) * maxSimAgainstSelected(candidate.item, selected);
      if (mmrScore > bestMMR) {
        bestMMR = mmrScore;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) break; // everything left is a near-duplicate
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }

  return selected;
}

/** Multiplies each candidate score by its recency boost. */
export function applyRecencyBoost<T>(
  candidates: RankedItem<T>[],
): RankedItem<T>[] {
  return candidates.map((c) => ({
    ...c,
    score: c.score * recencyBoost(c.publishedAt),
  }));
}
