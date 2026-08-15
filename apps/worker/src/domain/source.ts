import { z } from "zod";

export const sourceSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  store: z.string().min(1),
  type: z.enum([
    "api",
    "feed",
    "rss",
    "page",
    "portal",
    "manual",
    "webhook",
  ]),
  adapterVersion: z.string().min(1),
  enabled: z.boolean(),
  priority: z.number().int().default(100),
  config: z.record(z.unknown()).default({}),
  termsReviewedAt: z.string().datetime().optional().nullable(),
  termsReviewedBy: z.string().optional().nullable(),
  lastSuccessAt: z.string().datetime().optional().nullable(),
  lastFailureAt: z.string().datetime().optional().nullable(),
  lastErrorCode: z.string().optional().nullable(),
  circuitState: z.enum(["closed", "open", "half_open"]).default("closed"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Source = z.infer<typeof sourceSchema>;
export type SourceId = string;
