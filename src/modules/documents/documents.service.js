import { createService } from "../../services/service.factory.js";
import { repository } from "./documents.repository.js";
import { makeReferenceId } from "../../utils/id.js";
import { createReadUrl, createUploadUrl, scanBuffer, uploadBuffer, validateUpload } from "../../services/storage.service.js";
import { badRequest, domainError } from "../error/index.js";
import { SellRequest } from "../sellRequests/sellRequests.model.js";
import { SupportTicket } from "../supportTickets/supportTickets.model.js";
import { SalesDeal } from "../salesDeals/salesDeals.model.js";
import { Payment } from "../payments/payments.model.js";

const baseService = createService({ collection: "documents", repository, workflowField: null, workflowMap: null, ownerField: null });

const PUBLIC_PURPOSES = new Set(["property_media", "profile_photo"]);
const storageKeyFor = ({ purpose, ownerType, ownerId, fileName }) => `${purpose}/${ownerType}/${ownerId}/${Date.now()}-${String(fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
const assertUploadOwner = async (payload, actor) => {
  if (actor?.type !== "customer") return;
  if (payload.ownerType === "user" && String(payload.ownerId) === String(actor.id)) return;
  if (payload.ownerType === "sell_request") {
    const sellRequest = await SellRequest.findOne({ _id: payload.ownerId, sellerId: actor.id, isDeleted: { $ne: true } });
    if (sellRequest) return;
  }
  if (payload.ownerType === "acquisition") {
    const { Acquisition } = await import("../acquisitions/acquisitions.model.js");
    const acquisition = await Acquisition.findOne({ _id: payload.ownerId, sellerId: actor.id, isDeleted: { $ne: true } });
    if (acquisition) return;
  }
  if (payload.ownerType === "support_ticket") {
    const ticket = await SupportTicket.findOne({ _id: payload.ownerId, userId: actor.id, isDeleted: { $ne: true } });
    if (ticket) return;
  }
  if (payload.ownerType === "sales_deal") {
    const deal = await SalesDeal.findOne({ _id: payload.ownerId, buyerId: actor.id, isDeleted: { $ne: true } });
    if (deal) return;
  }
  if (payload.ownerType === "payment") {
    const payment = await Payment.findOne({ _id: payload.ownerId, userId: actor.id, isDeleted: { $ne: true } });
    if (payment) return;
  }
  throw domainError("You cannot upload documents for this resource.");
};

export const service = {
  ...baseService,
  async create(data, actor) {
    validateUpload({ purpose: data.purpose, mimeType: data.mimeType, sizeBytes: data.sizeBytes || 0 });
    await assertUploadOwner(data, actor);
    const storageKey = data.storageKey || storageKeyFor(data);
    const document = await repository.create({
      ...data,
      referenceId: data.referenceId || makeReferenceId("documents"),
      storageKey,
      uploadedBy: actor?.id,
      isPrivate: !PUBLIC_PURPOSES.has(data.purpose),
      scanStatus: "pending"
    });
    const uploadUrl = data.createSignedUrl ? await createUploadUrl({ key: storageKey, mimeType: data.mimeType }) : undefined;
    return uploadUrl ? { document, uploadUrl, expiresInSeconds: 900 } : document;
  },
  async createFromMultipart({ file, body }, actor) {
    if (!file) throw badRequest("A file is required.");
    const payload = {
      ...body,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageKey: storageKeyFor({ ...body, fileName: file.originalname })
    };
    validateUpload(payload);
    await assertUploadOwner(payload, actor);
    const scan = await scanBuffer({ buffer: file.buffer, mimeType: payload.mimeType });
    if (scan.status === "infected") throw domainError("Uploaded file failed malware scanning.");
    const quarantine = scan.status !== "clean";
    const url = await uploadBuffer({ key: payload.storageKey, mimeType: payload.mimeType, buffer: file.buffer, quarantine });
    return repository.create({
      ...payload,
      referenceId: makeReferenceId("documents"),
      url,
      uploadedBy: actor?.id,
      isPrivate: !PUBLIC_PURPOSES.has(payload.purpose),
      status: scan.status === "clean" ? "uploaded" : "scan_pending",
      scanStatus: scan.status
    });
  },
  async createSecureReadUrl(id, actor, { expiresIn = 900 } = {}) {
    const doc = await repository.findById(id);
    await assertUploadOwner({ ownerType: doc.ownerType, ownerId: doc.ownerId }, actor);
    if (doc.scanStatus === "infected") throw domainError("Document is blocked by malware scanning.");
    return { documentId: doc._id, readUrl: await createReadUrl({ key: doc.storageKey, expiresIn }), expiresInSeconds: Math.min(Number(expiresIn) || 900, 900) };
  }
};