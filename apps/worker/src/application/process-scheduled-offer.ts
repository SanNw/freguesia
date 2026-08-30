import { offerRepository } from "../adapters/persistence/offer-repository.js";
import { productRepository } from "../adapters/persistence/product-repository.js";
import type { Logger } from "../config/logger.js";
import { classifyProductNicheDecision } from "../domain/product-niche.js";
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
      const decision = classifyProductNicheDecision(
        product.title,
        product.category,
      );
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
