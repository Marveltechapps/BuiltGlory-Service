import mongoose from "mongoose";
import { CONTENT_SECTIONS, CONTENT_STATUSES, CONTENT_KINDS } from "../../constants/enums.js";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

export const collectionName = "contentItems";

// Re-exported so existing imports from this module keep working; the single source is constants/enums.js.
export { CONTENT_SECTIONS, CONTENT_STATUSES, CONTENT_KINDS };

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  // Stays globally unique for now. When multi-locale content ships (API phase) this becomes unique on
  // { slug, locale } together with the content lookup change; switching earlier would weaken the conflict check.
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  /** article = editorial content, config = configuration record read by the apps. */
  kind: { type: String, enum: CONTENT_KINDS, default: "article" },
  /** Content language; uses the same codes as users.preferences.language (en, ta, hi, kn). Default en. */
  locale: { type: String, default: "en", lowercase: true, trim: true },
  section: { type: String, enum: CONTENT_SECTIONS, required: true, index: true },
  title: { type: String, required: true, trim: true },
  excerpt: { type: String, trim: true },
  body: { type: String, default: "" },
  category: { type: String, trim: true, index: true },
  status: { type: String, enum: CONTENT_STATUSES, default: "published", index: true },
  imageUrl: String,
  cta: {
    label: String,
    target: String
  },
  tags: [String],
  order: { type: Number, default: 0 },
  // Opaque today; per-slug JSON Schema validation (content.schemas.js) is planned for the API phase.
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  /** Banner scheduling (previously metadata.banners[].startDate / expiryDate). */
  startsAt: Date,
  endsAt: Date,
  /** Optimistic concurrency token. */
  version: { type: Number, default: 1, min: 1 },
  publishedAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }
};

export const configureSchema = (schema) => {
  schema.index({ section: 1, status: 1, order: 1 });
  schema.index({ title: "text", body: "text", excerpt: "text", category: "text", tags: "text" });
  schema.pre("validate", function setPublishedAt() {
    if (this.status === "published" && !this.publishedAt) this.publishedAt = new Date();
  });

  applySchemaDefaults(schema);
};
