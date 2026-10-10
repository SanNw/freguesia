export interface ComparisonChoice {
  offerId: string;
  title: string;
  affiliateUrl: string;
  side: "left" | "right";
}
export interface ComparisonResult {
  markdown: string;
  choices: ComparisonChoice[];
}

export function normalizeComparisonText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/(rx|gtx)\s*(\d+)/g, "$1 $2")
    .replace(/(\d)\s*ti\b/g, "$1 ti")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
export function parseComparisonCommand(
  text: string,
): { left: string; right: string } | null {
  const content = text.trim().replace(/^\/comparar(?:@[a-z0-9_]+)?\s+/i, "");
  const parts = content.split(/\s+vs\.?\s+/i).map((part) => part.trim());
  if (
    parts.length !== 2 ||
    parts.some(
      (part) => !part || part.length > 120 || invalidComparisonText(part),
    )
  )
    return null;
  return { left: parts[0], right: parts[1] };
}
export function invalidComparisonText(text: string): boolean {
  return (
    /https?:|[<>]/i.test(text) ||
    [...text].some((character) => character.charCodeAt(0) < 32)
  );
}
export function matchesComparisonQuery(query: string, title: string): boolean {
  const normalized = normalizeComparisonText(title);
  const needle = normalizeComparisonText(query);
  if (!needle) return false;
  const gpu = /\b(?:rx|gtx) \d+(?: ti)?\b/.test(needle);
  if (
    gpu &&
    /\b(cooler|ventoinha|suporte|cabo|adaptador|backplate|waterblock|dissipador|para placa)\b/.test(
      normalized,
    )
  )
    return false;
  return (
    needle.split(" ").every((word) => normalized.split(" ").includes(word)) &&
    (!gpu || !/\bti\b/.test(normalized) || /\bti\b/.test(needle))
  );
}
export function escapeComparisonText(text: string): string {
  return text.replace(
    /[<>&\\`*_{}[\]()#+.!|~$-]/g,
    (character) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[character] ??
      `\\${character}`,
  );
}
