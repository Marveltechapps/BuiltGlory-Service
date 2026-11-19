import { createService } from "../../services/service.factory.js";
import { repository } from "./buyEnquiries.repository.js";
import { Property } from "../properties/properties.model.js";
import { User } from "../users/users.model.js";
import { Visit } from "../visits/visits.model.js";
import { SalesDeal } from "../salesDeals/salesDeals.model.js";
import { Acquisition } from "../acquisitions/acquisitions.model.js";
import { SellRequest } from "../sellRequests/sellRequests.model.js";
import { Admin } from "../admins/admins.model.js";
import { domainError } from "./buyEnquiries.error.js";
const baseService = createService({ collection: "buyEnquiries", repository, workflowField: "status", workflowMap: "buyEnquiryStatus", ownerField: "buyerId" });
const dealStageLabels = {
  active_leads: "Active Lead",
  site_visits: "Site Visits",
  negotiation: "Negotiating",
  re_engagement: "Re-engagement",
  token_payment: "Token Payment",
  full_payment: "Full Payment",
  stage_payment: "Stage Payment",
  interior_design: "Interior Design",
  documentation: "Documentation",
  closed: "Closed",
  lost: "Lost"
};
const effectiveStatusFor = (enquiry, visits, deal) => {
  if (enquiry.status === "closed" || deal?.stage === "closed") return "closed";
  if (deal && !["active_leads", "site_visits", "lost"].includes(deal.stage)) return "negotiating";
  if (visits.some((visit) => !["cancelled", "missed"].includes(visit.status)) && ["new", "responded"].includes(enquiry.status)) return "visit_scheduled";
  return enquiry.status;
};
const customerStageLabelFor = (deal) => (deal?.stage && dealStageLabels[deal.stage]) || null;
const enrich = async (doc) => {
  const enquiry = doc?.toObject ? doc.toObject() : doc;
  const [visits, deal] = await Promise.all([
    Visit.find({ enquiryId: enquiry._id, isDeleted: { $ne: true } }).sort({ visitDate: -1 }).lean(),
    SalesDeal.findOne({ sourceEnquiryId: enquiry._id, stage: { $ne: "lost" }, isDeleted: { $ne: true } }).lean()
  ]);
  const status = effectiveStatusFor(enquiry, visits, deal);
  const advisor = enquiry.assignedTo ? await Admin.findById(enquiry.assignedTo).select("name phone").lean() : null;
  return {
    ...enquiry,
    status,
    customerStage: deal?.stage || null,
    customerStageLabel: customerStageLabelFor(deal),
    assignedAdvisor: advisor ? { name: advisor.name || null, phone: advisor.phone || null } : null,
    visits,
    deal: deal || null
  };
};
export const service = {
  ...baseService,
  async list(query, actor) {
    const result = await baseService.list(query, actor);
    return { ...result, data: await Promise.all(result.data.map(enrich)) };
  },
  async get(id, actor) {
    return enrich(await baseService.get(id, actor));
  },
  async create(data, actor, req) {
    const buyer = await User.findById(actor?.id);
    if (!buyer || buyer.isBlocked) throw domainError("Blocked or inactive customers cannot create enquiries.");
    if (data.preferredContact === "email" && !buyer.email) throw domainError("Email contact requires a customer email.");
    if (data.interestType === "schedule_visit" && !data.preferredVisitTime && !data.preferredVisitDate) throw domainError("Visit preference is required for schedule visit enquiries.");
    const property = await Property.findOne({ _id: data.propertyId, status: { $in: ["available", "reserved", "under_construction"] }, isDeleted: { $ne: true } });
    if (!property) throw domainError("Property must exist and be visible.");
    const original = await repository.findOne({ propertyId: property._id, buyerId: buyer._id });
    // QA-BUG-012: derive source from trusted client header, never from the request body.
    const clientHeader = String(req?.headers?.["x-client"] || "").trim().toLowerCase();
    const source = ["web", "app", "dashboard", "callback", "import"].includes(clientHeader) ? clientHeader : "app";
    const { source: _ignoredSource, ...safeData } = data || {};
    const enquiry = await baseService.create({
      ...safeData,
      source,
      buyerId: buyer._id,
      buyerSnapshot: { name: buyer.name, phone: buyer.phone, email: buyer.email, userType: buyer.userType },
      propertySnapshot: { title: property.title, price: property.price, type: property.type, location: [property.address?.locality, property.address?.city].filter(Boolean).join(", ") },
      duplicateOf: original?._id || null,
      submittedAt: new Date()
    }, actor);
    await Property.updateOne({ _id: property._id }, { $inc: { "metrics.enquiries": 1 } });
    if (property.acquisitionId) {
      const acquisition = await Acquisition.findById(property.acquisitionId).select("sellRequestId").lean();
      if (acquisition?.sellRequestId) await SellRequest.updateOne({ _id: acquisition.sellRequestId }, { $inc: { "metrics.enquiryCount": 1 } });
    }
    try {
      const { incrementPropertyDailyStat } = await import("../properties/properties.dailyStats.service.js");
      await incrementPropertyDailyStat(property._id, "enquiries");
    } catch { /* metrics side-effect */ }
    return enquiry;
  },
  async convertToDeal(id, data, actor) {
    const enquiry = await repository.findById(id);
    const existing = await SalesDeal.findOne({ sourceEnquiryId: enquiry._id, stage: { $ne: "lost" }, isDeleted: { $ne: true } });
    if (existing) {
      if (String(enquiry.dealId || "") !== String(existing._id)) await repository.update(enquiry._id, { dealId: existing._id });
      return { deal: existing, created: false };
    }
    const { service: dealService } = await import("../salesDeals/salesDeals.service.js");
    const deal = await dealService.create({
      ...(data || {}),
      buyerId: enquiry.buyerId,
      buyerSnapshot: enquiry.buyerSnapshot,
      propertyId: enquiry.propertyId,
      propertySnapshot: enquiry.propertySnapshot,
      sourceEnquiryId: enquiry._id,
      stage: "active_leads"
    }, actor);
    await repository.update(enquiry._id, { dealId: deal._id });
    return { deal, created: true };
  },
  async cancel(id, actor, req, body = {}) {
    const enquiry = await repository.findById(id);
    if (String(enquiry.buyerId) !== String(actor?.id)) throw domainError("You cannot cancel this enquiry.");
    const activeDeal = await SalesDeal.findOne({ sourceEnquiryId: enquiry._id, stage: { $ne: "lost" }, isDeleted: { $ne: true } });
    if (activeDeal) throw domainError("Cannot cancel enquiry after an active deal has started.");
    const reason = String(body.reason || "").trim().slice(0, 500) || "customer_cancelled";
    await Visit.updateMany(
      { enquiryId: enquiry._id, status: { $in: ["scheduled", "confirmed", "rescheduled"] }, isDeleted: { $ne: true } },
      { $set: { status: "cancelled", cancelReason: reason } }
    );
    const doc = await baseService.transition(id, "closed", actor, req, { cancelReason: reason });
    return enrich(doc);
  },
  async update(id, data, actor, req) {
    const before = await repository.findById(id);
    if (data.status && data.status !== before.status) {
      const { status, ...extra } = data;
      const doc = await baseService.transition(id, status, actor, req, extra);
      return enrich(doc);
    }
    const doc = await baseService.update(id, data, actor, req);
    return enrich(doc);
  }
};