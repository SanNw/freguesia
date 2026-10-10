import {
  matchesComparisonQuery,
  normalizeComparisonText,
} from "./product-comparison.js";

export interface TechnicalProductProfile {
  name: string;
  powerWatts: number;
  memory: string;
  memoryBus: string;
  sourceTitle: string;
  sourceUrl: string;
  caveat: string;
}
const profiles: TechnicalProductProfile[] = [
  {
    name: "RX 550",
    powerWatts: 50,
    memory: "Até 4 GB GDDR5",
    memoryBus: "128 bits",
    sourceTitle: "AMD — Radeon RX 550",
    sourceUrl:
      "https://www.amd.com/en/support/downloads/drivers.html/graphics/radeon-600-500-400/radeon-rx-500-series/radeon-rx-550.html",
    caveat:
      "Especificação de referência AMD; há placas de 2 e 4 GB. Confira a variante do anúncio.",
  },
  {
    name: "GTX 1050 Ti",
    powerWatts: 75,
    memory: "4 GB GDDR5",
    memoryBus: "128 bits",
    sourceTitle: "MSI — GeForce GTX 1050 Ti 4G",
    sourceUrl:
      "https://storage-asset.msi.com/datasheet/vga/global/GeForce-GTX-1050-Ti-4G.pdf",
    caveat: "Especificação da MSI GTX 1050 Ti 4G; outras placas podem variar.",
  },
];
export function technicalProfile(
  query: string,
): TechnicalProductProfile | null {
  const normalized = normalizeComparisonText(query);
  return (
    profiles.find(
      (profile) =>
        matchesComparisonQuery(profile.name, query) &&
        (normalized === normalizeComparisonText(profile.name) ||
          /\b(placa|radeon|geforce|amd|nvidia|msi)\b/.test(normalized)),
    ) ?? null
  );
}
