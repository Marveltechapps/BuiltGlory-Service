import mongoose from "mongoose";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

const { ObjectId } = mongoose.Schema.Types;

/** Cap on embedded row errors; the full report belongs in object storage (errorReportKey). */
export const MAX_EMBEDDED_IMPORT_ERRORS = 1000;

const importJobSchema = new mongoose.Schema(
  {
    referenceId: { type: String, required: true, unique: true, index: true },
    fileName: { type: String, required: true },
    /** Excel sheet name that was imported. */
    sheetName: String,
    status: { type: String, enum: ["validated", "rejected", "processing", "completed", "failed", "reverted"], default: "validated", index: true },
    rowsTotal: { type: Number, default: 0 },
    rowsAccepted: { type: Number, default: 0 },
    rowsRejected: { type: Number, default: 0 },
    // Capped at MAX_EMBEDDED_IMPORT_ERRORS by the pre-validate hook (a 50k-row sheet could otherwise exceed the
    // 16 MB document limit). `errorsTruncated` tells readers that errorReportKey holds the complete list.
    errors: [{ row: Number, field: String, message: String }],
    errorsTruncated: { type: Boolean, default: false },
    /** Object-storage key of the full error report. */
    errorReportKey: String,
    // Not capped yet: "revert import" still depends on this list. Once properties.importJobId is written by the
    // import service, the architecture cap (5000) can be applied and revert switched to an importJobId query.
    importedProperties: [{ type: ObjectId, ref: "Property" }],
    requestedBy: { type: ObjectId, ref: "Admin" },
    startedAt: Date,
    revertedBy: { type: ObjectId, ref: "Admin" },
    revertedAt: Date,
    completedAt: Date
  },
  {
    timestamps: true,
    collection: "propertyImportJobs",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    suppressReservedKeysWarning: true
  }
);

importJobSchema.index({ requestedBy: 1, createdAt: -1 });
importJobSchema.index({ status: 1, createdAt: -1 }); // [N]

importJobSchema.pre("validate", function capEmbeddedErrors() {
  if (Array.isArray(this.errors) && this.errors.length > MAX_EMBEDDED_IMPORT_ERRORS) {
    this.errors = this.errors.slice(0, MAX_EMBEDDED_IMPORT_ERRORS);
    this.errorsTruncated = true;
  }
});

applySchemaDefaults(importJobSchema);

export const PropertyImportJob =
  mongoose.models.PropertyImportJob || mongoose.model("PropertyImportJob", importJobSchema);
