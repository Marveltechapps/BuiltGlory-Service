import mongoose from "mongoose";
import {
  PROPERTY_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_SOURCES,
  NEARBY_PLACE_TYPES,
  VERIFICATION_CHECK_STATUSES
} from "../../constants/enums.js";
import {
  applySchemaDefaults,
  arrayMax,
  normalizeKey,
  optionalGeoPointSchema
} from "../../database/schemaCommon.js";

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const collectionName = "properties";

/** Canonical amenity key: lowercase, single-spaced words joined with "_" (e.g. "Swimming Pool" -> "swimming_pool"). */
export const toAmenityKey = (label) => {
  const normalized = normalizeKey(label);
  return normalized ? normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") : undefined;
};

/** Existing data uses free-text place types; anything outside the enum is stored as "other" instead of failing. */
const coerceNearbyPlaceType = (value) => {
  if (value == null || value === "") return value;
  const key = normalizeKey(value)?.replace(/\s+/g, "_");
  return NEARBY_PLACE_TYPES.includes(key) ? key : "other";
};

const verificationCheck = () => ({
  status: { type: String, enum: VERIFICATION_CHECK_STATUSES, default: "pending" },
  checkedAt: Date,
  checkedBy: { type: ObjectId, ref: "Admin" },
  notes: String
});

const priceHistorySchema = new mongoose.Schema({
  price: { type: Number, min: 0, required: true },
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: ObjectId, ref: "Admin" }
}, { _id: false });

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  /** Shareable URL segment (/properties/<slug>). Unique via partial index (see configureSchema). */
  slug: { type: String, lowercase: true, trim: true },
  description: { type: String, maxlength: 10000 },
  type: { type: String, enum: PROPERTY_TYPES, required: true },
  status: { type: String, enum: PROPERTY_STATUSES, default: "draft", index: true },
  source: { type: String, enum: PROPERTY_SOURCES, default: "manual" },
  /** Mutually exclusive with isUpcoming (enforced in pre-validate). */
  isFeatured: { type: Boolean, default: false },
  isUpcoming: { type: Boolean, default: false },
  isVisibleOnApp: { type: Boolean, default: true },
  featuredOrder: { type: Number, min: 0 },
  upcomingOrder: { type: Number, min: 0 },

  address: {
    line1: String,
    line2: String,
    landmark: String,
    locality: String,
    /** Normalised equality key (lowercase, trimmed, single-spaced). Derived from locality. */
    localityKey: String,
    city: String,
    /** Derived from city. */
    cityKey: String,
    state: String,
    pincode: String,
    /** GeoJSON [lng, lat]; source of latitude/longitude. */
    location: { ...optionalGeoPointSchema },
    /** @deprecated derived from location. */
    latitude: Number,
    /** @deprecated derived from location. */
    longitude: Number,
    locationId: { type: ObjectId, ref: "Location" }
  },

  price: { type: Number, min: 0, required: true },
  priceHistory: { type: [priceHistorySchema], validate: arrayMax(50) },
  isNegotiable: { type: Boolean, default: false },

  // specs stays Mixed: existing data holds mixed shapes (bhk as "3" and 3, per-type extras). The typed
  // PropertySpecs (+ extra Map) migration is a data-migration task; parallel typed paths (amenityKeys, ...) are
  // added below so filters can move off the free-form blob.
  specs: { type: Mixed, default: {} },

  amenities: [String],
  /** Canonical keys for exact-match `$all` filtering; derived from `amenities` when not supplied. */
  amenityKeys: [String],
  highlights: [String],
  media: {
    photos: { type: [String], validate: arrayMax(30) },
    photoDocumentIds: [{ type: ObjectId, ref: "Document" }],
    coverPhoto: String,
    videoUrl: String,
    droneImageUrl: String,
    droneVideoUrl: String,
    tour3dUrl: String,
    floorPlanUrl: String
  },
  advantages: {
    investment: { type: [String], validate: arrayMax(20) },
    location: { type: [String], validate: arrayMax(20) },
    connectivity: { type: [String], validate: arrayMax(20) }
  },
  nearbyPlaces: {
    type: [{
      name: String,
      type: { type: String, enum: NEARBY_PLACE_TYPES, set: coerceNearbyPlaceType },
      /** Display string ("1.2 km"). */
      distance: String,
      /** Numeric distance for sorting. */
      distanceKm: { type: Number, min: 0 }
    }],
    validate: arrayMax(30)
  },

  /** Real "legally verified" badge (previously faked as status=available). */
  verification: {
    isVerified: { type: Boolean, default: false },
    title: verificationCheck(),
    legal: verificationCheck(),
    site: verificationCheck(),
    verifiedAt: Date,
    verifiedBy: { type: ObjectId, ref: "Admin" }
  },
  rating: {
    average: { type: Number, min: 0, max: 5 },
    count: { type: Number, default: 0, min: 0 }
  },

  metrics: {
    savedCount: { type: Number, default: 0, min: 0 },
    views: { type: Number, default: 0, min: 0 },
    enquiries: { type: Number, default: 0, min: 0 },
    visits: { type: Number, default: 0, min: 0 },
    compareCount: { type: Number, default: 0, min: 0 },
    shareCount: { type: Number, default: 0, min: 0 }
  },

  /** @deprecated moves to the `favorites` collection. Kept readable during migration. */
  savedByUsers: [{ type: ObjectId, ref: "User" }],
  assignedTo: { type: ObjectId, ref: "Admin" },
  /** Set when source = acquired. */
  sellerId: { type: ObjectId, ref: "User" },
  acquisitionId: { type: ObjectId, ref: "Acquisition" },
  sellRequestId: { type: ObjectId, ref: "SellRequest" },
  sourceSheet: String,
  importJobId: { type: ObjectId, ref: "PropertyImportJob" },
  /** Deal that currently holds the reservation (set atomically on token verify). */
  reservedByDealId: { type: ObjectId, ref: "SalesDeal" },

  launchDate: Date,
  possessionDate: Date,
  soldAt: Date,
  soldPrice: { type: Number, min: 0 },
  publishedAt: Date,
  publishedBy: { type: ObjectId, ref: "Admin" },
  createdBy: { type: ObjectId, ref: "Admin" },
  updatedBy: { type: ObjectId, ref: "Admin" },

  /** Written by the boost-order job; the Buy list sorts on it. */
  boost: {
    active: { type: Boolean, default: false },
    planId: String,
    expiresAt: Date
  }
  // isDeleted / deletedAt / deletedBy / deletedByType come from softDeletePlugin (applied in properties.model.js).
};

