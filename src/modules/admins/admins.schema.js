import mongoose from "mongoose";
import { ADMIN_ROLES, ADMIN_STATUSES } from "../../constants/enums.js";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

const { ObjectId } = mongoose.Schema.Types;

export const collectionName = "admins";

export const schemaDefinition = {
  // Not `required`: legacy admins created before this field existed have none. Uniqueness is a partial index
  // (see configureSchema) so those documents do not collide on a missing value.
  referenceId: { type: String, trim: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  passwordUpdatedAt: Date,
  /** Invite flow issues a temporary password; the first login must change it. */
  mustChangePassword: { type: Boolean, default: false },
  role: { type: String, enum: ADMIN_ROLES, required: true },
  permissions: [{ type: String, required: true }],

  /**
   * Lifecycle status. `isActive` is kept as the derived/compat flag (status === "active").
   * Default follows `isActive` so legacy documents without `status` read as active/suspended correctly.
   */
  status: {
    type: String,
    enum: ADMIN_STATUSES,
    default: function defaultStatus() { return this.isActive === false ? "suspended" : "active"; }
  },
  isActive: { type: Boolean, default: true },
  invitedAt: Date,
  invitedBy: { type: ObjectId, ref: "Admin" },
  suspendedAt: Date,
  suspendedBy: { type: ObjectId, ref: "Admin" },
  suspendedReason: { type: String, maxlength: 500 },

  phone: String,
  photoUrl: String,
  department: String,
  assignedArea: [String],
  specialization: [String],
  activeWorkload: { type: Number, default: 0, min: 0 },
  isAvailable: { type: Boolean, default: true },

  /** Advisor info shown to customers (property / visit / seller tracker). */
  publicProfile: {
    rating: { type: Number, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 }
  },

  lastLoginAt: Date,
  /** Lock after 10 consecutive failures. */
  failedLoginCount: { type: Number, default: 0, min: 0 },
  lockedUntil: Date
};

const deriveStatusFromActive = (isActive) => (isActive ? "active" : "suspended");

export const configureSchema = (schema) => {
  schema.index({ email: 1 }, { unique: true });
  schema.index({ referenceId: 1 }, { unique: true, partialFilterExpression: { referenceId: { $type: "string" } } });
  schema.index({ role: 1, status: 1, isAvailable: 1 });
  // Legacy index kept while assignment pickers still filter on isActive.
  schema.index({ role: 1, isActive: 1, isAvailable: 1 });
  schema.index({ name: "text", email: "text" });

  // Keep `status` and `isActive` consistent on document saves.
  schema.pre("validate", function syncStatusAndActive() {
    const statusChanged = this.isModified("status");
    const activeChanged = this.isModified("isActive");
    if (statusChanged && !activeChanged) {
      this.isActive = this.status === "active";
    } else if (activeChanged && !statusChanged) {
      // `invited` is only left by an explicit status change; never overwrite it when still inactive.
      if (this.isActive) this.status = "active";
      else if (this.status === "active") this.status = "suspended";
    }
  });

  // Same invariant for update queries that only touch isActive (existing controllers do this).
  const syncUpdateStatus = function syncUpdateStatus() {
    const update = this.getUpdate?.();
    if (!update || Array.isArray(update)) return;
    const $set = update.$set || {};
    const hasStatus = "status" in $set || "status" in update;
    const hasActive = "isActive" in $set || "isActive" in update;
    if (hasActive && !hasStatus) {
      const isActive = Boolean("isActive" in $set ? $set.isActive : update.isActive);
      update.$set = { ...$set, status: deriveStatusFromActive(isActive) };
    } else if (hasStatus && !hasActive) {
      const status = "status" in $set ? $set.status : update.status;
      if (ADMIN_STATUSES.includes(status)) update.$set = { ...$set, isActive: status === "active" };
    }
  };
  schema.pre("findOneAndUpdate", syncUpdateStatus);
  schema.pre("updateOne", syncUpdateStatus);
  schema.pre("updateMany", syncUpdateStatus);

  applySchemaDefaults(schema);
};
