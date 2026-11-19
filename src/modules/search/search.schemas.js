import { z } from "zod";

export const searchSchema = z
  .object({
    query: z
      .object({
        q: z.string().trim().min(2).max(100),
        limit: z.coerce.number().int().min(1).max(20).optional()
      })
      .strict()
  })
  .passthrough();
