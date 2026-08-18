import type { Logger } from "../config/logger.js";
import { offerRepository } from "../adapters/persistence/offer-repository.js";
import { generateMercadoLivreAffiliateLink } from "../adapters/mercadolivre/affiliate-link-generator.js";
import { AppError } from "../shared/errors.js";
import { completeMercadoLivreAffiliateLink } from "./complete-mercadolivre-affiliate-link.js";

export async function generateAffiliateLinkForOffer(
  offerId: string,
  logger: Logger,
) {
  const data = await offerRepository.getAffiliateCompletionData(offerId);
  if (!data) {
    throw new AppError("OFFER_NOT_FOUND", "Offer not found", false, 404);
  }
  if (data.status !== "needs_affiliate_link") {
    throw new AppError(
      "INVALID_STATE",
      "Offer is not waiting for an affiliate link",
      false,
      409,
    );
  }
  const result = await generateMercadoLivreAffiliateLink(
    String(data.canonical_url),
  );
  if (result.status !== "generated") {
    logger.warn(
      { offerId, status: result.status },
      "Affiliate generation paused",
    );
    return { offerId, ...result };
  }
  return completeMercadoLivreAffiliateLink(offerId, result.url, logger);
}
