import { createService } from "../../services/service.factory.js";
import { notFound, badRequest } from "./notifications.error.js";
import { Notification } from "./notifications.model.js";
import { repository } from "./notifications.repository.js";
import { enqueueNotification, dispatchNotification, enqueueInAppAndPush } from "../../services/notification.service.js";
import { buildManualNotificationPayload } from "../../services/workflowPush.service.js";
import { writeAuditLog } from "../../services/audit.service.js";
import { User } from "../users/users.model.js";

const baseService = createService({ collection: "notifications", repository, workflowField: null, workflowMap: null, ownerField: "userId" });

const mapListFilter = (query = {}) => {
  const filter = { isDeleted: { $ne: true } };
  if (query.channel) filter.channel = query.channel;
  if (query.status && query.status !== "unread" && query.status !== "read") filter.status = query.status;
  if (query.userId) filter.userId = query.userId;
  if (query.event) filter.event = query.event;
  if (query.notificationType) filter.notificationType = query.notificationType;
  if (query.isRead === true || query.isRead === "true" || query.status === "read") filter.isRead = true;
  if (query.isRead === false || query.isRead === "false" || query.status === "unread") filter.isRead = { $ne: true };
  return filter;
};

export const service = {
  ...baseService,
  async list(query, actor) {
    if (actor?.type === "admin") {
      const { page, limit, skip } = await import("../../utils/pagination.js").then((m) => m.getPagination(query));
      const filter = mapListFilter(query);
      const deliveryLog = ["push", "sms", "email", "whatsapp"].includes(query.channel);
      if (!deliveryLog) {
        filter.channel = "in_app";
        filter.userId = null;
        filter.$or = [{ adminId: actor.id }, { audience: "admin" }];
      }
      const [data, total] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Notification.countDocuments(filter)
      ]);
      return { data, meta: (await import("../../utils/pagination.js")).paginationMeta(page, limit, total) };
    }
    const forced = actor?.type === "customer" ? { userId: actor.id, channel: "in_app" } : {};
    const customerFilter = { ...forced };
    if (query.isRead === true || query.isRead === "true" || query.status === "read") customerFilter.isRead = true;
    if (query.isRead === false || query.isRead === "false" || query.status === "unread") customerFilter.isRead = { $ne: true };
    return repository.list(query, customerFilter);
  },
  async countUnread(actor) {
    const count = await Notification.countDocuments({
      userId: actor?.id,
      channel: "in_app",
      isRead: { $ne: true },
      isDeleted: { $ne: true }
    });
    return { count };
  },
  async update(id, data, actor, req) {
    if (actor?.type === "admin") {
      const existing = await Notification.findById(id);
      if (!existing || existing.isDeleted) throw notFound("Notification not found.");
      const customerInbox = existing.channel === "in_app" && existing.userId;
      if (customerInbox) throw notFound("Notification not found.");
      if (existing.channel === "in_app") {
        const mine = existing.adminId && String(existing.adminId) === String(actor.id);
        const broadcast = existing.audience === "admin";
        if (!mine && !broadcast && actor.role !== "super_admin") throw notFound("Notification not found.");
      }
    }
    const patch = { ...data };
    if (patch.isRead === true && !patch.readAt) patch.readAt = new Date();
    if (patch.isRead === false) patch.readAt = null;
    return baseService.update(id, patch, actor, req);
  },
  async markMineRead(actor, ids = []) {
    const filter = { userId: actor?.id, channel: "in_app" };
    if (ids.length) filter._id = { $in: ids };
    await Notification.updateMany(filter, { $set: { isRead: true, readAt: new Date() } });
    const result = await baseService.list({ limit: 100 }, actor);
    return result.data;
  },
  async markOneRead(id, actor) {
    const updated = await Notification.findOneAndUpdate(
      { _id: id, userId: actor?.id, channel: "in_app" },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );
    if (!updated) throw notFound("Notification not found.");
    return updated;
  },
  async deleteMine(id, actor) {
    const updated = await Notification.findOneAndUpdate(
      { _id: id, userId: actor?.id, channel: "in_app" },
      { $set: { isDeleted: true, archivedAt: new Date() } },
      { new: true }
    );
    if (!updated) throw notFound("Notification not found.");
    return { deleted: true, id };
  },
  async sendManual(data, actor, req) {
    const { userId, audience = "buyer", notificationType, title, message, screen, screenKey, listingId, enquiryId, dealId, propertyId, entityId, entityType, image, deepLink } = data;
    if (!userId) throw badRequest("userId is required.");
    const user = await User.findById(userId).lean();
    if (!user) throw notFound("User not found.");

    const workflow = buildManualNotificationPayload({
      notificationType: notificationType || `${audience}_manual`,
      title,
      message,
      screen,
      screenKey,
      listingId,
      enquiryId,
      dealId,
      propertyId,
      audience,
      entityId: entityId || "",
      entityType: entityType || "",
      image: image || "",
      deepLink: deepLink || ""
    });

    const payload = {
      ...workflow,
      audience,
      body: workflow.message || workflow.body,
      deepLink: workflow.deepLink || workflow.screenKey,
      sellRequestId: workflow.listingId || ""
    };

    const { inApp, push } = await enqueueInAppAndPush({
      userId,
      adminId: actor?.id,
      event: "admin_manual_push",
      recipient: String(userId),
      templateId: notificationType || "admin_manual_push",
      payload,
      dedupeKey: data.dedupeKey || workflow.dedupeKey,
      title: workflow.title,
      message: workflow.message || workflow.body,
      notificationType: workflow.notificationType,
      listingId: workflow.listingId,
      enquiryId: workflow.enquiryId,
      dealId: workflow.dealId,
      propertyId: workflow.propertyId,
      screen: workflow.screen,
      entityId: workflow.entityId,
      entityType: workflow.entityType,
      image: workflow.image
    });

    await writeAuditLog({
      actor,
      action: "notifications.manual_push",
      resourceType: "notifications",
      resourceId: push?._id || inApp?._id,
      after: { userId, notificationType, title, pushStatus: push?.status, inAppStatus: inApp?.status },
      req
    });

    return { inApp, push };
  },
  async retry(id, actor, req) {
    const notification = await Notification.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!notification) throw notFound("Notification not found.");
    if (!["failed", "dead_letter"].includes(notification.status)) {
      throw badRequest("Only failed notifications can be retried.");
    }
    const reset = await Notification.findByIdAndUpdate(
      id,
      {
        status: "queued",
        attempts: 0,
        nextAttemptAt: null,
        failedAt: null,
        deadLetterAt: null,
        failureReason: null
      },
      { new: true }
    );
    const dispatched = await dispatchNotification(reset);
    await writeAuditLog({
      actor,
      action: "notifications.retry",
      resourceType: "notifications",
      resourceId: id,
      after: { status: dispatched?.status },
      req
    });
    return dispatched;
  }
};
