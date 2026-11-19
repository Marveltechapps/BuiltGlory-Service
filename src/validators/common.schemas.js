import { z } from "zod";

/** Mongo ObjectId (24 hex). */
export const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Must be a valid ObjectId");

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional()
});

export const phone10Schema = z
  .string()
  .regex(/^\d{10}$/, "Phone must be exactly 10 digits");

export const otp6Schema = z
  .string()
  .regex(/^\d{6}$/, "OTP must be exactly 6 digits");

export const countryCodeSchema = z
  .string()
  .regex(/^\+\d{1,4}$/)
  .default("+91");

export const emptyBodySchema = z.object({}).strict();
