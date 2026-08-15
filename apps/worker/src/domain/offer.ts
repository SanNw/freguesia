import { z } from "zod";

export const SOURCE_TYPES = [
  "api",
  "feed",
  "rss",
  "page",
  "portal",
  "manual",
  "webhook",
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
  proposedCaption: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  idempotencyKey: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Offer = z.infer<typeof offerSchema>;
