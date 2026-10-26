import { createService } from "../../services/service.factory.js";
import { validatePropertyPublication } from "../../services/workflow.rules.js";
import { repository } from "./properties.repository.js";
import { resolvePropertyType } from "./properties.propertyType.utils.js";
import { domainError, forbidden } from "./properties.error.js";

const baseService = createService({
  collection: "properties",
  repository,
  workflowField: "status",
  workflowMap: "propertyStatus",
  ownerField: null
});

const withResolvedType = (data = {}) => {
  const payload = { ...data };
  if (payload.type || payload.specs) {
    payload.type = resolvePropertyType({ type: payload.type, specs: payload.specs });
  }
  return payload;
};

const canPublish = (actor) =>
  actor?.role === "super_admin" || actor?.permissions?.includes("*") || actor?.permissions?.includes("properties.publish");

export const service = {
  ...baseService,
  async create(data, actor) {
    const payload = withResolvedType(data);
    if (payload.status === "available") {
      if (!canPublish(actor)) throw forbidden("Publishing a property requires properties.publish.");
      validatePropertyPublication(payload);
      if (payload.isVisibleOnApp === undefined) payload.isVisibleOnApp = true;
    } else if (payload.status === "draft") {
      payload.isVisibleOnApp = false;
    }
    return baseService.create(payload, actor);
  },
  async update(id, data, actor, req) {
    return baseService.update(id, withResolvedType(data), actor, req);
  },
  async transition(id, to, actor, req, extra = {}) {
    if (to === "sold") {
      const before = await repository.findById(id);
      if (!["available", "reserved"].includes(before.status)) {
        throw domainError("Only available or reserved properties can be marked sold.");
      }
      if (!extra.closedDealId) {
        const { SalesDeal } = await import("../salesDeals/salesDeals.model.js");
        const deal = await SalesDeal.findOne({ propertyId: before._id, stage: "closed", isDeleted: { $ne: true } }).select("_id");
        if (!deal) throw domainError("Sold status requires a closed sales deal.");
        extra = { ...extra, closedDealId: deal._id };
      }
    }
    return baseService.transition(id, to, actor, req, extra);
  }
};
