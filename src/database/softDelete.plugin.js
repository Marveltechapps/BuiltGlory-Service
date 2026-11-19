import mongoose from "mongoose";
import { DELETED_BY_TYPES } from "./schemaCommon.js";

export const softDeletePlugin = (schema) => {
  schema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    deletedByType: { type: String, enum: [...DELETED_BY_TYPES, null], default: null }
  });
  schema.query.notDeleted = function notDeleted() {
    return this.where({ isDeleted: { $ne: true } });
  };
};
