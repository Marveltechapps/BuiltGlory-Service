import mongoose from "mongoose";
import { applySchemaDefaults, arrayMax } from "../../database/schemaCommon.js";

const { ObjectId, Mixed } = mongoose.Schema.Types;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const schema = new mongoose.Schema(
  {
    referenceId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    status: { type: String, enum: ["active", "paused"], default: "active", index: true },
    reportType: { type: String, enum: ["overview", "sales", "acquisition", "revenue", "users", "properties"], required: true },
    format: { type: String, enum: ["csv", "xlsx", "pdf"], default: "xlsx" },
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
    timezone: { type: String, default: "Asia/Kolkata" },
    filters: { type: Mixed, default: {} },
    recipients: {
      type: [{ type: String, required: true, trim: true, match: EMAIL_PATTERN }],
      validate: arrayMax(20)
    },
    createdBy: { type: ObjectId, ref: "Admin", index: true },
    lastRunAt: Date,
    /** Most recent export produced by this schedule. */
    lastExportId: { type: ObjectId, ref: "ReportExport" },
    lastStatus: { type: String, enum: ["success", "failed", null] },
    /** Consecutive failures; the runner pauses the schedule after 5. */
    failureCount: { type: Number, default: 0, min: 0 },
    nextRunAt: { type: Date, required: true, index: true }
  },
  {
    timestamps: true,
    collection: "reportSchedules",
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

schema.index({ status: 1, nextRunAt: 1 });

applySchemaDefaults(schema);

export const ReportSchedule = mongoose.models.ReportSchedule || mongoose.model("ReportSchedule", schema);
