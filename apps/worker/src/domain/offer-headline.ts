import { classifyProductNiche } from "./product-niche.js";

function cleanProductName(title: string): string {
  const cleaned = title
    .replace(/[#*_`~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= 58) return cleaned;
  return `${cleaned.slice(0, 55).trim()}...`;
}

function stableIndex(value: string, length: number): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % length;
}

export function buildOfferHeadline(
  title: string,
  category: string | null | undefined,
  discountPercent: number | null,
): string {
  const product = cleanProductName(title);
  const discount = Math.round(discountPercent ?? 0);
  if (discount >= 50) return `🚨 ${product}: preço despencou ${discount}%!`;
  if (discount >= 35) return `🔥 ${product} com ${discount}% OFF!`;

  const niche = classifyProductNiche(title, category);
  const templates = {
    electronics: [
      `📱 Achado tech: ${product}`,
      `⚡ Tecnologia boa, preço melhor: ${product}`,
      `🔌 ${product} entrou no modo economia!`,
    ],
    hardware: [
      `🖥️ Upgrade com desconto: ${product}`,
      `⚙️ Seu setup pediu: ${product}`,
      `🚀 Mais desempenho por menos: ${product}`,
    ],
    beauty: [
      `✨ Achadinho de beleza: ${product}`,
      `💄 Beleza em oferta: ${product}`,
      `🪞 Momento de se cuidar pagando menos: ${product}`,
    ],
    appliances: [
      `⚡ Eletro em oferta: ${product}`,
      `🏠 Casa equipada por menos: ${product}`,
      `🔋 Praticidade com desconto: ${product}`,
    ],
    home_kitchen: [
      `🏡 Achado para casa: ${product}`,
      `🍳 Casa bonita, preço melhor: ${product}`,
      `✨ Um bom achado para o lar: ${product}`,
    ],
    general: [
      `🛍️ Achado do dia: ${product}`,
      `💥 Preço bom encontrado: ${product}`,
      `👀 Vale a pena conferir: ${product}`,
    ],
  }[niche];
  return templates[stableIndex(title, templates.length)];
}
