import { z } from "zod";

export const SOURCE_TYPES = [
  "api",
  "feed",
  "rss",
  "page",
  "portal",
  "manual",
  "webhook",
  "assisted",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const AVAILABILITY = [
  "in_stock",
  "out_of_stock",
  "preorder",
  "unknown",
] as const;
export type Availability = (typeof AVAILABILITY)[number];

export const OFFER_STATUS = [
  "discovered",
  "validated",
  "needs_affiliate_link",
  "pending_approval",
  "approved",
  "rejected",
  "scheduled",
  "publishing",
  "published",
  "expired",
  "failed",
  "blocked_captcha",
  "blocked_terms",
] as const;
export type OfferStatus = (typeof OFFER_STATUS)[number];

export const APPROVAL_DECISIONS = [
  "approve",
  "edit",
  "discard",
  "revalidate",
  "schedule",
] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const CONDITION = ["new", "used", "refurbished", "unknown"] as const;
export type Condition = (typeof CONDITION)[number];

export const extractedProductSchema = z.object({
  source: z.string(),
  externalId: z.string(),
  canonicalUrl: z.string().url(),
  title: z.string().min(1),
  currentPriceCents: z.number().int().positive(),
  previousPriceCents: z.number().int().positive().optional().nullable(),
  currency: z.string().length(3),
  imageUrl: z.string().url().optional().nullable(),
  availability: z.enum(AVAILABILITY).default("unknown"),
  seller: z.string().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  reviewCount: z.number().int().min(0).optional().nullable(),
  capturedAt: z.string().datetime(),
  rawEvidence: z.record(z.unknown()).default({}),
});

export type ExtractedProduct = z.infer<typeof extractedProductSchema>;

export const offerSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  sourceObservationId: z.string(),
  status: z.enum(OFFER_STATUS),
  score: z.number().min(0).max(100),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  affiliateUrl: z.string().url().optional().nullable(),
  affiliateProvider: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  additionalImageUrls: z.array(z.string().url()).default([]),
  couponCode: z.string().optional().nullable(),
  couponDescription: z.string().optional().nullable(),
  proposedCaption: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  idempotencyKey: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Offer = z.infer<typeof offerSchema>;

export const affiliateLinkSchema = z.object({
  url: z.string().url(),
  provider: z.string(),
  trackingId: z.string().uuid().optional().nullable(),
});

export type AffiliateLink = z.infer<typeof affiliateLinkSchema>;

export const variantSchema = z.object({
  color: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  storage: z.string().optional().nullable(),
  voltage: z.string().optional().nullable(),
  packCount: z.number().int().positive().optional().nullable(),
});

export type Variant = z.infer<typeof variantSchema>;

export const identifiersSchema = z.object({
  gtin: z.string().optional().nullable(),
  ean: z.string().optional().nullable(),
  isbn: z.string().optional().nullable(),
  mpn: z.string().optional().nullable(),
  asin: z.string().optional().nullable(),
});

export type Identifiers = z.infer<typeof identifiersSchema>;

export const shippingSchema = z.object({
  amountCents: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().length(3).default("BRL"),
  estimatedDaysMin: z.number().int().positive().optional().nullable(),
  estimatedDaysMax: z.number().int().positive().optional().nullable(),
  isFree: z.boolean().optional().nullable(),
  confirmed: z.boolean().default(false),
});

export type Shipping = z.infer<typeof shippingSchema>;

export const taxSchema = z.object({
  amountCents: z.number().int().nonnegative().optional().nullable(),
  included: z.boolean().optional().nullable(),
  confirmed: z.boolean().default(false),
});

export type Tax = z.infer<typeof taxSchema>;

export const couponSchema = z.object({
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  discountAmountCents: z.number().int().nonnegative().optional().nullable(),
  minimumSpendCents: z.number().int().nonnegative().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  autoApplied: z.boolean().default(false),
});

export type Coupon = z.infer<typeof couponSchema>;

export const availabilityDetailSchema = z.object({
  inStock: z.boolean(),
  quantity: z.number().int().nonnegative().optional().nullable(),
});

export type AvailabilityDetail = z.infer<typeof availabilityDetailSchema>;

export const sellerSchema = z.object({
  name: z.string(),
  id: z.string().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  officialStore: z.boolean().default(false),
});

export type SellerInfo = z.infer<typeof sellerSchema>;

export const validitySchema = z.object({
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  fetchedAt: z.string().datetime(),
  lastVerifiedAt: z.string().datetime(),
});

export type Validity = z.infer<typeof validitySchema>;

export const trackingSchema = z.object({
  campaign: z.string().default("telegram_freguesia"),
  clickReference: z.string().optional().nullable(),
  attributionVerified: z.boolean().default(false),
});

export type Tracking = z.infer<typeof trackingSchema>;

export const normalizedOfferSchema = z.object({
  schemaVersion: z.string().default("1.0"),
  source: z.string(),
  sourceOfferId: z.string(),
  sourceProductId: z.string(),
  merchantId: z.string(),
  merchantName: z.string(),
  title: z.string(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  variant: variantSchema.optional().nullable(),
  identifiers: identifiersSchema,
  categoryPath: z.array(z.string()),
  condition: z.enum(CONDITION).default("new"),
  price: z.object({
    currentCents: z.number().int().positive(),
    originalCents: z.number().int().positive().optional().nullable(),
    currency: z.string().length(3).default("BRL"),
    discountPercent: z.number().min(0).max(100).optional().nullable(),
    installments: z.number().int().positive().optional().nullable(),
    installmentValueCents: z.number().int().positive().nullable(),
  }),
  shipping: shippingSchema,
  tax: taxSchema,
  coupon: couponSchema,
  availability: availabilityDetailSchema,
  urls: z.object({
    canonical: z.string().url(),
    affiliate: z.string().url(),
    image: z.string().url().optional().nullable(),
    additionalImages: z.array(z.string().url()).default([]),
  }),
  seller: sellerSchema,
  validity: validitySchema,
  tracking: trackingSchema,
  rawHash: z.string(),
  matchConfidence: z.number().min(0).max(1).optional().nullable(),
});

export type NormalizedOffer = z.infer<typeof normalizedOfferSchema>;

export const matchConfidenceSchema = z.object({
  score: z.number().min(0).max(1),
  method: z.enum([
    "gtin",
    "brand_mpn",
    "asin",
    "title_similarity",
    "image_similarity",
    "manual",
  ]),
  evidence: z.record(z.unknown()).default({}),
  status: z.enum(["matched", "review", "different"]).default("review"),
  reviewedBy: z.string().optional().nullable(),
  reviewedAt: z.string().datetime().optional().nullable(),
});

export type MatchConfidence = z.infer<typeof matchConfidenceSchema>;
