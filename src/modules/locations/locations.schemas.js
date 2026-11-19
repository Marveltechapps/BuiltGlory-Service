import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/);
const geoPoint = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
}).strict();

const geoPolygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()])).min(4)).min(1)
}).strict();

export const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    kind: z.enum(["city", "locality", "zone"]).optional(),
    cityKey: z.string().max(120).optional(),
    active: z.preprocess((v) => {
      if (v === "true" || v === true) return true;
      if (v === "false" || v === false) return false;
      return v;
    }, z.boolean().optional()),
    search: z.string().max(100).optional(),
    sort: z.enum(["newest", "oldest"]).optional()
  }).strict().optional()
}).passthrough();

export const idParam = z.object({
  params: z.object({
    locationId: objectId
  }).passthrough()
}).passthrough();

export const createSchema = z.object({
  body: z.object({
    kind: z.enum(["city", "locality", "zone"]),
    name: z.string().trim().min(1).max(100),
    key: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    cityKey: z.string().trim().min(1).max(120),
    state: z.string().trim().max(100).optional(),
    parentId: objectId.optional(),
    center: geoPoint.optional(),
    boundary: geoPolygon.optional(),
    active: z.boolean().optional(),
    order: z.number().optional()
  }).strict()
}).passthrough().superRefine((data, ctx) => {
  const body = data.body || {};
  if (body.kind === "city" && !body.state) {
    ctx.addIssue({ code: "custom", path: ["body", "state"], message: "state is required for city" });
  }
  if ((body.kind === "locality" || body.kind === "zone") && !body.parentId) {
    ctx.addIssue({ code: "custom", path: ["body", "parentId"], message: "parentId is required for locality/zone" });
  }
  if (body.kind === "zone" && !body.boundary) {
    ctx.addIssue({ code: "custom", path: ["body", "boundary"], message: "boundary is required for zone" });
  }
});

export const updateSchema = z.object({
  params: z.object({ locationId: objectId }).passthrough(),
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    key: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    cityKey: z.string().trim().min(1).max(120).optional(),
    state: z.string().trim().max(100).optional(),
    parentId: objectId.nullable().optional(),
    center: geoPoint.nullable().optional(),
    boundary: geoPolygon.nullable().optional(),
    active: z.boolean().optional(),
    order: z.number().optional()
  }).strict().refine((b) => Object.keys(b).length > 0, { message: "At least one field is required" })
}).passthrough();
