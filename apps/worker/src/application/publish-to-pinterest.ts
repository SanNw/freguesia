import type { Logger } from "../config/logger.js";
import { pinterestEnv as env } from "../config/runtime.js";
import { offerRepository } from "../adapters/persistence/offer-repository.js";
import { productRepository } from "../adapters/persistence/product-repository.js";
import { pinterestPublicationRepository } from "../adapters/persistence/pinterest-publication-repository.js";
import { PinterestGateway } from "../adapters/pinterest/pinterest-gateway.js";
import {
  classifyProductNiche,
  type ProductNiche,
} from "../domain/product-niche.js";
import { AppError } from "../shared/errors.js";

export function pinterestBoardId(niche: ProductNiche): string {
  return {
    hardware: env.PINTEREST_BOARD_HARDWARE_ID,
    home_kitchen: env.PINTEREST_BOARD_CASA_COZINHA_ID,
    appliances: env.PINTEREST_BOARD_ELETRODOMESTICOS_ID,
    beauty: env.PINTEREST_BOARD_COSMETICOS_BELEZA_ID,
    electronics: env.PINTEREST_BOARD_ELETRONICOS_ID,
    fashion: env.PINTEREST_BOARD_HUB_ID,
    general: env.PINTEREST_BOARD_HUB_ID,
  }[niche];
}

export async function publishToPinterest(
  offerId: string,
  idempotencyKey: string,
  logger: Logger,
): Promise<{ status: string; pinId?: string; pinUrl?: string }> {
  if (!env.PINTEREST_ENABLED || !env.PINTEREST_ACCESS_TOKEN) {
    throw new AppError(
      "PUBLICATION_FAILED",
      "Pinterest integration is not configured",
      false,
      503,
    );
  }
  const offer = await offerRepository.getOffer(offerId);
  if (!offer)
    throw new AppError("OFFER_NOT_FOUND", "Offer not found", false, 404);
  if (!["approved", "scheduled", "published"].includes(offer.status)) {
    throw new AppError(
      "VALIDATION_FAILED",
      `Offer status ${offer.status} cannot be published`,
      false,
      409,
    );
  }
  if (!offer.affiliateUrl || !offer.imageUrl) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Pinterest requires affiliate URL and image",
      false,
      422,
    );
  }
  const product = await productRepository.getById(offer.productId);
  if (!product)
    throw new AppError("VALIDATION_FAILED", "Product not found", false, 422);
  const niche = classifyProductNiche(product.title, product.category);
  const boardId = pinterestBoardId(niche);
  if (!boardId)
    throw new AppError(
      "VALIDATION_FAILED",
      `No Pinterest board configured for ${niche}`,
      false,
      422,
    );

  const title = product.title.slice(0, 100);
  const description =
    `${offer.proposedCaption || product.title}\n\n${env.PINTEREST_DISCLOSURE_TEXT}`.slice(
      0,
      500,
    );
  const publicationId = crypto.randomUUID();
  const reserved = await pinterestPublicationRepository.reserve({
    id: publicationId,
    offerId,
    boardId,
    idempotencyKey,
    title,
    description,
    imageUrl: offer.imageUrl,
    affiliateUrl: offer.affiliateUrl,
  });
  if (!reserved) return { status: "already_published" };

  try {
    const pin = await new PinterestGateway(logger).createPin({
      boardId,
      title,
      description,
      link: offer.affiliateUrl,
      altText: `Oferta de ${product.title}`.slice(0, 500),
      imageUrl: offer.imageUrl,
    });
    await pinterestPublicationRepository.markPublished(
      publicationId,
      pin.id,
      pin.url,
    );
    logger.info(
      { offerId, publicationId, pinId: pin.id, niche },
      "Offer published to Pinterest",
    );
    return { status: "published", pinId: pin.id, pinUrl: pin.url };
  } catch (error) {
    await pinterestPublicationRepository.markFailed(publicationId, error);
    throw error;
  }
}
