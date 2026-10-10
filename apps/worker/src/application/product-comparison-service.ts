import {
  productComparisonRepository,
  type ComparisonCatalog,
  type ComparisonOffer,
} from "../adapters/persistence/product-comparison-repository.js";
import { validWatchAffiliate } from "../adapters/sources/watched-product-source.js";
import {
  escapeComparisonText as escape,
  matchesComparisonQuery,
  invalidComparisonText,
  type ComparisonResult,
} from "../domain/product-comparison.js";
import { technicalProfile } from "../domain/technical-product-profiles.js";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class ProductComparisonService {
  constructor(
    private readonly catalog: ComparisonCatalog = productComparisonRepository,
  ) {}
  private async resolve(input: string): Promise<string> {
    if (input.startsWith("offer:")) {
      const id = input.slice(6);
      const product = uuid.test(id)
        ? await this.catalog.publishedProduct(id)
        : null;
      if (!product)
        throw new Error("A publicação não está disponível para comparação.");
      return (
        technicalProfile(product.title)?.name ??
        product.model ??
        product.title.slice(0, 120)
      );
    }
    const query = input.trim();
    if (!query || query.length > 120 || invalidComparisonText(query))
      throw new Error(
        "Informe dois nomes de produtos, até 120 caracteres cada.",
      );
    return technicalProfile(query)?.name ?? query;
  }
  private async offers(query: string): Promise<ComparisonOffer[]> {
    const seen = new Set<string>();
    return (await this.catalog.search(query))
      .filter((offer) => {
        if (
          !uuid.test(offer.offerId) ||
          seen.has(offer.offerId) ||
          !matchesComparisonQuery(query, offer.title) ||
          !Number.isSafeInteger(offer.priceCents) ||
          offer.priceCents <= 0 ||
          !validWatchAffiliate(offer.affiliateUrl)
        )
          return false;
        seen.add(offer.offerId);
        return true;
      })
      .sort((a, b) => a.priceCents - b.priceCents)
      .slice(0, 3);
  }
  async compareProducts(
    leftInput: string,
    rightInput: string,
  ): Promise<ComparisonResult> {
    const [left, right] = await Promise.all([
      this.resolve(leftInput),
      this.resolve(rightInput),
    ]);
    const [leftOffers, rightOffers] = await Promise.all([
      this.offers(left),
      this.offers(right),
    ]);
    const profiles = [technicalProfile(left), technicalProfile(right)];
    const sections = [left, right].map((query, index) => {
      const profile = profiles[index],
        offers = index === 0 ? leftOffers : rightOffers;
      const specs = profile
        ? `Memória: ${profile.memory}\nInterface de memória: ${profile.memoryBus}\nPotência da placa: ${profile.powerWatts} W\n${escape(profile.caveat)}\n[Ficha oficial](${profile.sourceUrl})`
        : "Sem ficha técnica verificada para este modelo.";
      const prices = offers.length
        ? offers
            .map(
              (offer) =>
                `${escape(offer.title.slice(0, 150))} — **${escape((offer.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))}**`,
            )
            .join("\n")
        : "Sem oferta atual verificada no nosso catálogo.";
      return `### ${escape(query)}\n${specs}\n\n${prices}`;
    });
    const interpretation = profiles.every(Boolean)
      ? "A RX 550 tem menor potência de referência; a GTX 1050 Ti da ficha consultada tem 4 GB. Não há benchmark verificado aqui para afirmar FPS ou eleger vencedora em jogos. Compare preço, variante, condição da placa e compatibilidade com seu computador."
      : "Compare a variante exata e o preço final. Características não documentadas não foram inferidas; não há recomendação automática de vencedora.";
    return {
      markdown: `## Comparação de produtos\n\n${sections.join("\n\n")}\n\n${interpretation}\n\nPreços observados nas últimas 24 horas, sujeitos a alteração. Os links de compra são de afiliado do Freguesia.`,
      choices: [
        ...leftOffers.map((offer) => ({
          offerId: offer.offerId,
          title: offer.title,
          affiliateUrl: offer.affiliateUrl,
          side: "left" as const,
        })),
        ...rightOffers.map((offer) => ({
          offerId: offer.offerId,
          title: offer.title,
          affiliateUrl: offer.affiliateUrl,
          side: "right" as const,
        })),
      ],
    };
  }
  async comparisonSuggestions(
    offerId: string,
  ): Promise<{
    left: string;
    title: string;
    choices: Array<{ query: string; label: string }>;
  }> {
    const left = await this.resolve(`offer:${offerId}`);
    const profile = technicalProfile(left);
    return {
      left,
      title: left,
      choices: profile
        ? [
            {
              query: profile.name === "RX 550" ? "GTX 1050 Ti" : "RX 550",
              label: profile.name === "RX 550" ? "GTX 1050 Ti" : "RX 550",
            },
          ]
        : [],
    };
  }
}
export const productComparisonService = new ProductComparisonService();
export const compareProducts = (
  left: string,
  right: string,
): Promise<ComparisonResult> =>
  productComparisonService.compareProducts(left, right);
export const comparisonSuggestions = (offerId: string) =>
  productComparisonService.comparisonSuggestions(offerId);
