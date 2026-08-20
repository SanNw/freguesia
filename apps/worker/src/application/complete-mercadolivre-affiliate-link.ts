import type { Logger } from "../config/logger.js";
import { mercadoLivreEnv as env } from "../config/runtime.js";
import { offerRepository } from "../adapters/persistence/offer-repository.js";
import { validateAffiliateUrl } from "../domain/affiliate-link.js";
import { AppError } from "../shared/errors.js";
import { buildCaption } from "./create-manual-offer.js";
import { requestApproval } from "./request-approval.js";

export async function completeMercadoLivreAffiliateLink(
  offerId: string,
  affiliateUrl: string,
  logger: Logger,
) {
  const allowedDomains = env.AFFILIATE_ALLOWED_DOMAINS.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const validation = validateAffiliateUrl(
    affiliateUrl,
    allowedDomains,
    env.AFFILIATE_REQUIRE_HTTPS,
  );
  if (!validation.valid) {
    throw new AppError(
      "VALIDATION_FAILED",
      `Invalid affiliate URL: ${validation.reason}`,
      false,
      422,
    );
  }
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
  const additionalImages = Array.isArray(data.additional_image_urls)
    ? data.additional_image_urls.map(String)
    : [];
  const caption = buildCaption(
    {
      title: String(data.title),
      canonicalUrl: String(data.canonical_url),
      currentPriceCents: Number(data.current_price_cents),
      previousPriceCents:
        data.previous_price_cents == null
          ? null
          : Number(data.previous_price_cents),
      currency: String(data.currency),
      imageUrl: data.image_url == null ? null : String(data.image_url),
      additionalImages,
      couponCode: data.coupon_code == null ? null : String(data.coupon_code),
      couponDescription:
        data.coupon_description == null
          ? null
          : String(data.coupon_description),
      affiliateUrl,
      store: String(data.store),
      availability: String(data.availability),
    },
    data.discount_percent == null ? null : Number(data.discount_percent),
  );
  await offerRepository.completeAffiliateLink(offerId, affiliateUrl, caption);
  const approval = await requestApproval(offerId, logger);
  logger.info({ offerId }, "Mercado Livre affiliate link completed");
  return { offerId, status: "pending_approval", approval };
}
