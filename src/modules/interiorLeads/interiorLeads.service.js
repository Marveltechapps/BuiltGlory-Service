import { createService } from "../../services/service.factory.js";
import { repository } from "./interiorLeads.repository.js";
import { domainError } from "./interiorLeads.error.js";
const baseService = createService({ collection: "interiorLeads", repository, workflowField: "status", workflowMap: "interiorLeadStatus", ownerField: "buyerId" });
export const service = {
  ...baseService,
  async create(data, actor) {
    if (!data.buyerId || !data.propertyId || !(data.selectedRooms || []).length || !data.designStyle || !data.budgetRange) throw domainError("Interior lead requires buyer, property, rooms, design style, and budget range.");
    return baseService.create({ ...data, slaDeadline: data.slaDeadline || new Date(Date.now() + 24 * 60 * 60 * 1000) }, actor);
  },
  async update(id, data, actor, req) {
    const payload = { ...data };
    if (payload.status === "quote_sent") {
      const quote = payload.quote || {};
      if (!quote.amount || !quote.packageName || !quote.timeline || !(quote.inclusions || []).length || !quote.validUntil) throw domainError("Quote sent requires amount, package, timeline, inclusions, and validity date.");
    }
    if (payload.status === "accepted" && !payload.customerAcceptedAt) payload.customerAcceptedAt = new Date();
    if (payload.status === "completed" && !payload.completionNote) throw domainError("Completed interior leads require a completion note.");
    if (payload.status) {
      const to = payload.status;
      delete payload.status;
      return baseService.transition(id, to, actor, req, payload);
    }
    return baseService.update(id, payload, actor, req);
  }
};