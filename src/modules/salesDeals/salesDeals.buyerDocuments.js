import { SalesDeal } from "./salesDeals.model.js";
import { Document } from "../documents/documents.model.js";
import { notFound } from "../error/error.model.js";

const clean = { isDeleted: { $ne: true } };

const asId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

const docName = (doc) =>
  doc?.title ||
  doc?.name ||
  doc?.label ||
  doc?.fileName ||
  doc?.documentType ||
  doc?.purpose ||
  "Document";

const normalizeDoc = (doc) => {
  const id = asId(doc?._id || doc?.documentId || doc?.id);
  if (!id) return null;
  return {
    _id: id,
    documentId: id,
    referenceId: doc.referenceId || null,
    name: docName(doc),
    meta: [doc.documentType, doc.purpose, doc.mimeType].filter(Boolean).join(" · ") || "Shared document",
    purpose: doc.purpose || null,
    documentType: doc.documentType || null,
    url: doc.url || null,
    status: doc.status || null,
    createdAt: doc.createdAt || null
  };
};

const extractFromDocumentation = (documentation) => {
  if (!documentation || typeof documentation !== "object") return [];
  const bags = [
    documentation.docs,
    documentation.documents,
    documentation.sharedDocuments,
    documentation.sharedDocs,
    documentation.items
  ];
  const rows = [];
  for (const bag of bags) {
    if (!Array.isArray(bag)) continue;
    for (const item of bag) {
      if (typeof item === "string") {
        rows.push({ _id: item, name: "Document", documentId: item });
      } else if (item && typeof item === "object") {
        rows.push(item);
      }
    }
  }
  return rows;
};

const registrationFrom = (documentation) => {
  if (!documentation || typeof documentation !== "object") return null;
  const reg = documentation.registration || documentation.registrationDetails || null;
  if (!reg || typeof reg !== "object") return null;
  return {
    appointment: reg.appointment || {
      date: reg.date || reg.appointmentDate || null,
      time: reg.time || reg.appointmentTime || null,
      office: reg.office || reg.venue || null,
      address: reg.address || reg.officeAddress || null
    },
    status: reg.status || null,
    checklist: Array.isArray(reg.checklist)
      ? reg.checklist
      : Array.isArray(documentation.docsRequired)
        ? documentation.docsRequired
        : Array.isArray(documentation.checklist)
          ? documentation.checklist
          : []
  };
};

/**
 * Buyer-facing shared documents for a sales deal.
 * Combines Document rows owned by the deal with any ids embedded in deal.documentation.
 */
export const listBuyerDealDocuments = async (actor, dealId) => {
  const deal = await SalesDeal.findOne({ _id: dealId, buyerId: actor.id, ...clean }).lean();
  if (!deal) throw notFound("Deal not found.");

  const stored = await Document.find({
    ownerType: "sales_deal",
    ownerId: deal._id,
    ...clean
  })
    .sort({ createdAt: -1 })
    .lean();

  const byId = new Map();
  for (const doc of stored) {
    const row = normalizeDoc(doc);
    if (row) byId.set(row.documentId, row);
  }

  for (const item of extractFromDocumentation(deal.documentation)) {
    const row = normalizeDoc(item);
    if (!row) continue;
    if (!byId.has(row.documentId)) byId.set(row.documentId, row);
  }

  // Resolve Mixed-field document ids that were not hydrated.
  const missingIds = [...byId.values()]
    .filter((row) => !row.purpose && !row.url)
    .map((row) => row.documentId);
  if (missingIds.length) {
    const extras = await Document.find({ _id: { $in: missingIds }, ...clean }).lean();
    for (const doc of extras) {
      const row = normalizeDoc(doc);
      if (row) byId.set(row.documentId, row);
    }
  }

  return {
    dealId: String(deal._id),
    propertyId: deal.propertyId ? String(deal.propertyId) : null,
    propertyTitle: deal.propertySnapshot?.title || null,
    stage: deal.stage,
    documents: [...byId.values()],
    registration: registrationFrom(deal.documentation),
    documentation: deal.documentation || null
  };
};

export const getBuyerDealDetail = async (actor, dealId) => {
  const deal = await SalesDeal.findOne({ _id: dealId, buyerId: actor.id, ...clean }).lean();
  if (!deal) throw notFound("Deal not found.");
  const docs = await listBuyerDealDocuments(actor, dealId);
  return {
    _id: String(deal._id),
    referenceId: deal.referenceId || null,
    stage: deal.stage,
    propertyId: deal.propertyId ? String(deal.propertyId) : null,
    propertySnapshot: deal.propertySnapshot || null,
    financials: deal.financials || null,
    sourceEnquiryId: deal.sourceEnquiryId ? String(deal.sourceEnquiryId) : null,
    registration: docs.registration,
    documents: docs.documents,
    lastActivityAt: deal.lastActivityAt || deal.updatedAt || null
  };
};
