import { offerRepository } from "../adapters/persistence/offer-repository.js";
import { productRepository } from "../adapters/persistence/product-repository.js";
import type { Logger } from "../config/logger.js";
import { publicationEnv as env } from "../config/runtime.js";
import {
  classifyProductNicheDecision,
  type ProductNicheDecision,
  PRODUCT_CLASSIFIER_VERSION,
} from "../domain/product-niche.js";
import { AppError } from "../shared/errors.js";
import { publishOffer } from "./publish-offer.js";
import { requestChannelApproval } from "./request-channel-approval.js";

export type ScheduledOfferResult =
  "idle" | "published" | "needs_channel_approval" | "retrying" | "failed";

export async function processNextScheduledOffer(
  logger: Logger,
): Promise<ScheduledOfferResult> {
  let offer: Awaited<ReturnType<typeof offerRepository.findNextScheduled>> =
    null;

  try {
    await offerRepository.expireScheduledOffers();
    offer = await offerRepository.findNextScheduled();
    if (!offer) return "idle";

    if (
      await offerRepository.wasRecentlyPublished(
        offer.id,
        env.REPOST_COOLDOWN_HOURS,
        env.REPOST_MIN_PRICE_DROP_PERCENT,
      )
    ) {
      await offerRepository.transitionStatus(
        offer.id,
        [offer.status],
        "rejected",
        "RECENTLY_PUBLISHED",
      );
      return "idle";
    }

    if (offer.publicationNicheSource !== "manual") {
      const product = await productRepository.getById(offer.productId);
      if (!product) {
        throw new AppError(
          "VALIDATION_FAILED",
          "Product not found for scheduled offer",
          false,
          422,
        );
      }
      const previousChoice = await offerRepository.findManualNicheForProduct(
        offer.productId,
      );
      const decision: ProductNicheDecision = previousChoice
        ? {
            niche: previousChoice,
            automatic: true,
            confidence: "high",
            evidence: "manual_history",
            version: PRODUCT_CLASSIFIER_VERSION,
          }
        : classifyProductNicheDecision(product.title, product.category);
      if (!decision.automatic) {
        const queuedForApproval = await offerRepository.transitionStatus(
          offer.id,
          [offer.status],
          "pending_approval",
          "CHANNEL_SELECTION_REQUIRED",
        );
        if (!queuedForApproval) return "idle";
        try {
          await requestChannelApproval(offer.id, decision, logger);
        } catch (error) {
          await offerRepository.transitionStatus(
            offer.id,
            ["pending_approval"],
            "scheduled",
          );
          throw error;
        }
        return "needs_channel_approval";
      }
      const persisted = await offerRepository.setPublicationNiche(
        offer.id,
        decision.niche,
        "classifier",
        [offer.status],
      );
      if (!persisted) return "idle";
      logger.info?.(
        { offerId: offer.id, decision, previousChoice },
        "Product channel classified",
      );
    }

    await publishOffer(offer.id, `scheduled:${offer.id}`, logger);
    return "published";
  } catch (error) {
    if (offer && error instanceof AppError && !error.retryable) {
      await offerRepository.updateStatus(offer.id, "failed", error.message);
      logger.warn(
        { err: error, offerId: offer.id },
        "Scheduled offer rejected permanently",
      );
      return "failed";
    }

    logger.debug(
      { err: error, offerId: offer?.id },
      "Scheduled publication is waiting",
    );
    return "retrying";
  }
}
