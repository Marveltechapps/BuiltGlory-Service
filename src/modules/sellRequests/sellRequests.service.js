import { createService } from "../../services/service.factory.js";
import { repository } from "./sellRequests.repository.js";
import { User } from "../users/users.model.js";
import { Admin } from "../admins/admins.model.js";
import { notFound } from "./sellRequests.error.js";
import { Acquisition } from "../acquisitions/acquisitions.model.js";
import { Property } from "../properties/properties.model.js";
import { BuyEnquiry } from "../buyEnquiries/buyEnquiries.model.js";
import { Visit } from "../visits/visits.model.js";
import { ChatThread } from "../chatThreads/chatThreads.model.js";
import { Payment } from "../payments/payments.model.js";
import { CommunicationLog } from "../communicationLogs/communicationLogs.model.js";
import { domainError } from "./sellRequests.error.js";
import { assertMandatoryDocuments, SELLER_DOCUMENT_CHECKLIST } from "../../services/legalDocumentRules.service.js";
import { writeAuditLog } from "../../services/audit.service.js";
import { makeReferenceId } from "../../utils/id.js";
import { collectSubmissionIssues } from "./sellRequests.rules.js";
import { visitDateTime } from "../../utils/visitTime.js";
import { Document } from "../documents/documents.model.js";
import { resolveAddressCoordinates } from "../geo/geo.coordinates.js";
const baseService = createService({ collection: "sellRequests", repository, workflowField: "status", workflowMap: "sellRequestStatus", ownerField: "sellerId" });
const clean = { isDeleted: { $ne: true } };
const fallbackRates = {
  chennai: 7200,
  bengaluru: 9500,
  bangalore: 9500,
  hyderabad: 8200,
  mumbai: 18000,
  pune: 9000,
  delhi: 14000,
  gurugram: 12500,
  noida: 8500,
  default: 7000
};
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const areaFor = (specs = {}) => number(specs.builtUpArea) || number(specs.carpetArea) || number(specs.plotArea) || number(specs.area) || null;
const normalize = (value) => String(value || "").trim().toLowerCase();
const dateKey = (value) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || "").slice(0, 10);
};
const plain = (value) => (value?.toObject ? value.toObject() : value) || {};
const rateFor = (property) => {
  const area = areaFor(property.specs || {});
  const price = number(property.price);
  return area && price ? { area, rate: price / area } : null;
};
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const confidenceFor = (count) => count >= 8 ? "high" : count >= 3 ? "medium" : count > 0 ? "low" : "baseline";
const comparableScore = (sellRequest, property) => {
  let score = 0;
  const city = normalize(sellRequest.address?.city);
  const locality = normalize(sellRequest.address?.locality);
  if (city && normalize(property.address?.city) === city) score += 3;
  if (locality && normalize(property.address?.locality).includes(locality)) score += 4;
  if (sellRequest.specifications?.bhk && String(property.specs?.bhk || "").toLowerCase() === String(sellRequest.specifications.bhk).toLowerCase()) score += 2;
  return score;
};
const sellPhotoUrls = (data = {}) => {
  const fromPhotos = Array.isArray(data.photos) ? data.photos.filter(Boolean) : [];
  if (fromPhotos.length) return fromPhotos;
  return (data.documents || [])
    .filter((doc) => doc?.fileUrl && !["rejected", "missing"].includes(doc.status))
    .map((doc) => doc.fileUrl)
    .filter(Boolean);
};
const sellPhotoCount = (data = {}) => {
  const fromPhotos = Array.isArray(data.photos) ? data.photos.filter(Boolean).length : 0;
  const fromCount = Number(data.photosCount) > 0 ? Number(data.photosCount) : 0;
  const fromDocs = (data.documents || []).filter((doc) => doc?.fileUrl && !["rejected", "missing"].includes(doc.status)).length;
  return Math.max(fromPhotos, fromCount, fromDocs);
};
const validateSubmission = (data, seller) => {
  const payload = {
    ...data,
    photosCount: sellPhotoCount(data),
    photos: sellPhotoUrls(data)
  };
  const missing = collectSubmissionIssues(payload, seller);
  if (missing.length) throw domainError("Sell request submission is incomplete.", missing);
};
const normalizeSellRequestPatch = (data = {}) => {
  const patch = { ...data };
  if (Array.isArray(patch.photos)) {
    patch.photos = patch.photos.filter(Boolean);
    patch.photosCount = patch.photos.length;
  } else if (Array.isArray(patch.documents) && !patch.photosCount) {
    const derivedPhotos = sellPhotoUrls(patch);
    if (derivedPhotos.length) {
      patch.photos = derivedPhotos;
      patch.photosCount = derivedPhotos.length;
    }
  }
  if (Array.isArray(patch.documents)) patch.documentsCount = patch.documents.length;
  return patch;
};
const hasValue = (value) => value !== undefined && value !== null && value !== "";
const mergeSellRequest = (existing = {}, patch = {}) => ({
  ...existing,
  ...patch,
  address: { ...(existing.address?.toObject?.() || existing.address || {}), ...(patch.address || {}) },
  specifications: { ...(existing.specifications?.toObject?.() || existing.specifications || {}), ...(patch.specifications || {}) },
  amenities: patch.amenities ?? existing.amenities,
  documents: patch.documents ?? existing.documents,
  photos: patch.photos ?? existing.photos
});
const computeCompletenessPercent = (data = {}) => {
  const specs = data.specifications || {};
  const propertyDetails = { ...specs, ownershipType: data.ownershipType, possessionStatus: data.possessionStatus, loanOnProperty: data.loanOnProperty };
  const hasPropertyDetails = Object.values(propertyDetails).some(hasValue);
  const photoCount = sellPhotoCount(data);
  const uploadedDocs = (data.documents || []).filter((doc) => doc?.status === "uploaded" || doc?.fileUrl).length;
  const hasDocuments = uploadedDocs > 0 || Number(data.documentsCount) > 0;
  const askingPrice = Number(data.askingPrice);
  const hasLocation = Boolean(data.address?.city && data.address?.pincode && (data.address.locality || data.address.street));
  const checks = [
    hasPropertyDetails,
    photoCount > 0,
    Number.isFinite(askingPrice) && askingPrice > 0,
    hasDocuments,
    Boolean(String(data.description || "").trim()),
    hasLocation,
    Array.isArray(data.amenities) && data.amenities.length > 0
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};
const withCompleteness = (existing, patch = {}) => {
  const merged = mergeSellRequest(existing?.toObject?.() || existing || {}, patch);
  return { ...patch, completenessPercent: computeCompletenessPercent(merged) };
};
const assertSellerOwner = async (id, actor) => {
  const sellRequest = await repository.findById(id);
  if (String(sellRequest.sellerId) !== String(actor?.id)) throw domainError("You cannot access this sell request.");
  return sellRequest;
};
const maskBuyerName = (name) => {
  const value = String(name || "").trim();
  if (!value) return "Buyer";
  return `${value[0].toUpperCase()}***`;
};
const positiveAmount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const offerAmountFor = (sellRequest, acquisition) => positiveAmount(acquisition?.agreedPrice)
  || positiveAmount(acquisition?.negotiation?.agreedPrice)
  || positiveAmount(acquisition?.negotiation?.builtgloryOffer)
  || positiveAmount(acquisition?.builtgloryOffer)
  || positiveAmount(acquisition?.valuation?.amount)
  || positiveAmount(sellRequest?.sale?.salePrice)
  || positiveAmount(acquisition?.askingPrice)
  || positiveAmount(sellRequest?.askingPrice)
  || null;
const registrationChecklist = (acquisition) => acquisition?.documentation?.requiredDocuments
  || acquisition?.documentation?.registrationChecklist
  || ["Original title documents", "Aadhaar & PAN (seller)", "Latest tax receipts", "Encumbrance certificate", "2 passport photos"];
const payoutScheduleFor = ({ amount, acquisition, payments }) => {
  if (!amount) return [];
  const tokenAmount = acquisition?.token?.amount || Math.round(amount * 0.03);
  const balanceAmount = Math.max(amount - tokenAmount, 0);
  const sellerPayout = payments.find((payment) => payment.type === "seller_payout");
  return [
    {
      key: "token",
      label: "Token Amount",
      amount: tokenAmount,
      dueLabel: "Due on agreement",
      status: acquisition?.token?.paid ? "paid" : acquisition?.stage === "token_to_seller" ? "pending" : "upcoming"
    },
    {
      key: "balance",
      label: "Balance Payment",
      amount: balanceAmount,
      dueLabel: acquisition?.documentation?.registrationDate ? "Due at registration" : "Due after documentation",
      status: acquisition?.payout?.completed ? "paid" : sellerPayout?.status || "pending"
    }
  ];
};
const compactMessages = (threads) => threads.flatMap((thread) => (thread.messages || []).slice(-5).map((message) => ({
  threadId: thread._id,
  sender: message.sender,
  type: message.type,
  text: message.text,
  offerAmount: message.offerAmount,
  offerStatus: message.offerStatus,
  createdAt: message.createdAt
}))).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)).slice(-20);
const compactSellerMessages = (logs) => logs.map((log) => ({
  logId: log._id,
  referenceId: log.referenceId,
  sender: log.actorType === "customer" ? "seller" : log.actorType,
  type: "text",
  text: log.body || log.summary,
  createdAt: log.occurredAt || log.createdAt
}));
const combineMessages = (threads, logs) => [...compactMessages(threads), ...compactSellerMessages(logs)]
  .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
  .slice(-30);
