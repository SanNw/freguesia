import { formatBRL } from "./price.js";

export type ShippingOrigin = "brazil" | "international" | "unknown";

export interface OfferCommerceDetailsInput {
  shippingOrigin?: ShippingOrigin;
  rating?: number | null;
  reviewCount?: number | null;
  taxAmountCents?: number | null;
  taxIncluded?: boolean | null;
  taxConfirmed?: boolean;
  installmentCount?: number | null;
  installmentValueCents?: number | null;
  interestFree?: boolean;
}

export function buildOfferCommerceDetails(
  input: OfferCommerceDetailsInput,
): string[] {
  const lines: string[] = [];

  if (
    input.interestFree &&
    input.installmentCount != null &&
    input.installmentCount > 1 &&
    input.installmentValueCents != null
  ) {
    lines.push(
      `💳 ${input.installmentCount}x de ${formatBRL(input.installmentValueCents)} sem juros`,
    );
  }

  if (input.rating != null) {
    const reviews =
      input.reviewCount != null
        ? ` (${new Intl.NumberFormat("pt-BR").format(input.reviewCount)} avaliações)`
        : "";
    lines.push(`⭐ ${input.rating.toFixed(1)}/5${reviews}`);
  }

  if (input.shippingOrigin === "brazil") {
    lines.push("🇧🇷 Envio nacional");
  } else if (input.shippingOrigin === "international") {
    lines.push("🌍 Produto internacional");
    if (input.taxConfirmed && input.taxAmountCents != null) {
      const suffix = input.taxIncluded === true ? " (já incluídos)" : "";
      lines.push(`🧾 Impostos: ${formatBRL(input.taxAmountCents)}${suffix}`);
    } else {
      lines.push("🧾 Impostos podem ser calculados no checkout");
    }
  } else if (input.taxConfirmed && input.taxAmountCents != null) {
    const suffix = input.taxIncluded === true ? " (já incluídos)" : "";
    lines.push(`🧾 Impostos: ${formatBRL(input.taxAmountCents)}${suffix}`);
  }

  return lines;
}
