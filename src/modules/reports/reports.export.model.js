import mongoose from "mongoose";
import { REPORT_EXPORT_STATUSES } from "../../constants/enums.js";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

const { ObjectId, Mixed } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    referenceId: { type: String, required: true, unique: true, index: true },
    // PENDING PRODUCT DECISION: both `completed` (backend writes) and `ready` (dashboard reads) stay valid.
    status: { type: String, enum: REPORT_EXPORT_STATUSES, default: "queued", index: true },
    format: { type: String, enum: ["csv", "xlsx", "pdf"], default: "xlsx" },
    exportTypes: [{ type: String }],
    storageKey: { type: String, required: true },
    filters: { type: Mixed, default: {} },
    requestedBy: { type: ObjectId, ref: "Admin", index: true },
    requestedAt: { type: Date, default: Date.now },
    completedAt: Date,
    failedAt: Date,
    failureReason: String,
    fileName: String,
    mimeType: String,
    sizeBytes: { type: Number, default: 0 },
    rowCount: { type: Number, default: 0 },
    /**
     * @deprecated stored inside the document today; target is S3 under `storageKey` + pre-signed URL.
     * select:false keeps the blob out of list/get queries; legacy readers must use `.select("+fileContent")`.
     * PENDING S3 MIGRATION: remove this field once all exports are served from object storage.
     */
    fileContent: { type: Buffer, select: false },
    /**
     * @deprecated replaced by downloadTokenHash. Still written/read by the current download flow (API compat), so it
     * is KEPT for now. PENDING S3 MIGRATION: drop it once the API verifies tokens against downloadTokenHash only.
     */
    downloadToken: { type: String, index: true },
    /** sha256 of the download token (the token itself should not be stored). Not populated by the API yet. */
    downloadTokenHash: { type: String, select: false, index: true },
    downloadTokenExpiresAt: Date,
    /** Promoted from filters. */
    deliveryEmail: { type: String, lowercase: true, trim: true },
    /** Set when the export was produced by a schedule. */
    scheduleId: { type: ObjectId, ref: "ReportSchedule" },
    // Plain index for now. The architecture target is a TTL index (expireAfterSeconds: 0) together with an S3
    // lifecycle rule; it is deferred until file content moves out of MongoDB so expiry does not race the download flow.
    expiresAt: { type: Date, required: true, index: true }
  },
  {
    timestamps: true,
    collection: "reportExports",
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.fileContent;
        delete ret.downloadToken;
        delete ret.downloadTokenHash;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.fileContent;
        delete ret.downloadToken;
        delete ret.downloadTokenHash;
        return ret;
      }
    }
  }
);

schema.index({ requestedAt: -1 });

applySchemaDefaults(schema);

export const ReportExport = mongoose.models.ReportExport || mongoose.model("ReportExport", schema);
