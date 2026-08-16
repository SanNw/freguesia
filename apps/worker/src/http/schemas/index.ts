import { z } from "zod";

export const createManualOfferSchema = z.object({
  title: z.string().min(3).max(300),
  canonicalUrl: z.string().url(),
  currentPriceCents: z.number().int().positive(),
  previousPriceCents: z.number().int().positive().optional().nullable(),
  currency: z.string().length(3).optional(),
  imageUrl: z.string().url().optional().nullable(),
  affiliateUrl: z.string().url().optional().nullable(),
  store: z.string().optional(),
  category: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  availability: z
    .enum(["in_stock", "out_of_stock", "preorder", "unknown"])
    .optional(),
});

export const listOffersQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createDiscoveryRunSchema = z.object({
  sourceSlug: z.string().min(1),
  query: z.string().optional(),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  correlationId: z.string().uuid().optional(),
});

export const revalidateSchema = z.object({
  correlationId: z.string().uuid().optional(),
});

export const approveSchema = z.object({
  actorTelegramUserId: z.number().int().positive(),
  actorUsername: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  idempotencyKey: z.string().min(1),
  editedFields: z.record(z.unknown()).optional(),
});

export const publishSchema = z.object({
  idempotencyKey: z.string().min(1),
  correlationId: z.string().uuid().optional(),
});

export const telegramCallbackSchema = z.object({
  update_id: z.number().int(),
  callback_query: z.object({
    id: z.string(),
    from: z.object({
      id: z.number().int(),
      username: z.string().optional().nullable(),
    }),
    data: z.string().min(1),
    message: z.object({
      message_id: z.number().int(),
      chat: z.object({
        id: z.number().int(),
      }),
    }),
  }),
});
