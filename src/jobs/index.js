import { Callback } from "../modules/callbacks/callbacks.model.js";
import { SupportTicket } from "../modules/supportTickets/supportTickets.model.js";
import { Visit } from "../modules/visits/visits.model.js";
import { SalesDeal } from "../modules/salesDeals/salesDeals.model.js";
import { Acquisition } from "../modules/acquisitions/acquisitions.model.js";
import { Document } from "../modules/documents/documents.model.js";
import { Notification } from "../modules/notifications/notifications.model.js";
import { processNotificationQueue, enqueueInAppAndPush } from "../services/notification.service.js";
import { withJobLock } from "../services/jobLock.service.js";
import { logger } from "../config/logger.js";
import { service as userService } from "../modules/users/users.service.js";
import { service as boostOrdersService } from "../modules/boostOrders/boostOrders.service.js";
import cron from "node-cron";

const enqueueDualChannelOnce = async ({ key, ...notification }) => {
  const existing = await Notification.findOne({ event: notification.event, "payload.idempotencyKey": key, status: { $ne: "cancelled" } });
  if (existing) return existing;
  const { inApp } = await enqueueInAppAndPush({
    ...notification,
    dedupeKey: key,
    payload: { ...(notification.payload || {}), idempotencyKey: key }
  });
  return inApp;
};

export const markOverdueCallbacks = () => withJobLock("callbacks-overdue", () =>
  Callback.updateMany({ status: { $in: ["pending", "rescheduled", "called"] }, slaDeadline: { $lt: new Date() }, isDeleted: { $ne: true } }, { status: "overdue" }));

export const markOverdueSupportTickets = () => withJobLock("support-overdue", () =>
  SupportTicket.updateMany({ status: { $in: ["open", "in_progress"] }, slaDeadline: { $lt: new Date() }, isDeleted: { $ne: true } }, { priority: "urgent" }));

export const enqueueVisitReminders = async () => {
  const from = new Date();
  const to = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const visits = await Visit.find({ status: { $in: ["scheduled", "confirmed"] }, visitDate: { $gte: from, $lte: to }, isDeleted: { $ne: true } });
  return withJobLock("visit-reminders", () => Promise.all(visits.map((visit) => enqueueDualChannelOnce({
    key: `visit_reminder:${visit._id}:${visit.visitDate.toISOString().slice(0, 10)}`,
    userId: visit.buyerId,
    event: "visit_reminder",
    recipient: String(visit.buyerId),
    templateId: "visit_reminder",
    title: "Visit Reminder",
    message: `Reminder: your visit is scheduled for ${new Date(visit.visitDate).toLocaleDateString("en-IN")}.`,
    notificationType: "N-03",
    screen: "B12",
    enquiryId: String(visit.enquiryId || ""),
    propertyId: String(visit.propertyId || ""),
    entityId: String(visit._id),
    entityType: "visit",
    payload: {
      visitId: visit._id,
      visitDate: visit.visitDate,
      notificationType: "N-03",
      type: "N-03",
      screen: "B12",
      screenKey: "visitCalendar",
      deepLink: "B-12",
      entityId: String(visit._id),
      entityType: "visit",
      createdAt: new Date().toISOString(),
      audience: "buyer"
    }
  }))));
};

export const enqueueVisitFollowUps = async () => {
  const visits = await Visit.find({ status: "completed", "feedback.nextAction": "follow_up", isDeleted: { $ne: true } });
  return withJobLock("visit-followups", () => Promise.all(visits.map((visit) => enqueueDualChannelOnce({
    key: `visit_follow_up:${visit._id}`,
    userId: visit.buyerId,
    event: "visit_follow_up",
    recipient: String(visit.buyerId),
    templateId: "visit_follow_up",
    title: "Visit Follow-up",
    message: "Our team will follow up on your recent property visit.",
    notificationType: "VISIT_FOLLOW_UP",
    screen: "P08",
    enquiryId: String(visit.enquiryId || ""),
    propertyId: String(visit.propertyId || ""),
    payload: { visitId: visit._id, screenKey: "enquiryDetail", type: "VISIT_FOLLOW_UP" }
  }))));
};

export const enqueueDealFollowUps = async () => {
  const deals = await SalesDeal.find({ stage: { $in: ["active_leads", "site_visits", "negotiation", "re_engagement"] }, isDeleted: { $ne: true } }).limit(100);
  return withJobLock("deal-followups", () => Promise.all(deals.map((deal) => enqueueDualChannelOnce({
    key: `deal_follow_up:${deal._id}:${deal.stage}`,
    userId: deal.buyerId,
    event: "deal_follow_up",
    recipient: String(deal.buyerId),
    templateId: "deal_follow_up",
    title: "Deal Follow-up",
    message: "Your deal needs follow-up. Please check the app for updates.",
    notificationType: "DEAL_FOLLOW_UP",
    screen: "P08",
    dealId: String(deal._id),
    enquiryId: String(deal.sourceEnquiryId || ""),
    propertyId: String(deal.propertyId || ""),
    payload: { dealId: deal._id, stage: deal.stage, screenKey: "enquiryDetail", type: "DEAL_FOLLOW_UP" }
  }))));
};

export const retryDocumentScans = () => withJobLock("document-scan-retry", () =>
  Document.updateMany({ scanStatus: { $in: ["pending", "failed"] }, isDeleted: { $ne: true } }, { scanStatus: "pending" }));

export const calculateStageAging = async () => {
  return withJobLock("stage-aging", async () => {
    const now = Date.now();
    const acquisitions = await Acquisition.find({ stage: { $nin: ["acquired", "rejected"] }, isDeleted: { $ne: true } });
    const deals = await SalesDeal.find({ stage: { $nin: ["closed", "lost"] }, isDeleted: { $ne: true } });
    await Promise.all(acquisitions.map((item) => Acquisition.findByIdAndUpdate(item._id, { daysInStage: Math.floor((now - new Date(item.lastActivityAt || item.updatedAt || item.createdAt).getTime()) / 86400000) })));
    await Promise.all(deals.map((item) => SalesDeal.findByIdAndUpdate(item._id, { daysInStage: Math.floor((now - new Date(item.lastActivityAt || item.updatedAt || item.createdAt).getTime()) / 86400000) })));
  });
};

export const completeDueAccountDeletions = () =>
  withJobLock("account-deletion-complete", () => userService.completeDueAccountDeletions());

export const syncBoostOrders = () =>
  withJobLock("boost-orders-sync", () => boostOrdersService.expireDueOrders());

export const runAllJobs = async () => {
  await markOverdueCallbacks();
  await markOverdueSupportTickets();
  await enqueueVisitReminders();
  await enqueueVisitFollowUps();
  await enqueueDealFollowUps();
  await withJobLock("notification-retry", () => processNotificationQueue());
  await retryDocumentScans();
  await calculateStageAging();
  await completeDueAccountDeletions();
  await syncBoostOrders();
};

let scheduledTask;

/** Runs the background queue every 15 minutes inside the API process. Skipped in tests. */
export const scheduleJobs = () => {
  if (scheduledTask || process.env.NODE_ENV === "test") return scheduledTask;
  scheduledTask = cron.schedule("*/15 * * * *", () => {
    withJobLock("scheduled-jobs", () => runAllJobs()).catch((error) => {
      logger.error({ message: "Scheduled jobs failed", error: error.message, stack: error.stack });
    });
  });
  return scheduledTask;
};

export const stopScheduledJobs = () => {
  scheduledTask?.stop();
  scheduledTask = undefined;
};