export const configureSchema = (schema) => {
  schema.index({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: "string" } } }); // share links
  schema.index({ status: 1, type: 1, "address.cityKey": 1 }); // Buy list by type and city
  schema.index({ status: 1, "address.cityKey": 1, "address.localityKey": 1, price: 1 }); // city/locality + budget
  schema.index({ status: 1, type: 1, price: 1 }); // type + budget, price sort
  schema.index({ status: 1, "specs.bhk": 1, price: 1 }); // bedroom pills
  schema.index({ isFeatured: 1, status: 1, featuredOrder: 1 }); // Home -> Featured
  schema.index({ isUpcoming: 1, upcomingOrder: 1, launchDate: 1 }); // Home -> Upcoming
  schema.index({ status: 1, soldAt: -1 }, { partialFilterExpression: { status: "sold" } }); // Recently sold
  schema.index({ "address.location": "2dsphere" }, { sparse: true }); // map view, zone search
  schema.index(
    { title: "text", description: "text", "address.locality": "text", "address.city": "text", referenceId: "text" },
    { weights: { title: 10, referenceId: 10, "address.locality": 5, "address.city": 5, description: 1 } }
  );
  schema.index({ assignedTo: 1, status: 1 }); // dashboard "my properties"
  schema.index({ acquisitionId: 1 }, { sparse: true }); // seller tracker
  schema.index({ importJobId: 1 }, { sparse: true }); // import revert
  schema.index({ isDeleted: 1, deletedAt: -1 }, { partialFilterExpression: { isDeleted: true } }); // deleted bin
  schema.index({ amenityKeys: 1 }); // amenity filter with $all

  schema.pre("validate", function validateAndDerive() {
    if (this.isUpcoming && !this.launchDate) throw new Error("Upcoming properties require launchDate.");
    if (this.isFeatured && this.isUpcoming) {
      this.invalidate("isUpcoming", "A property cannot be both featured and upcoming.", this.isUpcoming);
    }
    // Auto-fill only (never rejects): stamp soldAt when a property is marked sold without one.
    if (this.status === "sold" && !this.soldAt) this.soldAt = new Date();
    if (this.isModified("address.city") || (this.address?.city && !this.address.cityKey)) {
      this.set("address.cityKey", normalizeKey(this.address?.city));
    }
    if (this.isModified("address.locality") || (this.address?.locality && !this.address.localityKey)) {
      this.set("address.localityKey", normalizeKey(this.address?.locality));
    }
    if (this.isModified("amenities") && !this.isModified("amenityKeys")) {
      this.amenityKeys = [...new Set((this.amenities || []).map(toAmenityKey).filter(Boolean))];
    }
    const coordinates = this.address?.location?.coordinates;
    if (coordinates?.length === 2 && !this.isModified("address.latitude") && !this.isModified("address.longitude")) {
      this.set("address.longitude", coordinates[0]);
      this.set("address.latitude", coordinates[1]);
    }
  });

  // Keep the normalised keys in step when address pieces are updated through findOneAndUpdate/updateOne.
  const syncAddressKeysOnUpdate = function syncAddressKeysOnUpdate() {
    const update = this.getUpdate?.();
    if (!update || Array.isArray(update)) return;
    const $set = { ...(update.$set || {}) };
    let changed = false;
    const wholeAddress = $set.address && typeof $set.address === "object" && !Array.isArray($set.address);
    if (wholeAddress) {
      // `$set.address` replaces the object, so the keys must live inside it (a dotted sibling would conflict).
      const address = { ...$set.address };
      if (address.city !== undefined && address.cityKey === undefined) { address.cityKey = normalizeKey(address.city); changed = true; }
      if (address.locality !== undefined && address.localityKey === undefined) { address.localityKey = normalizeKey(address.locality); changed = true; }
      $set.address = address;
    } else {
      if ("address.city" in $set && !("address.cityKey" in $set)) {
        $set["address.cityKey"] = normalizeKey($set["address.city"]);
        changed = true;
      }
      if ("address.locality" in $set && !("address.localityKey" in $set)) {
        $set["address.localityKey"] = normalizeKey($set["address.locality"]);
        changed = true;
      }
    }
    if (Array.isArray($set.amenities) && !("amenityKeys" in $set)) {
      $set.amenityKeys = [...new Set($set.amenities.map(toAmenityKey).filter(Boolean))];
      changed = true;
    }
    if (changed) update.$set = $set;
  };
  schema.pre("findOneAndUpdate", syncAddressKeysOnUpdate);
  schema.pre("updateOne", syncAddressKeysOnUpdate);
  schema.pre("updateMany", syncAddressKeysOnUpdate);

  applySchemaDefaults(schema);
};
