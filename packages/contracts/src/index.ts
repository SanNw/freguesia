import { z } from "zod";

export const createDiscoveryRunRequest = z.object({
  sourceSlug: z.string().min(1),
  query: z.string().optional(),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  correlationId: z.string().uuid().optional(),
});

export const createDiscoveryRunResponse = z.object({
  runId: z.string().uuid(),
  status: z.literal("accepted"),
});

export const errorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    correlationId: z.string().optional(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type CreateDiscoveryRunRequest = z.infer<typeof createDiscoveryRunRequest>;
export type CreateDiscoveryRunResponse = z.infer<typeof createDiscoveryRunResponse>;