const assertSellerVisit = async ({ sellRequest, actor, visitId }) => {
  const acquisition = await Acquisition.findOne({ sellRequestId: sellRequest._id, sellerId: actor.id, ...clean }).sort({ createdAt: -1 }).lean();
  const property = acquisition ? await Property.findOne({ acquisitionId: acquisition._id, ...clean }).lean() : null;
  if (!property) throw domainError("Seller visits are available after the listing is converted to a property.");
  const visit = await Visit.findOne({ _id: visitId, propertyId: property._id, ...clean });
  if (!visit) throw domainError("Visit is not linked to this seller listing.");
  return { visit, property };
};
const ensureAcquisitionForSellRequest = async (sellRequest, actor) => {
  if (!sellRequest || sellRequest.isDeleted) return null;
  if (!["new", "under_review", "accepted", "approved", "active"].includes(sellRequest.status)) return null;
  const { service: acquisitionService } = await import("../acquisitions/acquisitions.service.js");
  return acquisitionService.create({ sellRequestId: sellRequest._id }, actor);
};
const isDraftSellRequest = (doc) => Boolean(doc?.isDraft || doc?.status === "draft");
const enrichSellRequest = async (doc) => {
  const item = doc?.toObject ? doc.toObject() : { ...doc };
  if (!item.sellerSnapshot?.phone && item.sellerId) {
    const seller = await User.findById(item.sellerId).select("phone email name userType kycStatus").lean();
    if (seller) {
      item.sellerSnapshot = {
        ...(item.sellerSnapshot || {}),
        name: item.sellerSnapshot?.name || seller.name,
        phone: seller.phone || item.sellerSnapshot?.phone,
        email: item.sellerSnapshot?.email || seller.email,
        userType: item.sellerSnapshot?.userType || seller.userType,
        kycStatus: item.sellerSnapshot?.kycStatus || seller.kycStatus
      };
    }
  }
  const photos = sellPhotoUrls(item);
  if (photos.length) {
    item.photos = photos;
    item.photosCount = Math.max(Number(item.photosCount) || 0, photos.length);
  }
  item.completenessPercent = computeCompletenessPercent(item);
  return item;
};
const adminListFilter = (query = {}) => {
  if (query.sellerId) return {};
  const forced = { isDraft: { $ne: true } };
  if (!query.status) forced.status = { $ne: "draft" };
  return forced;
};
const assertSellerRescheduleSlot = async ({ visit, visitDate, visitTime }) => {
  if (!visitDate || !visitTime || visitDateTime({ visitDate, visitTime }) <= new Date()) throw domainError("Reschedule requires a future visit date and time.");
  const from = new Date(`${dateKey(visitDate)}T00:00:00.000Z`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const booked = await Visit.countDocuments({
    _id: { $ne: visit._id },
    propertyId: visit.propertyId,
    visitType: visit.visitType,
    status: { $in: ["scheduled", "confirmed", "rescheduled"] },
    visitDate: { $gte: from, $lt: to },
    visitTime,
    ...clean
  });
  if (booked >= 1) throw domainError("Selected visit slot is no longer available. Please choose another time.");
};
export const service = {
  ...baseService,
  async list(query, actor) {
    const forced = actor?.type === "customer" ? { sellerId: actor.id } : actor?.type === "admin" ? adminListFilter(query) : {};
    const result = await repository.list(query, forced);
    return { ...result, data: await Promise.all(result.data.map(enrichSellRequest)) };
  },
  async get(id, actor) {
    const doc = await baseService.get(id, actor);
    if (actor?.type === "admin" && isDraftSellRequest(doc)) throw notFound("Sell request not found.");
    return enrichSellRequest(doc);
  },
  async adminUpdate(id, data, actor, req) {
    if (actor?.type !== "admin") throw domainError("Admin access required.");
    const before = await repository.findById(id);
    if (isDraftSellRequest(before)) throw domainError("Draft sell requests are not available in admin enquiries.");
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(data, "assignedTo")) {
      if (!data.assignedTo) {
        patch.assignedTo = null;
      } else {
        const assignee = await Admin.findOne({ _id: data.assignedTo, isActive: true });
        if (!assignee) throw domainError("Assigned team member not found or inactive.");
        patch.assignedTo = assignee._id;
      }
    }
    if (!Object.keys(patch).length) throw domainError("No valid fields to update.");
    const doc = await baseService.update(id, patch, actor, req);
    return enrichSellRequest(doc);
  },
  async create(data, actor) {
    const seller = await User.findById(actor?.id);
    if (!seller || seller.isBlocked) throw domainError("Blocked or inactive sellers cannot create sell requests.");
    const isDraft = data.isDraft || data.status === "draft";
    if (!isDraft && seller.role === "buyer") {
      seller.role = "both";
      await seller.save();
    }
    if (!isDraft) validateSubmission(data, seller);
    const address = data.address ? await resolveAddressCoordinates(data.address, { refine: true }) : data.address;
    const doc = await baseService.create(withCompleteness(null, {
      ...data,
      ...(address ? { address } : {}),
      sellerId: seller._id,
      sellerSnapshot: { name: seller.name, phone: seller.phone, email: seller.email, userType: seller.userType, kycStatus: seller.kycStatus },
      status: isDraft ? "draft" : "new",
      isDraft,
      draftSavedAt: isDraft ? new Date() : data.draftSavedAt,
      submittedAt: isDraft ? undefined : new Date(),
      photosCount: data.photosCount || data.photos?.length || 0,
      documentsCount: data.documentsCount || data.documents?.length || 0
    }), actor);
    if (!isDraft) await ensureAcquisitionForSellRequest(doc, actor);
    return enrichSellRequest(doc);
  },
  async transition(id, to, actor, req, extra = {}) {
    const before = await repository.findById(id);
    if (to === "new") {
      const seller = await User.findById(before.sellerId);
      // Promote buyer → both on submit so clients need not PATCH /me first (web/mobile sell wizard).
      if (seller?.role === "buyer") {
        seller.role = "both";
        await seller.save();
      }
      const merged = normalizeSellRequestPatch({ ...before.toObject(), ...extra });
      const photos = sellPhotoUrls(merged);
      if (photos.length) {
        merged.photos = photos;
        merged.photosCount = photos.length;
      }
      validateSubmission(merged, seller);
      extra.isDraft = false;
      extra.submittedAt = new Date();
      extra.photosCount = merged.photosCount || sellPhotoCount(merged);
      if (merged.photos?.length) extra.photos = merged.photos;
      Object.assign(extra, withCompleteness(before, extra));
    }
    if (to === "approved" || (to === "active" && before.status === "approved")) {
      const seller = await User.findById(before.sellerId);
      if (seller?.kycStatus !== "verified") throw domainError("Seller KYC must be verified before approval or activation.");
      assertMandatoryDocuments({ documents: before.documents || [], checklist: SELLER_DOCUMENT_CHECKLIST, action: "sell request approval" });
    }
    if (to === "rejected") {
      extra.rejectionReason = extra.rejectionReason || extra.reason || extra.notes;
      if (!extra.rejectionReason) throw domainError("Rejection requires a reason.");
    }
    if (to === "changes_requested") {
      const notes = extra.notes || extra.reason;
      if (notes && !(extra.changeRequests || []).length) extra.changeRequests = [notes];
      if (!(extra.changeRequests || []).length) throw domainError("Changes requested requires at least one change note.");
    }
    if (to === "paused") extra.pauseReason = extra.pauseReason || extra.reason || extra.notes || "Paused by admin";
    if (to === "sold") {
      extra.sale = {
        salePrice: extra.salePrice || extra.sale?.salePrice || before.askingPrice,
        saleDate: extra.saleDate || extra.sale?.saleDate || new Date(),
        buyerName: extra.saleBuyerName || extra.sale?.buyerName || null
      };
    }
    const doc = await baseService.transition(id, to, actor, req, extra);
    if (["new", "under_review", "accepted", "approved", "active"].includes(to)) {
      await ensureAcquisitionForSellRequest(doc, actor);
    }
    return doc;
  },
  async update(id, data, actor, req) {
    const before = await repository.findById(id);
    if (actor?.type === "customer") {
      if (String(before.sellerId) !== String(actor.id)) throw domainError("You cannot edit this sell request.");
      if (!["draft", "changes_requested"].includes(before.status)) throw domainError("Seller can edit only draft or change-requested sell requests.");
    }
    const patch = withCompleteness(before, normalizeSellRequestPatch(data));
    if (actor?.type === "customer" && before.status === "draft") {
      patch.isDraft = true;
      patch.status = "draft";
    }
    const doc = await baseService.update(id, patch, actor, req);
    return enrichSellRequest(doc);
  },
  async sellerActivity(id, actor) {
    const sellRequest = await assertSellerOwner(id, actor);
    const acquisition = await Acquisition.findOne({ sellRequestId: sellRequest._id, sellerId: actor.id, ...clean }).sort({ createdAt: -1 }).lean();
    const property = acquisition ? await Property.findOne({ acquisitionId: acquisition._id, ...clean }).lean() : null;
    const propertyQuery = property ? { propertyId: property._id, ...clean } : null;
    const [enquiries, visits, chatThreads, payments, sellerMessages] = propertyQuery ? await Promise.all([
      BuyEnquiry.find(propertyQuery).sort({ submittedAt: -1 }).limit(20).lean(),
      Visit.find(propertyQuery).sort({ visitDate: -1 }).limit(20).lean(),
      ChatThread.find(propertyQuery).sort({ lastMessageAt: -1 }).limit(10).lean(),
      Payment.find({ userId: actor.id, type: "seller_payout", ...clean }).sort({ createdAt: -1 }).limit(10).lean(),
      CommunicationLog.find({ entityType: "sell_request", entityId: sellRequest._id, channel: "message", ...clean }).sort({ occurredAt: -1, createdAt: -1 }).limit(20).lean()
    ]) : await Promise.all([
      Promise.resolve([]),
      Promise.resolve([]),
      Promise.resolve([]),
      Payment.find({ userId: actor.id, type: "seller_payout", ...clean }).sort({ createdAt: -1 }).limit(10).lean(),
      CommunicationLog.find({ entityType: "sell_request", entityId: sellRequest._id, channel: "message", ...clean }).sort({ occurredAt: -1, createdAt: -1 }).limit(20).lean()
    ]);
    const amount = offerAmountFor(sellRequest, acquisition);
    const advisorId = acquisition?.assignedTo || sellRequest.assignedTo;
    const advisor = advisorId ? await Admin.findById(advisorId).select("name phone").lean() : null;
    return {
      sellRequest,
      acquisition,
      property,
      assignedAdvisor: advisor ? { name: advisor.name || null, phone: advisor.phone || null } : null,
      availability: sellRequest.sellerAvailability || [],
      offer: amount ? {
        amount,
        status: ["seller_accepted", "seller_countered"].includes(acquisition?.negotiation?.status)
          ? acquisition.negotiation.status
          : (acquisition?.negotiation?.sellerDecision?.decision || acquisition?.negotiation?.status || acquisition?.stage || sellRequest.status),
        expiresAt: acquisition?.negotiation?.deadline || null,
        counterAmount: acquisition?.negotiation?.sellerDecision?.counterAmount || acquisition?.negotiation?.counterAmount || null,
        notes: acquisition?.negotiation?.sellerDecision?.notes || acquisition?.negotiation?.notes || null
      } : null,
      enquiries: enquiries.map((enquiry) => ({
        _id: enquiry._id,
        referenceId: enquiry.referenceId,
        buyerSnapshot: {
          name: maskBuyerName(enquiry.buyerSnapshot?.name),
          userType: enquiry.buyerSnapshot?.userType || null
        },
        interestType: enquiry.interestType,
        preferredContact: enquiry.preferredContact,
        preferredVisitDate: enquiry.preferredVisitDate,
        preferredVisitTimeSlot: enquiry.preferredVisitTimeSlot,
        status: enquiry.status,
        submittedAt: enquiry.submittedAt
      })),
      visits: visits.map((visit) => ({
        _id: visit._id,
        referenceId: visit.referenceId,
        buyerId: visit.buyerId,
        visitDate: visit.visitDate,
        visitTime: visit.visitTime,
        visitType: visit.visitType,
        status: visit.status,
        rescheduleCount: visit.rescheduleCount,
        feedback: visit.feedback
      })),
      chatThreads: chatThreads.map((thread) => ({
        _id: thread._id,
        referenceId: thread.referenceId,
        status: thread.status,
        negotiation: thread.negotiation,
        lastMessageAt: thread.lastMessageAt,
        messageCount: thread.messages?.length || 0
      })),
      messages: combineMessages(chatThreads, sellerMessages),
      payoutSchedule: payoutScheduleFor({ amount, acquisition, payments }),
      payoutConfirmation: {
        confirmedAt: acquisition?.payout?.sellerConfirmedAt || null
      },
      registration: {
        appointment: acquisition?.documentation?.registrationAppointment || acquisition?.documentation?.registration || null,
        status: acquisition?.documentation?.registrationStatus || acquisition?.documentation?.status || (acquisition?.stage === "acquired" ? "completed" : "pending"),
        checklist: registrationChecklist(acquisition),
        sellerConfirmedAt: acquisition?.documentation?.sellerConfirmedAt || null,
        documentsReady: acquisition?.documentation?.documentsReady || []
      },
      metrics: {
        enquiryCount: enquiries.length || sellRequest.metrics?.enquiryCount || 0,
        visitCount: visits.length || sellRequest.metrics?.visitCount || 0,
        chatCount: chatThreads.length,
        payoutCount: payments.length,
        views: property?._id
          ? (await import("../properties/properties.dailyStats.service.js")
            .then((mod) => mod.sumPropertyDailyStats(property._id, 7))
            .then((sum) => sum.views)
            .catch(() => property.metrics?.views || 0))
          : (sellRequest.metrics?.views || 0)
      }
    };
  },
  async sellerMessage(id, data, actor, req) {
    const sellRequest = await assertSellerOwner(id, actor);
    const text = String(data.text || "").trim();
    if (!text) throw domainError("Message text is required.");
    const log = await CommunicationLog.create({
      referenceId: makeReferenceId("communicationLogs"),
      entityType: "sell_request",
      entityId: sellRequest._id,
      channel: "message",
      direction: "inbound",
      summary: "Seller negotiation message",
      body: text,
      actorType: "customer",
      actorId: actor?.id,
      occurredAt: new Date()
    });
    try {
      const { appendConversationMessage } = await import("../conversationMessages/conversationMessages.service.js");
      await appendConversationMessage({
        conversationType: "sell_request",
        conversationId: sellRequest._id,
        senderType: "customer",
        senderId: actor?.id,
        type: "text",
        text,
        clientMessageId: typeof data.clientMessageId === "string" ? data.clientMessageId.trim().slice(0, 100) : undefined
      });
    } catch {
      // Dual-write must not break seller messaging via communication logs.
    }
    await writeAuditLog({ actor, action: "sellRequests.message_sent", resourceType: "sellRequests", resourceId: sellRequest._id, before: null, after: log.toObject(), req });
    return this.sellerActivity(id, actor);
  },
  async sellerVisitAction(id, visitId, data, actor, req) {
    const sellRequest = await assertSellerOwner(id, actor);
    const { visit } = await assertSellerVisit({ sellRequest, actor, visitId });
    const before = visit.toObject();
    if (data.action === "confirm") {
      if (visit.status === "cancelled" || visit.status === "completed") throw domainError("Only active visit requests can be confirmed.");
      if (visit.visitType === "virtual" && !(visit.meetingLink || data.meetingLink)) throw domainError("Virtual visits require a meeting link before confirmation.");
      visit.status = "confirmed";
      if (data.meetingLink) visit.meetingLink = data.meetingLink;
    } else if (data.action === "reschedule") {
      await assertSellerRescheduleSlot({ visit, visitDate: data.visitDate, visitTime: data.visitTime });
      visit.rescheduleHistory.push({
        previousDate: visit.visitDate,
        previousTime: visit.visitTime,
        newDate: data.visitDate,
        newTime: data.visitTime,
        reason: data.reason || "Seller suggested a new visit slot.",
        actorType: actor?.type,
        actorId: actor?.id,
        changedAt: new Date()
      });
      visit.rescheduleCount = (visit.rescheduleCount || 0) + 1;
      visit.visitDate = data.visitDate;
      visit.visitTime = data.visitTime;
      visit.status = "rescheduled";
    } else if (data.action === "decline") {
      if (visit.status === "cancelled" || visit.status === "completed") throw domainError("Only active visit requests can be declined.");
      visit.status = "cancelled";
      visit.cancelReason = data.reason || "Declined by seller";
    } else {
      throw domainError("Unsupported seller visit action.");
    }
    await visit.save();
    await writeAuditLog({ actor, action: `sellRequests.visit_${data.action}`, resourceType: "visits", resourceId: visit._id, before, after: visit.toObject(), req });
    return this.sellerActivity(id, actor);
  },
  async setSellerAvailability(id, data, actor) {
    const sellRequest = await assertSellerOwner(id, actor);
    const slots = [...new Set((data.slots || []).map((slot) => String(slot).trim()).filter(Boolean))].slice(0, 12);
    sellRequest.sellerAvailability = slots;
    sellRequest.markModified("sellerAvailability");
    await sellRequest.save();
    return { sellRequestId: sellRequest._id, slots };
  },
  async withdraw(id, actor, req) {
    const sellRequest = await assertSellerOwner(id, actor);
    if (sellRequest.status === "sold") throw domainError("A sold listing cannot be withdrawn.");
    if (sellRequest.status === "paused") return enrichSellRequest(sellRequest);
    return this.transition(id, "paused", actor, req, { pauseReason: "Withdrawn by seller" });
  },
  async marketEstimate(id, data = {}, actor) {
    const current = await assertSellerOwner(id, actor);
    const sellRequest = {
      ...(current.toObject ? current.toObject() : current),
      ...data,
      address: { ...(current.address?.toObject?.() || current.address || {}), ...(data.address || {}) },
      specifications: { ...(current.specifications?.toObject?.() || current.specifications || {}), ...(data.specifications || {}) },
      amenities: data.amenities || current.amenities || []
    };
    const area = areaFor(sellRequest.specifications);
    if (!area) throw domainError("Property area is required before generating a market estimate.");

    const type = sellRequest.propertyType;
    const city = sellRequest.address?.city;
    const locality = sellRequest.address?.locality;
    const baseFilter = { ...clean, price: { $gt: 0 }, status: { $in: ["available", "reserved", "under_construction", "sold"] }, ...(type ? { type } : {}) };
    const filters = [
      locality && city ? { ...baseFilter, "address.city": new RegExp(escapeRegex(city), "i"), "address.locality": new RegExp(escapeRegex(locality), "i") } : null,
      city ? { ...baseFilter, "address.city": new RegExp(escapeRegex(city), "i") } : null,
      baseFilter
    ].filter(Boolean);

    let properties = [];
    for (const filter of filters) {
      properties = await Property.find(filter).sort({ updatedAt: -1, createdAt: -1 }).limit(50).lean();
      if (properties.length >= 3) break;
    }

    const comparableRows = properties
      .map((property) => ({ property, value: rateFor(property) }))
      .filter((row) => row.value)
      .sort((a, b) => comparableScore(sellRequest, b.property) - comparableScore(sellRequest, a.property))
      .slice(0, 20);
    const rates = comparableRows.map((row) => row.value.rate).filter((rate) => rate > 0);
    const fallbackRate = fallbackRates[normalize(city)] || fallbackRates.default;
    const marketRate = median(rates) || fallbackRate;
    const estimatedPrice = Math.round(marketRate * area);
    const spread = rates.length >= 3 ? 0.1 : 0.15;
    const low = Math.round(estimatedPrice * (1 - spread));
    const high = Math.round(estimatedPrice * (1 + spread));
    const askingPrice = number(data.askingPrice || sellRequest.askingPrice);

    return {
      sellRequestId: current._id,
      source: rates.length ? "comparables" : "baseline",
      confidence: confidenceFor(rates.length),
      estimatedPrice,
      low,
      high,
      pricePerSqft: Math.round(marketRate),
      area,
      comparableCount: rates.length,
      basis: rates.length
        ? `Based on ${rates.length} comparable ${type || "property"} listings${locality ? ` near ${locality}` : city ? ` in ${city}` : ""}.`
        : `Based on the ${city || "regional"} baseline rate until enough comparable listings are available.`,
      askingPriceDeltaPercent: askingPrice ? Math.round(((askingPrice - estimatedPrice) / estimatedPrice) * 100) : null,
      comparables: comparableRows.slice(0, 5).map(({ property, value }) => ({
        _id: property._id,
        title: property.title,
        price: property.price,
        status: property.status,
        locality: property.address?.locality,
        city: property.address?.city,
        area: value.area,
        pricePerSqft: Math.round(value.rate)
      }))
    };
  },
  async sellerOfferDecision(id, data, actor, req) {
    const sellRequest = await assertSellerOwner(id, actor);
    let acquisition = await Acquisition.findOne({ sellRequestId: sellRequest._id, sellerId: actor.id, ...clean }).sort({ createdAt: -1 });
    if (!acquisition) acquisition = await ensureAcquisitionForSellRequest(sellRequest, actor);
    if (!acquisition) throw domainError("No seller offer is available for this sell request yet.");
    const amount = offerAmountFor(sellRequest, acquisition);
    if (!amount) throw domainError("No valid offer amount is available for this sell request yet.");
    const priorDecision = acquisition.negotiation?.sellerDecision?.decision;
    if (priorDecision === "accepted" || priorDecision === "countered") throw domainError("This offer has already been decided.");
    const deadline = acquisition.negotiation?.deadline;
    if (deadline && new Date(deadline).getTime() <= Date.now()) throw domainError("This offer has expired. Contact BuiltGlory to continue.");
    const before = acquisition.toObject();
    const decision = data.decision;
    const sellerDecision = { decision, counterAmount: data.counterAmount, notes: data.notes, decidedAt: new Date(), actorId: actor?.id };
    acquisition.negotiation = { ...(acquisition.negotiation?.toObject?.() || acquisition.negotiation || {}), sellerDecision, status: decision === "accepted" ? "seller_accepted" : "seller_countered" };
    acquisition.lastActivityAt = new Date();
    if (decision === "accepted") {
      acquisition.agreedPrice = acquisition.agreedPrice || acquisition.negotiation?.agreedPrice || amount;
      if (acquisition.stage === "negotiation") acquisition.stage = "token_to_seller";
    }
    if (decision === "countered") {
      if (!(Number(data.counterAmount) > 0)) throw domainError("Counter offer requires a positive amount.");
      acquisition.negotiation.counterAmount = Number(data.counterAmount);
      if (["pending_review", "site_inspection", "valuation"].includes(acquisition.stage)) acquisition.stage = "negotiation";
    }
    await acquisition.save();
    await writeAuditLog({ actor, action: `sellRequests.offer_${decision}`, resourceType: "sellRequests", resourceId: sellRequest._id, before, after: acquisition.toObject(), req });
    return this.sellerActivity(id, actor);
  },
  async sellerDocuments(id, actor) {
    const sellRequest = await assertSellerOwner(id, actor);
    const acquisition = await Acquisition.findOne({ sellRequestId: sellRequest._id, sellerId: actor.id, ...clean }).sort({ createdAt: -1 }).lean();
    const owners = [{ ownerType: "sell_request", ownerId: sellRequest._id }];
    if (acquisition) owners.push({ ownerType: "acquisition", ownerId: acquisition._id });
    const stored = await Document.find({ isDeleted: { $ne: true }, $or: owners }).sort({ createdAt: -1 }).lean();
    const kindOf = (doc) => {
      const haystack = `${doc.documentType || ""} ${doc.purpose || ""} ${doc.fileName || ""} ${doc.name || ""}`.toLowerCase();
      if (haystack.includes("term_sheet") || haystack.includes("term sheet")) return "term_sheet";
      if (haystack.includes("sale_deed") || haystack.includes("sale deed")) return "sale_deed";
      return doc.documentType || doc.purpose || "other";
    };
    const rows = stored.map((doc) => ({
      documentId: doc._id,
      type: kindOf(doc),
      name: doc.fileName || doc.documentType || "Document",
      status: doc.status,
      createdAt: doc.createdAt,
      url: doc.isPrivate ? null : doc.url || null
    }));
    for (const item of sellRequest.documents || []) {
      if (item.documentId && rows.some((row) => String(row.documentId) === String(item.documentId))) continue;
      rows.push({
        documentId: item.documentId || null,
        type: kindOf(item),
        name: item.name || "Document",
        status: item.status || "uploaded",
        createdAt: sellRequest.updatedAt || null,
        url: item.fileUrl || null
      });
    }
    const linked = [
      ["term_sheet", "Term Sheet.pdf", acquisition?.documentation?.termSheetUrl || acquisition?.documentation?.termSheet?.url],
      ["sale_deed", "Sale Deed.pdf", acquisition?.documentation?.saleDeedUrl || acquisition?.documentation?.saleDeed?.url]
    ];
    for (const [type, name, url] of linked) {
      if (!url || rows.some((row) => row.type === type && (row.url === url || row.name === name))) continue;
      rows.push({ documentId: null, type, name, status: "uploaded", createdAt: acquisition?.updatedAt || null, url });
    }
    return rows;
  },
  async confirmPayoutSchedule(id, actor, req) {
    const sellRequest = await assertSellerOwner(id, actor);
    const acquisition = await Acquisition.findOne({ sellRequestId: sellRequest._id, sellerId: actor.id, ...clean }).sort({ createdAt: -1 });
    if (!acquisition) throw domainError("No deal is linked to this listing yet.");
    const before = acquisition.toObject();
    acquisition.payout = { ...plain(acquisition.payout), sellerConfirmedAt: new Date(), sellerConfirmedBy: actor.id };
    acquisition.markModified("payout");
    acquisition.lastActivityAt = new Date();
    await acquisition.save();
    await writeAuditLog({ actor, action: "sellRequests.payout_schedule_confirmed", resourceType: "acquisitions", resourceId: acquisition._id, before, after: acquisition.toObject(), req });
    return this.sellerActivity(id, actor);
  },
  async confirmRegistration(id, data, actor, req) {
    const sellRequest = await assertSellerOwner(id, actor);
    const acquisition = await Acquisition.findOne({ sellRequestId: sellRequest._id, sellerId: actor.id, ...clean }).sort({ createdAt: -1 });
    if (!acquisition) throw domainError("No deal is linked to this listing yet.");
    const documentsReady = Array.isArray(data.documentsReady) ? data.documentsReady.map((item) => String(item).trim()).filter(Boolean) : [];
    const before = acquisition.toObject();
    acquisition.documentation = {
      ...plain(acquisition.documentation),
      sellerConfirmedAt: new Date(),
      sellerConfirmedBy: actor.id,
      documentsReady
    };
    acquisition.markModified("documentation");
    acquisition.lastActivityAt = new Date();
    await acquisition.save();
    await writeAuditLog({ actor, action: "sellRequests.registration_confirmed", resourceType: "acquisitions", resourceId: acquisition._id, before, after: acquisition.toObject(), req });
    return this.sellerActivity(id, actor);
  }
};