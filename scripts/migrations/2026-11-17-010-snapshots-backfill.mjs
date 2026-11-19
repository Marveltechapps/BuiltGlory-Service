/**
 * M-11: Backfill denormalised user / property snapshots on child collections.
 *
 *   visits         buyerId -> buyerSnapshot, propertyId -> propertySnapshot
 *   callbacks      userId  -> userSnapshot,  propertyId -> propertySnapshot (title only)
 *   interiorLeads  buyerId -> buyerSnapshot, propertyId -> propertySnapshot
 *   chatThreads    buyerId -> buyerSnapshot, propertyId -> propertySnapshot
 *   supportTickets userId  -> userSnapshot
 *   appFeedback    userId  -> userSnapshot (name only)
 *
 * Idempotent: only documents whose snapshot is missing / null / empty are written, and the write re-checks that
 * condition. Parents are loaded with lean + projection, in batches of 500. If the parent no longer exists the
 * document is skipped (never a fake snapshot).
 */
const BATCH = 500;

const emptySnapshot = (field) => ({
  $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: {} }]
});

const clean = (obj) => {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== "") out[key] = value;
  }
  return out;
};

const USER_PROJECTION = { name: 1, phone: 1, mobileNumber: 1, email: 1, userType: 1, kycStatus: 1 };
const PROPERTY_PROJECTION = { title: 1, type: 1, price: 1, "address.locality": 1, "address.city": 1, "media.coverPhoto": 1, "media.photos": 1 };

const userSnapshot = (user, { nameOnly = false } = {}) => {
  if (nameOnly) return clean({ name: user.name });
  return clean({
    name: user.name,
    phone: user.phone || user.mobileNumber,
    email: user.email,
    userType: user.userType,
    kycStatus: user.kycStatus
  });
};

const propertySnapshot = (property, { titleOnly = false } = {}) => {
  if (titleOnly) return clean({ title: property.title });
  const coverPhoto = property.media?.coverPhoto || property.media?.photos?.[0];
  return clean({
    title: property.title,
    type: property.type,
    price: property.price,
    location: property.address?.locality,
    city: property.address?.city,
    coverPhoto
  });
};

const TARGETS = [
  { collection: "visits", links: [
    { idField: "buyerId", snapField: "buyerSnapshot", parent: "users" },
    { idField: "propertyId", snapField: "propertySnapshot", parent: "properties" }
  ] },
  { collection: "callbacks", links: [
    { idField: "userId", snapField: "userSnapshot", parent: "users" },
    { idField: "propertyId", snapField: "propertySnapshot", parent: "properties", titleOnly: true }
  ] },
  { collection: "interiorLeads", links: [
    { idField: "buyerId", snapField: "buyerSnapshot", parent: "users" },
    { idField: "propertyId", snapField: "propertySnapshot", parent: "properties" }
  ] },
  { collection: "chatThreads", links: [
    { idField: "buyerId", snapField: "buyerSnapshot", parent: "users" },
    { idField: "propertyId", snapField: "propertySnapshot", parent: "properties" }
  ] },
  { collection: "supportTickets", links: [
    { idField: "userId", snapField: "userSnapshot", parent: "users" }
  ] },
  { collection: "appFeedback", links: [
    { idField: "userId", snapField: "userSnapshot", parent: "users", nameOnly: true }
  ] }
];

const backfillLink = async (db, collectionName, link) => {
  const stats = { scanned: 0, updated: 0, skippedNoParent: 0 };
  const col = db.collection(collectionName);
  const parentCol = db.collection(link.parent);
  const filter = { [link.idField]: { $type: "objectId" }, ...emptySnapshot(link.snapField) };
  let lastId = null;

  for (;;) {
    const query = lastId ? { $and: [filter, { _id: { $gt: lastId } }] } : filter;
    const docs = await col.find(query, { projection: { [link.idField]: 1 } }).sort({ _id: 1 }).limit(BATCH).toArray();
    if (!docs.length) break;
    lastId = docs[docs.length - 1]._id;
    stats.scanned += docs.length;

    const parentIds = [...new Map(docs.map((doc) => [String(doc[link.idField]), doc[link.idField]])).values()];
    const parents = await parentCol
      .find({ _id: { $in: parentIds } }, { projection: link.parent === "users" ? USER_PROJECTION : PROPERTY_PROJECTION })
      .toArray();
    const byId = new Map(parents.map((parent) => [String(parent._id), parent]));

    const ops = [];
    for (const doc of docs) {
      const parent = byId.get(String(doc[link.idField]));
      if (!parent) {
        stats.skippedNoParent += 1;
        continue;
      }
      const snapshot = link.parent === "users"
        ? userSnapshot(parent, link)
        : propertySnapshot(parent, link);
      if (!Object.keys(snapshot).length) continue;
      ops.push({
        updateOne: {
          filter: { _id: doc._id, ...emptySnapshot(link.snapField) },
          update: { $set: { [link.snapField]: snapshot } }
        }
      });
    }
    if (ops.length) {
      const res = await col.bulkWrite(ops, { ordered: false });
      stats.updated += res.modifiedCount;
    }
  }
  return stats;
};

export const up = async () => {
  const mongoose = (await import("mongoose")).default;
  const db = mongoose.connection.db;
  const summary = {};

  for (const target of TARGETS) {
    if (!(await db.listCollections({ name: target.collection }).hasNext())) {
      summary[target.collection] = { skipped: "collection missing" };
      continue;
    }
    summary[target.collection] = {};
    for (const link of target.links) {
      summary[target.collection][link.snapField] = await backfillLink(db, target.collection, link);
    }
  }
  return summary;
};
