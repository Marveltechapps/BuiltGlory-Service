import { createService } from "../../services/service.factory.js";
import { repository } from "./boostOrders.repository.js";
import { badRequest, notFound } from "./boostOrders.error.js";
import { Property } from "../properties/properties.model.js";
import { service as adminSettingsService } from "../adminSettings/adminSettings.service.js";

const baseService = createService({ collection: "boostOrders", repository });

const resolvePlanSnapshot = async (planId) => {
  const settings = await adminSettingsService.get();
  const plans = settings?.tools?.boostPlans || [];
  const plan = plans.find((item) => item.id === planId && item.active !== false);
  if (!plan) throw badRequest("Unknown or inactive boost planId.");
  return {
    name: plan.name,
    priceLabel: plan.priceLabel || "",
    benefits: Array.isArray(plan.benefits) ? plan.benefits : []
  };
};

const syncPropertyBoost = async (order) => {
  if (!order?.propertyId) return;
  if (order.status === "active") {
    await Property.findByIdAndUpdate(order.propertyId, {
      $set: {
        boost: {
          active: true,
          planId: order.planId,
          expiresAt: order.expiresAt
        }
      }
    });
    return;
  }
  const property = await Property.findById(order.propertyId).select("boost").lean();
  if (property?.boost?.planId && property.boost.planId === order.planId) {
    await Property.findByIdAndUpdate(order.propertyId, {
      $set: { "boost.active": false }
    });
  }
};

export const service = {
  ...baseService,
  async list(query, actor) {
    const result = await baseService.list(query, actor);
    const rows = Array.isArray(result?.data) ? result.data : [];
    const ids = [...new Set(rows.map((row) => String(row.propertyId || "")).filter(Boolean))];
    if (!ids.length) return result;
    const properties = await Property.find({ _id: { $in: ids } }).select("title referenceId").lean();
    const byId = new Map(properties.map((item) => [String(item._id), item]));
    return {
      ...result,
      data: rows.map((row) => {
        const plain = typeof row?.toObject === "function" ? row.toObject() : { ...row };
        const property = byId.get(String(plain.propertyId));
        return {
          ...plain,
          propertyTitle: property?.title || "",
          propertyReferenceId: property?.referenceId || ""
        };
      })
    };
  },
  async create(data, actor) {
    const property = await Property.findOne({ _id: data.propertyId, isDeleted: { $ne: true } });
    if (!property) throw notFound("Property not found.");
    const planSnapshot = await resolvePlanSnapshot(data.planId);
    const status = data.status || "scheduled";
    const doc = await baseService.create({
      ...data,
      planSnapshot,
      amount: data.amount ?? 0,
      status,
      createdBy: actor?.id
    }, actor);
    await syncPropertyBoost(doc);
    return doc;
  },
  async update(id, data, actor, req) {
    const before = await repository.findById(id);
    const startsAt = data.startsAt ? new Date(data.startsAt) : before.startsAt;
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : before.expiresAt;
    if (expiresAt <= startsAt) throw badRequest("expiresAt must be after startsAt.");
    const doc = await baseService.update(id, { ...data, startsAt, expiresAt }, actor, req);
    await syncPropertyBoost(doc);
    return doc;
  },
  async expireDueOrders() {
    const now = new Date();
    const due = await repository.Model.find({
      status: { $in: ["scheduled", "active"] },
      expiresAt: { $lte: now },
      isDeleted: { $ne: true }
    }).limit(200);
    for (const order of due) {
      order.status = "expired";
      await order.save();
      await syncPropertyBoost(order);
    }
    // Activate scheduled orders that have started.
    const activate = await repository.Model.find({
      status: "scheduled",
      startsAt: { $lte: now },
      expiresAt: { $gt: now },
      isDeleted: { $ne: true }
    }).limit(200);
    for (const order of activate) {
      order.status = "active";
      await order.save();
      await syncPropertyBoost(order);
    }
    return { expired: due.length, activated: activate.length };
  }
};
