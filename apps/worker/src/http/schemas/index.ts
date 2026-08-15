import { z } from "zod";

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
