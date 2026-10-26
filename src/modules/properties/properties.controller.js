import { createController } from "../../utils/controller.factory.js";
import { service } from "./properties.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { service as documentService } from "../documents/documents.service.js";
import { badRequest, forbidden, notFound } from "./properties.error.js";
import { PropertyImportJob } from "./properties.importJob.model.js";
import { Property } from "./properties.model.js";
import { bulkTemplateFields, FEATURED_LIMIT, importJobQuery, importJobPopulate, parseBulkRows, validateBulkRows, mapBulkRowToProperty, propertyToTemplateRow, mapPropertyQuery } from "./properties.bulkImport.js";

const PUBLIC_STATUSES = ["available", "reserved", "under_construction"];
const publicPropertySelect = "-savedByUsers -assignedTo -sourceSheet -acquisitionId -deletedBy";
const toPublicProperty = (doc) => {
  if (!doc) return doc;
  const plain = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  delete plain.savedByUsers;
  delete plain.assignedTo;
  delete plain.sourceSheet;
  delete plain.acquisitionId;
  delete plain.deletedBy;
  return plain;
};

export const controller = {
  ...createController(service, { idParam: "propertyId" }),
  getProperties: asyncHandler(async (req, res) => {
    const recentlySold = req.query.recentlySold === true || req.query.recentlySold === "true";
    const query = {
      ...req.query,
      status: recentlySold ? "sold" : PUBLIC_STATUSES,
      isVisibleOnApp: true,
      includeDeleted: false,
      deletedOnly: false
    };
    delete query.assignedTo;
    const result = await service.list(mapPropertyQuery(query), req.actor);
    res.json({ data: (result.data || []).map(toPublicProperty), meta: { ...result.meta, requestId: res.locals.requestId } });
  }),
  getPropertiesById: asyncHandler(async (req, res) => {
    const { Property } = await import("./properties.model.js");
    const data = await Property.findOne({ _id: req.params.propertyId, status: { $in: PUBLIC_STATUSES }, isVisibleOnApp: { $ne: false }, isDeleted: { $ne: true } }).select(publicPropertySelect);
    if (!data) throw notFound("Property not found.");
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createPropertiesSave: asyncHandler(async (req, res) => {
    const { Property } = await import("./properties.model.js");
    const property = await Property.findOne({ _id: req.params.propertyId, status: { $in: ["available", "reserved", "under_construction"] }, isDeleted: { $ne: true } });
    if (!property) throw notFound("Property not found.");
    const alreadySaved = property.savedByUsers?.some((id) => String(id) === String(req.actor.id));
    if (!alreadySaved) {
      property.savedByUsers.push(req.actor.id);
      property.metrics.savedCount += 1;
      await property.save();
    }
    res.json({ data: toPublicProperty(property), meta: { requestId: res.locals.requestId } });
  }),
  removePropertiesSave: asyncHandler(async (req, res) => {
    const { Property } = await import("./properties.model.js");
    const property = await Property.findOne({ _id: req.params.propertyId, savedByUsers: req.actor.id, isDeleted: { $ne: true } });
    if (property) {
      property.savedByUsers = property.savedByUsers.filter((id) => String(id) !== String(req.actor.id));
      property.metrics.savedCount = Math.max(0, property.metrics.savedCount - 1);
      await property.save();
    }
    res.status(204).send();
  }),
  getMeFavorites: asyncHandler(async (req, res) => { const { Property } = await import("./properties.model.js"); const data = await Property.find({ savedByUsers: req.actor.id, status: { $in: PUBLIC_STATUSES }, isDeleted: { $ne: true } }).select(publicPropertySelect); res.json({ data, meta: { requestId: res.locals.requestId } }); }),
  getAdminProperties: asyncHandler(async (req, res) => { const result = await service.list(mapPropertyQuery(req.query), req.actor); res.json({ data: result.data, meta: { ...result.meta, requestId: res.locals.requestId } }); }),
  getAdminPropertiesImportJobs: asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const data = await importJobPopulate(PropertyImportJob.find({}).sort({ createdAt: -1 }).limit(limit));
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  getAdminImportJobs: asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const data = await importJobPopulate(PropertyImportJob.find({}).sort({ createdAt: -1 }).limit(limit));
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  getAdminImportJobsById: asyncHandler(async (req, res) => {
    const data = await importJobPopulate(PropertyImportJob.findOne(importJobQuery(req.params.id)));
    if (!data) throw notFound("Import job not found.");
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  getAdminPropertiesBulkTemplate: asyncHandler(async (req, res) => {
    const mode = req.query.mode === "valued" ? "valued" : "empty";
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const total = mode === "valued" ? await Property.countDocuments({ isDeleted: { $ne: true } }) : 0;
    const rows = mode === "valued"
      ? (await Property.find({ isDeleted: { $ne: true } }).sort({ updatedAt: -1, createdAt: -1 }).limit(limit).lean()).map(propertyToTemplateRow)
      : [];
    res.json({ data: { mode, fields: bulkTemplateFields, rows }, meta: { requestId: res.locals.requestId, total, limit } });
  }),
  createAdminImportJobsUndo: asyncHandler(async (req, res) => {
    const job = await PropertyImportJob.findOne(importJobQuery(req.params.id));
    if (!job) throw notFound("Import job not found.");
    if (job.status === "reverted") throw badRequest("Import job has already been reverted.");
    if (!job.importedProperties?.length) throw badRequest("This import job did not create any properties.");
    const now = new Date();
    const result = await Property.updateMany(
      { _id: { $in: job.importedProperties }, source: "bulk_upload", isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: now, deletedBy: req.actor.id } }
    );
    job.status = "reverted";
    job.revertedAt = now;
    job.revertedBy = req.actor.id;
    await job.save();
    const data = await importJobPopulate(PropertyImportJob.findById(job._id));
    res.json({ data: { job: data, revertedCount: result.modifiedCount || 0 }, meta: { requestId: res.locals.requestId } });
  }),
  updateAdminPropertiesById: asyncHandler(async (req, res, next) => {
    if ((req.body.isFeatured !== undefined || req.body.isUpcoming !== undefined) && req.actor.role !== "super_admin" && !req.actor.permissions?.includes("properties.publish")) return next(forbidden("Publishing and editorial flags require properties.publish."));
    if (req.body.isFeatured === true) {
      const featuredCount = await Property.countDocuments({ _id: { $ne: req.params.propertyId }, isFeatured: true, isDeleted: { $ne: true } });
      if (featuredCount >= FEATURED_LIMIT) throw badRequest(`Only ${FEATURED_LIMIT} properties can be featured at a time.`);
    }
    const data = await service.update(req.params.propertyId, req.body, req.actor, req);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  removeAdminPropertiesById: asyncHandler(async (req, res) => {
    const data = await service.remove(req.params.propertyId, req.actor, req);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  updateAdminPropertiesRestore: asyncHandler(async (req, res) => {
    const data = await Property.findOneAndUpdate(
      { _id: req.params.propertyId, isDeleted: true },
      { $set: { isDeleted: false }, $unset: { deletedAt: "", deletedBy: "" } },
      { new: true, runValidators: true }
    );
    if (!data) throw notFound("Property not found in trash.");
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  removeAdminPropertiesPermanent: asyncHandler(async (req, res) => {
    const data = await Property.findOneAndDelete({ _id: req.params.propertyId, isDeleted: true });
    if (!data) throw notFound("Property not found in trash.");
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createAdminPropertiesMedia: asyncHandler(async (req, res) => {
    const { Property } = await import("./properties.model.js");
    const property = await Property.findOne({ _id: req.params.propertyId, isDeleted: { $ne: true } });
    if (!property) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Property not found.", details: [] }, meta: { requestId: res.locals.requestId } });
    const documents = [];
    for (const file of req.files || []) {
      documents.push(await documentService.createFromMultipart({ file, body: { ownerType: "property", ownerId: property._id, purpose: "property_media", documentType: req.body.documentType || "photo" } }, req.actor));
    }
    const urls = documents.filter((doc) => doc.scanStatus === "clean" && doc.status === "verified").map((doc) => doc.url).filter(Boolean);
    if (urls.length) {
      property.media = property.media || {};
      property.media.photos = [...(property.media.photos || []), ...urls];
      if (!property.media.coverPhoto) property.media.coverPhoto = urls[0];
      await property.save();
    }
    res.status(201).json({ data: { property, documents, pendingReview: documents.filter((doc) => doc.scanStatus !== "clean" || doc.status !== "verified").length }, meta: { requestId: res.locals.requestId } });
  }),
  createAdminPropertiesBulkUpload: asyncHandler(async (req, res) => {
    const rows = await parseBulkRows(req.file);
    const errors = validateBulkRows(rows);
    const rejectedRows = new Set(errors.map((error) => error.row));
    const rowsAccepted = rows.length - rejectedRows.size;
    const rowsRejected = rejectedRows.size;
    const referenceId = `IMPORT-${new Date().getUTCFullYear()}-${Date.now()}`;
    const createdProperties = [];
    if (!errors.length) {
      try {
        createdProperties.push(...await Property.insertMany(rows.map((row, index) => mapBulkRowToProperty(row, referenceId, index)), { ordered: true }));
      } catch (error) {
        throw badRequest("Could not import properties. Check for duplicate property IDs or invalid row values.", [{ field: "file", message: error.message }]);
      }
    }
    const job = await PropertyImportJob.create({
      referenceId,
      fileName: req.file?.originalname || "upload",
      status: errors.length === 0 ? "completed" : "rejected",
      rowsTotal: rows.length,
      rowsAccepted,
      rowsRejected,
      errors,
      importedProperties: createdProperties.map((property) => property._id),
      requestedBy: req.actor.id,
      completedAt: new Date()
    });
    const data = await importJobPopulate(PropertyImportJob.findById(job._id));
    res.status(201).json({ data: { valid: errors.length === 0, rowsAccepted, rowsRejected, errors, job: data }, meta: { requestId: res.locals.requestId } });
  })
};
