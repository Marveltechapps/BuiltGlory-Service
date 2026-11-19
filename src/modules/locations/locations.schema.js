import mongoose from "mongoose";
import { LOCATION_KINDS } from "../../constants/enums.js";
import { applySchemaDefaults, geoPointSchema } from "../../database/schemaCommon.js";

/** locations (DATABASE_ARCHITECTURE.md §6.6). referenceId prefix: BG-LOC (makeReferenceId("locations")). */
export const collectionName = "locations";

const MAX_BOUNDARY_VERTICES = 500;
const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isLngLat = (position) =>
  Array.isArray(position) && position.length === 2
  && position[0] >= -180 && position[0] <= 180
  && position[1] >= -90 && position[1] <= 90;

const validPolygon = (rings) => {
  if (rings == null || rings.length === 0) return true;
  let vertices = 0;
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) return false;
    if (!ring.every(isLngLat)) return false;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) return false;
    vertices += ring.length;
  }
  return vertices <= MAX_BOUNDARY_VERTICES;
};

const needsParent = function needsParent() {
  return this.kind === "locality" || this.kind === "zone";
};

// Optional geo fields must not default to an empty GeoJSON object, or the sparse 2dsphere index rejects the insert.
const optionalPoint = {
  type: { ...geoPointSchema.type, default: undefined },
  coordinates: { ...geoPointSchema.coordinates, default: undefined }
};

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  kind: { type: String, enum: LOCATION_KINDS, required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  key: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    maxlength: 120,
    match: [KEY_PATTERN, "key must be a lowercase slug"]
  },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: needsParent },
  cityKey: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
  state: {
    type: String,
    trim: true,
    maxlength: 100,
    required() { return this.kind === "city"; }
  },
  center: optionalPoint,
  boundary: {
    type: { type: String, enum: ["Polygon"], default: undefined },
    coordinates: {
      type: [[[Number]]],
      default: undefined,
      validate: {
        validator: validPolygon,
        message: `boundary must be a closed GeoJSON polygon of [lng, lat] positions with at most ${MAX_BOUNDARY_VERTICES} vertices`
      },
      required() { return this.kind === "zone"; }
    }
  },
  active: { type: Boolean, required: true, default: true },
  order: { type: Number },
  propertyCount: { type: Number, default: 0, min: 0 }
};

export const configureSchema = (schema) => {
  applySchemaDefaults(schema);
  schema.index({ kind: 1, cityKey: 1, key: 1 }, { unique: true });
  schema.index({ parentId: 1, active: 1, order: 1 });
  schema.index({ boundary: "2dsphere" }, { sparse: true });
  schema.index({ center: "2dsphere" }, { sparse: true });
};
